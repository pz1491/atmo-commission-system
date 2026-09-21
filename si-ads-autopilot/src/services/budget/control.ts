import { prisma } from "@/lib/prisma";
import { deriveMetrics, sumMetricInputs, type MetricInputs } from "@/services/automation/metrics";
import { DAILY_HOUR } from "@/lib/constants";

function startOfDay(offsetDays = 0): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function toInputs(row: {
  spend: unknown;
  purchaseValue: unknown;
  purchases: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  addToCart: number;
  initiateCheckout: number;
  frequency: unknown;
}): MetricInputs {
  return {
    spend: Number(row.spend),
    purchaseValue: Number(row.purchaseValue),
    purchases: row.purchases,
    impressions: row.impressions,
    clicks: row.clicks,
    linkClicks: row.linkClicks,
    addToCart: row.addToCart,
    initiateCheckout: row.initiateCheckout,
    frequency: Number(row.frequency),
  };
}

export async function getBudgetControlData(organizationId: string) {
  const [campaigns, settings, todayRows, historyRows, daysWithData] = await Promise.all([
    prisma.campaign.findMany({
      where: { adAccount: { metaConnection: { organizationId } }, status: "ACTIVE" },
      select: { id: true, name: true, dailyBudget: true },
    }),
    prisma.safetySettings.findUnique({ where: { organizationId } }),
    prisma.insight.findMany({
      where: {
        entityType: "CAMPAIGN",
        hour: DAILY_HOUR,
        date: { gte: startOfDay() },
        campaign: { adAccount: { metaConnection: { organizationId } } },
      },
    }),
    prisma.insight.findMany({
      where: {
        entityType: "CAMPAIGN",
        hour: DAILY_HOUR,
        date: { gte: startOfDay(-7), lt: startOfDay() },
        campaign: { adAccount: { metaConnection: { organizationId } } },
      },
    }),
    prisma.insight.groupBy({
      by: ["date"],
      where: {
        entityType: "CAMPAIGN",
        hour: DAILY_HOUR,
        campaign: { adAccount: { metaConnection: { organizationId } } },
      },
    }),
  ]);

  const totalDailyBudget = campaigns.reduce((sum, c) => sum + Number(c.dailyBudget ?? 0), 0);
  const spendToday = todayRows.reduce((sum, r) => sum + Number(r.spend), 0);

  const now = new Date();
  const fractionOfDayElapsed = Math.max(
    (now.getUTCHours() * 60 + now.getUTCMinutes()) / (24 * 60),
    0.02,
  );
  const projectedSpend = spendToday / fractionOfDayElapsed;

  const historyMetrics = deriveMetrics(sumMetricInputs(historyRows.map(toInputs)));
  const expectedRoas = historyMetrics.roas;
  const expectedRevenue = expectedRoas ? projectedSpend * expectedRoas : null;

  const dataPoints = daysWithData.length;
  const confidence = dataPoints < 3 ? "Low" : dataPoints < 14 ? "Medium" : "High";

  return {
    totalDailyBudget,
    spendToday,
    projectedSpend,
    remainingBudget: Math.max(totalDailyBudget - spendToday, 0),
    accountSpendCap: settings ? Number(settings.maxAccountDailySpend) : null,
    campaignSpendCap: settings ? Number(settings.maxCampaignDailyBudget) : null,
    expectedRevenue,
    expectedRoas,
    confidence,
    campaigns: campaigns.map((c) => ({ id: c.id, name: c.name, dailyBudget: Number(c.dailyBudget ?? 0) })),
  };
}
