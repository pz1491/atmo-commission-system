import { prisma } from "@/lib/prisma";
import type { ActionType, EntityType } from "@/generated/prisma/enums";

// Automation Safety Guardrails (spec sections 5 & 35). Every check here must
// run — and every block must be logged — before an AutomationAction is ever
// sent to the Meta adapter. Nothing bypasses this file.

export interface SafetyCheckInput {
  organizationId: string;
  entityType: EntityType;
  entityId: string; // internal Campaign/AdSet/Ad id
  adAccountId: string;
  actionType: ActionType;
  currentBudget?: number | null;
  proposedBudget?: number | null;
  proposedIncreasePercent?: number | null;
}

export interface SafetyCheckResult {
  allowed: boolean;
  blockedReason?: string;
}

const BUDGET_ACTIONS: ActionType[] = [
  "INCREASE_BUDGET_PERCENT",
  "DECREASE_BUDGET_PERCENT",
  "INCREASE_BUDGET_FIXED",
  "DECREASE_BUDGET_FIXED",
];

export async function checkActionSafety(
  input: SafetyCheckInput,
): Promise<SafetyCheckResult> {
  const settings = await prisma.safetySettings.findUnique({
    where: { organizationId: input.organizationId },
  });
  if (!settings) {
    return { allowed: false, blockedReason: "No safety settings configured for this organization." };
  }

  if (settings.automationMode === "OFF") {
    return { allowed: false, blockedReason: "Automation mode is OFF." };
  }

  if (settings.killSwitchActive) {
    return { allowed: false, blockedReason: "Emergency kill switch is active — all automation is stopped." };
  }

  // Data freshness — never act on stale data.
  const account = await prisma.adAccount.findUnique({
    where: { id: input.adAccountId },
    select: { lastSyncedAt: true, syncStatus: true },
  });
  if (
    !account?.lastSyncedAt ||
    account.syncStatus === "ERROR" ||
    Date.now() - account.lastSyncedAt.getTime() >
      settings.dataFreshnessMaxMinutes * 60_000
  ) {
    return {
      allowed: false,
      blockedReason: `DATA DELAY — ad account data is older than ${settings.dataFreshnessMaxMinutes} minutes.`,
    };
  }

  // Hourly action rate limit.
  const oneHourAgo = new Date(Date.now() - 60 * 60_000);
  const actionsThisHour = await prisma.automationAction.count({
    where: {
      organizationId: input.organizationId,
      status: "EXECUTED",
      executedAt: { gte: oneHourAgo },
    },
  });
  if (actionsThisHour >= settings.maxAiActionsPerHour) {
    return {
      allowed: false,
      blockedReason: `Hourly AI action limit reached (${settings.maxAiActionsPerHour}/hour).`,
    };
  }

  // Duplicate-per-day limit.
  if (input.actionType === "DUPLICATE") {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const duplicatesToday = await prisma.automationAction.count({
      where: {
        organizationId: input.organizationId,
        actionType: "DUPLICATE",
        status: "EXECUTED",
        executedAt: { gte: startOfDay },
      },
    });
    if (duplicatesToday >= settings.maxDuplicatesPerDay) {
      return {
        allowed: false,
        blockedReason: `Daily duplicate limit reached (${settings.maxDuplicatesPerDay}/day).`,
      };
    }
  }

  if (BUDGET_ACTIONS.includes(input.actionType)) {
    // Cooldown — no repeat budget change on the same entity within the window.
    const cooldownSince = new Date(
      Date.now() - settings.budgetChangeCooldownHours * 60 * 60_000,
    );
    const recentBudgetAction = await prisma.automationAction.findFirst({
      where: {
        organizationId: input.organizationId,
        actionType: { in: BUDGET_ACTIONS },
        status: "EXECUTED",
        executedAt: { gte: cooldownSince },
        ...(input.entityType === "CAMPAIGN"
          ? { campaignId: input.entityId }
          : input.entityType === "AD_SET"
            ? { adSetId: input.entityId }
            : { adId: input.entityId }),
      },
    });
    if (recentBudgetAction) {
      return {
        allowed: false,
        blockedReason: `Budget cooldown active (${settings.budgetChangeCooldownHours}h) since last change.`,
      };
    }

    // Max increase per single action.
    if (
      (input.actionType === "INCREASE_BUDGET_PERCENT" || input.actionType === "DECREASE_BUDGET_PERCENT") &&
      input.proposedIncreasePercent !== null &&
      input.proposedIncreasePercent !== undefined &&
      Math.abs(input.proposedIncreasePercent) > settings.maxIncreasePerActionPercent
    ) {
      return {
        allowed: false,
        blockedReason: `Requested change (${input.proposedIncreasePercent}%) exceeds max per-action limit (${settings.maxIncreasePerActionPercent}%).`,
      };
    }

    // Max cumulative increase in trailing 24h for this entity.
    if (input.currentBudget && input.proposedBudget && input.proposedBudget > input.currentBudget) {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60_000);
      const history = await prisma.budgetHistory.findMany({
        where: {
          adAccountId: input.adAccountId,
          createdAt: { gte: dayAgo },
          ...(input.entityType === "CAMPAIGN"
            ? { campaignId: input.entityId }
            : input.entityType === "AD_SET"
              ? { adSetId: input.entityId }
              : {}),
        },
        orderBy: { createdAt: "asc" },
      });
      const baseline = history.length > 0 ? Number(history[0].previousBudget) : input.currentBudget;
      const cumulativeIncreasePercent =
        baseline > 0 ? ((input.proposedBudget - baseline) / baseline) * 100 : 0;
      if (cumulativeIncreasePercent > settings.maxBudgetIncreasePer24hPercent) {
        return {
          allowed: false,
          blockedReason: `Cumulative 24h budget increase (${cumulativeIncreasePercent.toFixed(1)}%) would exceed limit (${settings.maxBudgetIncreasePer24hPercent}%).`,
        };
      }
    }

    // Absolute campaign / account caps.
    if (input.proposedBudget) {
      if (input.entityType === "CAMPAIGN" && input.proposedBudget > Number(settings.maxCampaignDailyBudget)) {
        return {
          allowed: false,
          blockedReason: `Proposed budget (${input.proposedBudget}) exceeds max campaign daily budget (${settings.maxCampaignDailyBudget}).`,
        };
      }

      const campaigns = await prisma.campaign.findMany({
        where: { adAccountId: input.adAccountId, status: "ACTIVE" },
        select: { id: true, dailyBudget: true },
      });
      const currentTotal = campaigns.reduce(
        (sum, c) => sum + Number(c.dailyBudget ?? 0),
        0,
      );
      const delta = input.currentBudget
        ? input.proposedBudget - input.currentBudget
        : input.proposedBudget;
      if (currentTotal + delta > Number(settings.maxAccountDailySpend)) {
        return {
          allowed: false,
          blockedReason: `Projected account daily spend (${(currentTotal + delta).toFixed(0)}) would exceed max account daily spend (${settings.maxAccountDailySpend}).`,
        };
      }
    }
  }

  return { allowed: true };
}
