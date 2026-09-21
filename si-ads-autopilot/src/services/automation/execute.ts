import { prisma } from "@/lib/prisma";
import { MetaAdsAdapter, MetaApiError, MetaFeatureUnavailableError } from "@/services/meta";
import type { ActionType, EntityType } from "@/generated/prisma/enums";
import { checkActionSafety, type SafetyCheckResult } from "./safety";
import { buildIdempotencyKey } from "./idempotency";

export interface ActionParams {
  percent?: number;
  amount?: number;
  tag?: string;
  duplicateMode?: "SAME_AUDIENCE" | "NEW_AUDIENCE" | "NEW_PLACEMENT" | "CREATIVE_ONLY";
}

export interface ExecuteActionInput {
  organizationId: string;
  ruleId: string | null;
  ruleName: string | null;
  entityType: EntityType;
  entityId: string; // internal Campaign/AdSet/Ad id
  actionType: ActionType;
  reason: string;
  actionParams?: ActionParams;
  /** Set when a user clicks Approve on a PENDING_APPROVAL action — bypasses the org mode gate. */
  forceExecute?: boolean;
  actorUserId?: string | null;
}

function computeNewBudget(
  current: number,
  actionType: ActionType,
  params?: ActionParams,
): number | null {
  if (actionType === "INCREASE_BUDGET_PERCENT" && params?.percent) {
    return current * (1 + params.percent / 100);
  }
  if (actionType === "DECREASE_BUDGET_PERCENT" && params?.percent) {
    return current * (1 - params.percent / 100);
  }
  if (actionType === "INCREASE_BUDGET_FIXED" && params?.amount) {
    return current + params.amount;
  }
  if (actionType === "DECREASE_BUDGET_FIXED" && params?.amount) {
    return Math.max(0, current - params.amount);
  }
  return null;
}

async function loadEntity(entityType: EntityType, entityId: string) {
  if (entityType === "CAMPAIGN") {
    const campaign = await prisma.campaign.findUniqueOrThrow({
      where: { id: entityId },
      include: { adAccount: { include: { metaConnection: true } } },
    });
    return {
      externalId: campaign.externalId,
      status: campaign.status,
      budget: campaign.dailyBudget ? Number(campaign.dailyBudget) : null,
      adAccountId: campaign.adAccountId,
      adAccountExternalId: campaign.adAccount.externalId,
      accessToken: campaign.adAccount.metaConnection.accessToken,
    };
  }
  if (entityType === "AD_SET") {
    const adSet = await prisma.adSet.findUniqueOrThrow({
      where: { id: entityId },
      include: {
        campaign: { include: { adAccount: { include: { metaConnection: true } } } },
      },
    });
    return {
      externalId: adSet.externalId,
      status: adSet.status,
      budget: adSet.dailyBudget ? Number(adSet.dailyBudget) : null,
      adAccountId: adSet.campaign.adAccountId,
      adAccountExternalId: adSet.campaign.adAccount.externalId,
      accessToken: adSet.campaign.adAccount.metaConnection.accessToken,
    };
  }
  const ad = await prisma.ad.findUniqueOrThrow({
    where: { id: entityId },
    include: {
      adSet: {
        include: {
          campaign: { include: { adAccount: { include: { metaConnection: true } } } },
        },
      },
    },
  });
  return {
    externalId: ad.externalId,
    status: ad.status,
    budget: null,
    adAccountId: ad.adSet.campaign.adAccountId,
    adAccountExternalId: ad.adSet.campaign.adAccount.externalId,
    accessToken: ad.adSet.campaign.adAccount.metaConnection.accessToken,
  };
}

async function writeAudit(
  organizationId: string,
  entityType: EntityType,
  entityId: string,
  action: string,
  before: unknown,
  after: unknown,
  reason: string,
  ruleId: string | null,
  result: "SUCCESS" | "FAILED" | "BLOCKED",
  actorUserId?: string | null,
) {
  await prisma.auditLog.create({
    data: {
      organizationId,
      actorType: actorUserId ? "USER" : "AI",
      actorUserId: actorUserId ?? null,
      action,
      entityType,
      entityId,
      before: before as never,
      after: after as never,
      reason,
      ruleId,
      result,
    },
  });
}

