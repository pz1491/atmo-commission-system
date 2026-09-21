import { prisma } from "@/lib/prisma";
import { deriveMetrics, sumMetricInputs } from "@/services/automation/metrics";
import { scoreWinner } from "@/services/automation/winnerScore";
import { DAILY_HOUR } from "@/lib/constants";

function startOfDay(offsetDays = 0): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Generates yesterday's Daily Summary (spec section 21) as a Report row. */
export async function generateDailyReport(organizationId: string) {
  const yesterdayStart = startOfDay(-1);
  const todayStart = startOfDay(0);

  const insights = await prisma.insight.findMany({
    where: {
      entityType: "CAMPAIGN",
      hour: DAILY_HOUR,
      date: { gte: yesterdayStart, lt: todayStart },
      campaign: { adAccount: { metaConnection: { organizationId } } },
    },
    include: { campaign: true },
  });

  const totals = deriveMetrics(
    sumMetricInputs(
      insights.map((r) => ({
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
    ),
  );

  const byCampaign = new Map<string, typeof insights>();
  for (const row of insights) {
    const list = byCampaign.get(row.campaignId!) ?? [];
    list.push(row);
    byCampaign.set(row.campaignId!, list);
  }

  const winners: Array<{ name: string; roas: number }> = [];
  const losers: Array<{ name: string; roas: number }> = [];
  for (const [, rows] of byCampaign) {
    const m = deriveMetrics(
      sumMetricInputs(
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
      ),
    );
    const score = scoreWinner(m, []);
    const name = rows[0].campaign?.name ?? "Unknown";
    if (score.status === "HOT_WINNER" || score.status === "WINNER") {
      winners.push({ name, roas: m.roas ?? 0 });
    } else if (score.status === "LOSING") {
      losers.push({ name, roas: m.roas ?? 0 });
    }
  }

  const [pausedByAi, scaledByAi, riskAlerts] = await Promise.all([
    prisma.automationAction.count({
      where: {
        organizationId,
        actionType: "PAUSE",
        status: "EXECUTED",
        executedAt: { gte: yesterdayStart, lt: todayStart },
      },
    }),
    prisma.automationAction.count({
      where: {
        organizationId,
        actionType: { in: ["INCREASE_BUDGET_PERCENT", "INCREASE_BUDGET_FIXED"] },
        status: "EXECUTED",
        executedAt: { gte: yesterdayStart, lt: todayStart },
      },
    }),
    prisma.alert.findMany({
      where: { organizationId, createdAt: { gte: yesterdayStart, lt: todayStart } },
      select: { type: true, title: true, severity: true },
    }),
  ]);

  const data = {
    spend: totals.spend,
    revenue: totals.purchaseValue,
    purchases: totals.purchases,
    roas: totals.roas,
    pausedByAi,
    scaledByAi,
    winners,
    losers,
    riskAlerts,
  };

  return prisma.report.create({
    data: {
      organizationId,
      type: "DAILY_SUMMARY",
      periodStart: yesterdayStart,
      periodEnd: todayStart,
      data: data as never,
    },
  });
}
