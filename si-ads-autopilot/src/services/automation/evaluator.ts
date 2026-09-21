import { prisma } from "@/lib/prisma";
import type { EntityType } from "@/generated/prisma/enums";
import { deriveMetrics, sumMetricInputs, type MetricInputs } from "./metrics";
import { DAILY_HOUR } from "@/lib/constants";
import { evaluateConditions, describeCondition, type RuleCondition } from "./ruleEngine";
import { executeAutomationAction, type ActionParams } from "./execute";

function startOfTodayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function metricsForEntity(
  entityType: EntityType,
  entityId: string,
): Promise<MetricInputs> {
  const where =
    entityType === "CAMPAIGN"
      ? { campaignId: entityId, adSetId: null, adId: null }
      : entityType === "AD_SET"
        ? { adSetId: entityId, adId: null }
        : { adId: entityId };

  const rows = await prisma.insight.findMany({
    where: { ...where, date: { gte: startOfTodayUtc() }, hour: DAILY_HOUR },
  });

  return sumMetricInputs(
    rows.map((r) => ({
      spend: Number(r.spend),
      purchaseValue: Number(r.purchaseValue),
      purchases: r.purchases,
      impressions: r.impressions,
      clicks: r.clicks,
      linkClicks: r.linkClicks,
      addToCart: r.addToCart,
      initiateCheckout: r.initiateCheckout,
      frequency: Number(r.frequency),
    })),
  );
}

async function resolveTargetEntityIds(
  organizationId: string,
  targetType: EntityType,
  targetIds: string[] | null,
): Promise<string[]> {
  if (targetIds && targetIds.length > 0) return targetIds;

  if (targetType === "CAMPAIGN") {
    const rows = await prisma.campaign.findMany({
      where: { adAccount: { metaConnection: { organizationId } }, status: "ACTIVE" },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }
  if (targetType === "AD_SET") {
    const rows = await prisma.adSet.findMany({
      where: {
        campaign: { adAccount: { metaConnection: { organizationId } } },
        status: "ACTIVE",
      },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }
  const rows = await prisma.ad.findMany({
    where: {
      adSet: { campaign: { adAccount: { metaConnection: { organizationId } } } },
      status: "ACTIVE",
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/**
 * Evaluates every active AutomationRule for an organization against today's
 * synced metrics and executes (or simulates / queues for approval, per the
 * org's automation mode) any rule whose conditions match. Intended to run
 * from the rules-evaluation background worker on a fixed interval — never
 * from the browser.
 */
export async function evaluateRulesForOrganization(organizationId: string) {
  const rules = await prisma.automationRule.findMany({
    where: { organizationId, isActive: true },
    orderBy: { priority: "desc" },
  });

  const results: Array<{ ruleId: string; entityId: string; triggered: boolean }> = [];

  for (const rule of rules) {
    const entityIds = await resolveTargetEntityIds(
      organizationId,
      rule.targetType,
      (rule.targetIds as string[] | null) ?? null,
    );

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const triggersToday = await prisma.automationAction.count({
      where: {
        ruleId: rule.id,
        createdAt: { gte: startOfDay },
        status: { in: ["EXECUTED", "SIMULATED"] },
      },
    });
    if (triggersToday >= rule.maxTriggersPerDay) continue;

    for (const entityId of entityIds) {
      const cooldownSince = new Date(Date.now() - rule.cooldownHours * 60 * 60_000);
      const recentTrigger = await prisma.automationAction.findFirst({
        where: {
          ruleId: rule.id,
          status: { in: ["EXECUTED", "SIMULATED"] },
          createdAt: { gte: cooldownSince },
          ...(rule.targetType === "CAMPAIGN"
            ? { campaignId: entityId }
            : rule.targetType === "AD_SET"
              ? { adSetId: entityId }
              : { adId: entityId }),
        },
      });
      if (recentTrigger) continue;

      const inputs = await metricsForEntity(rule.targetType, entityId);
      const metrics = deriveMetrics(inputs);
      const conditions = rule.conditions as unknown as RuleCondition[];
      const matched = evaluateConditions(conditions, metrics);

      results.push({ ruleId: rule.id, entityId, triggered: matched });
      if (!matched) continue;

      const reason = conditions.map(describeCondition).join(" AND ");
      const params = (rule.actionParams as ActionParams | null) ?? undefined;

      await executeAutomationAction({
        organizationId,
        ruleId: rule.id,
        ruleName: rule.name,
        entityType: rule.targetType,
        entityId,
        actionType: rule.action,
        reason,
        actionParams: params,
      });
    }
  }

  return results;
}
