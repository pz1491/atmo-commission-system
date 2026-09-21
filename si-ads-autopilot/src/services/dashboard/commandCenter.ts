import { prisma } from "@/lib/prisma";

function startOfDay(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function getCommandCenterData(organizationId: string) {
  const [settings, lastSyncedAccount, todaysActionsCount, activeRules, budgetDecreases, pauses, recentActions] =
    await Promise.all([
      prisma.safetySettings.findUnique({ where: { organizationId } }),
      prisma.adAccount.findFirst({
        where: { metaConnection: { organizationId } },
        orderBy: { lastSyncedAt: "desc" },
        select: { lastSyncedAt: true },
      }),
      prisma.automationAction.count({
        where: { organizationId, status: "EXECUTED", executedAt: { gte: startOfDay() } },
      }),
      prisma.automationRule.count({ where: { organizationId, isActive: true } }),
      prisma.budgetHistory.findMany({
        where: { adAccount: { metaConnection: { organizationId } }, changedBy: "AI", createdAt: { gte: startOfDay() } },
      }),
      prisma.automationAction.findMany({
        where: {
          organizationId,
          actionType: "PAUSE",
          status: "EXECUTED",
          executedAt: { gte: startOfDay() },
        },
        include: { campaign: true, adSet: true },
      }),
      prisma.automationAction.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          campaign: { select: { name: true } },
          adSet: { select: { name: true } },
          ad: { select: { name: true } },
          rule: { select: { name: true } },
        },
      }),
    ]);

  const budgetSaved =
    budgetDecreases.reduce((sum, h) => {
      const diff = Number(h.previousBudget) - Number(h.newBudget);
      return diff > 0 ? sum + diff : sum;
    }, 0) +
    pauses.reduce((sum, a) => sum + Number(a.campaign?.dailyBudget ?? a.adSet?.dailyBudget ?? 0), 0);

  return {
    mode: settings?.automationMode ?? "OFF",
    killSwitchActive: settings?.killSwitchActive ?? false,
    lastScan: lastSyncedAccount?.lastSyncedAt ?? null,
    todaysActions: todaysActionsCount,
    activeRules,
    budgetSaved,
    feed: recentActions.map((a) => ({
      id: a.id,
      time: a.createdAt,
      entityName: a.campaign?.name ?? a.adSet?.name ?? a.ad?.name ?? "Unknown entity",
      actionType: a.actionType,
      status: a.status,
      reason: a.reason,
      ruleName: a.rule?.name ?? a.ruleTriggered ?? null,
      before: a.before as Record<string, unknown> | null,
      after: a.after as Record<string, unknown> | null,
      blockedReason: a.blockedReason,
    })),
  };
}