/**
 * Central execution path for every automation action — rule-triggered or
 * user-approved. Always: safety check -> mode gate -> adapter call -> DB
 * update -> audit log. Nothing pauses/resumes/rebudgets/duplicates an ad
 * outside this function.
 */
export async function executeAutomationAction(input: ExecuteActionInput) {
  const settings = await prisma.safetySettings.findUniqueOrThrow({
    where: { organizationId: input.organizationId },
  });
  const entity = await loadEntity(input.entityType, input.entityId);
  const idempotencyKey = buildIdempotencyKey(
    input.ruleId ?? "manual",
    input.entityId,
    input.actionType,
  );

  const before = { status: entity.status, budget: entity.budget };
  const proposedBudget =
    entity.budget !== null
      ? computeNewBudget(entity.budget, input.actionType, input.actionParams)
      : null;

  // A human clicking a button in Campaign Explorer is not "automation" —
  // the mode gate and AI guardrails (kill switch, cooldowns, rate limits)
  // exist to constrain the rule engine, not manual admin actions. Still
  // routed through this same function so the audit log stays complete.
  const isManual = Boolean(input.actorUserId && !input.ruleId);
  const mode = isManual || input.forceExecute ? "AUTOPILOT" : settings.automationMode;

  const baseRecord = {
    organizationId: input.organizationId,
    ruleId: input.ruleId,
    entityType: input.entityType,
    campaignId: input.entityType === "CAMPAIGN" ? input.entityId : null,
    adSetId: input.entityType === "AD_SET" ? input.entityId : null,
    adId: input.entityType === "AD" ? input.entityId : null,
    actionType: input.actionType,
    reason: input.reason,
    ruleTriggered: input.ruleName,
    idempotencyKey,
    before: before as never,
  };

  if (mode === "OFF") {
    return null;
  }

  if (mode === "SIMULATION") {
    const after = { status: entity.status, budget: proposedBudget ?? entity.budget };
    try {
      return await prisma.automationAction.create({
        data: { ...baseRecord, status: "SIMULATED", after: after as never },
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) return null; // already simulated this window
      throw err;
    }
  }

  if (mode === "APPROVAL_REQUIRED" && !input.forceExecute) {
    try {
      const action = await prisma.automationAction.create({
        data: {
          ...baseRecord,
          status: "PENDING_APPROVAL",
          after: { status: entity.status, budget: proposedBudget ?? entity.budget } as never,
        },
      });
      await prisma.alert.create({
        data: {
          organizationId: input.organizationId,
          type: "BUDGET_NEAR_LIMIT", // generic in-app notice; UI reads AutomationAction feed for detail
          severity: "INFO",
          title: "Action awaiting approval",
          message: input.reason,
          entityType: input.entityType,
          entityId: input.entityId,
          channels: ["IN_APP"],
        },
      });
      return action;
    } catch (err) {
      if (isUniqueConstraintError(err)) return null;
      throw err;
    }
  }

  // AUTOPILOT (or an approved action being force-executed). Manual actions
  // skip the AI guardrails entirely — see isManual above.
  const safety: SafetyCheckResult = isManual
    ? { allowed: true }
    : await checkActionSafety({
        organizationId: input.organizationId,
        entityType: input.entityType,
        entityId: input.entityId,
        adAccountId: entity.adAccountId,
        actionType: input.actionType,
        currentBudget: entity.budget,
        proposedBudget,
        proposedIncreasePercent: input.actionParams?.percent
          ? input.actionType.startsWith("DECREASE")
            ? -input.actionParams.percent
            : input.actionParams.percent
          : null,
      });

  if (!safety.allowed) {
    try {
      const action = await prisma.automationAction.create({
        data: {
          ...baseRecord,
          status: "BLOCKED",
          blockedReason: safety.blockedReason,
          after: before as never,
        },
      });
      await writeAudit(
        input.organizationId,
        input.entityType,
        input.entityId,
        input.actionType,
        before,
        before,
        `${input.reason} — BLOCKED: ${safety.blockedReason}`,
        input.ruleId,
        "BLOCKED",
        input.actorUserId,
      );
      return action;
    } catch (err) {
      if (isUniqueConstraintError(err)) return null;
      throw err;
    }
  }

  const adapter = new MetaAdsAdapter(entity.accessToken);
  let after: { status: string; budget: number | null } = { ...before };

  try {
    switch (input.actionType) {
      case "PAUSE":
        await adapter.setStatus(entity.externalId, "PAUSED");
        after = { ...before, status: "PAUSED" };
        break;
      case "RESUME":
        await adapter.setStatus(entity.externalId, "ACTIVE");
        after = { ...before, status: "ACTIVE" };
        break;
      case "INCREASE_BUDGET_PERCENT":
      case "DECREASE_BUDGET_PERCENT":
      case "INCREASE_BUDGET_FIXED":
      case "DECREASE_BUDGET_FIXED": {
        if (proposedBudget === null) throw new Error("No budget to modify on this entity.");
        await adapter.setDailyBudget(entity.externalId, proposedBudget);
        after = { ...before, budget: proposedBudget };
        break;
      }
      case "DUPLICATE": {
        if (input.entityType === "CAMPAIGN") {
          await adapter.duplicateCampaign(entity.externalId, entity.adAccountExternalId);
        } else if (input.entityType === "AD_SET") {
          await adapter.duplicateAdSet(entity.externalId);
        } else {
          await adapter.duplicateAd(entity.externalId);
        }
        break;
      }
      case "SEND_ALERT":
        await prisma.alert.create({
          data: {
            organizationId: input.organizationId,
            type: "BUDGET_NEAR_LIMIT",
            severity: "INFO",
            title: input.ruleName ?? "Automation alert",
            message: input.reason,
            entityType: input.entityType,
            entityId: input.entityId,
            channels: ["IN_APP"],
          },
        });
        break;
      case "ADD_TAG":
        // Tags are stored locally only — Meta has no generic tagging edge for these entities.
        break;
    }
  } catch (err) {
    const message =
      err instanceof MetaFeatureUnavailableError
        ? `Feature unavailable: ${err.message}`
        : err instanceof MetaApiError
          ? `Meta API error: ${err.message}`
          : err instanceof Error
            ? err.message
            : "Unknown error";

    try {
      const action = await prisma.automationAction.create({
        data: { ...baseRecord, status: "FAILED", blockedReason: message, after: before as never },
      });
      await writeAudit(
        input.organizationId,
        input.entityType,
        input.entityId,
        input.actionType,
        before,
        before,
        `${input.reason} — FAILED: ${message}`,
        input.ruleId,
        "FAILED",
        input.actorUserId,
      );
      return action;
    } catch (createErr) {
      if (isUniqueConstraintError(createErr)) return null;
      throw createErr;
    }
  }

  // Reflect the change locally so the UI doesn't wait for the next sync.
  if (input.entityType === "CAMPAIGN") {
    await prisma.campaign.update({
      where: { id: input.entityId },
      data: {
        status: after.status,
        dailyBudget: after.budget ?? undefined,
      },
    });
  } else if (input.entityType === "AD_SET") {
    await prisma.adSet.update({
      where: { id: input.entityId },
      data: {
        status: after.status,
        dailyBudget: after.budget ?? undefined,
      },
    });
  } else {
    await prisma.ad.update({ where: { id: input.entityId }, data: { status: after.status } });
  }

  let action;
  try {
    action = await prisma.automationAction.create({
      data: {
        ...baseRecord,
        status: "EXECUTED",
        executedAt: new Date(),
        after: after as never,
      },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) return null;
    throw err;
  }

  if (proposedBudget !== null && entity.budget !== null) {
    await prisma.budgetHistory.create({
      data: {
        adAccountId: entity.adAccountId,
        campaignId: input.entityType === "CAMPAIGN" ? input.entityId : null,
        adSetId: input.entityType === "AD_SET" ? input.entityId : null,
        previousBudget: entity.budget,
        newBudget: proposedBudget,
        changedBy: input.actorUserId ? `USER:${input.actorUserId}` : "AI",
        automationActionId: action.id,
      },
    });
  }

  await writeAudit(
    input.organizationId,
    input.entityType,
    input.entityId,
    input.actionType,
    before,
    after,
    input.reason,
    input.ruleId,
    "SUCCESS",
    input.actorUserId,
  );

  return action;
}

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}
