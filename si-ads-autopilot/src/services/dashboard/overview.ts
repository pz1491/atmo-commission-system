import { prisma } from "@/lib/prisma";
import { deriveMetrics, sumMetricInputs, type MetricInputs } from "@/services/automation/metrics";
import { DAILY_HOUR } from "@/lib/constants";

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

async function dailyRollupsForOrg(
  organizationId: string,
  since: Date,
  until: Date,
): Promise<Map<string, MetricInputs>> {
  const rows = await prisma.insight.findMany({
    where: {
      hour: DAILY_HOUR,
      date: { gte: since, lte: until },
      campaign: { adAccount: { metaConnection: { organizationId } } },
      entityType: "CAMPAIGN",
    },
    select: {
      date: true,
      spend: true,
      purchaseValue: true,
      purchases: true,
      impressions: true,
      clicks: true,
      linkClicks: true,
      addToCart: true,
      initiateCheckout: true,
      frequency: true,
    },
  });

  const byDay = new Map<string, MetricInputs[]>();
  for (const r of rows) {
    const key = dayKey(r.date);
    const list = byDay.get(key) ?? [];
    list.push({
      spend: Number(r.spend),
      purchaseValue: Number(r.purchaseValue),
      purchases: r.purchases,
      impressions: r.impressions,
      clicks: r.clicks,
      linkClicks: r.linkClicks,
      addToCart: r.addToCart,
      initiateCheckout: r.initiateCheckout,
      frequency: Number(r.frequency),
    });
    byDay.set(key, list);
  }

  const result = new Map<string, MetricInputs>();
  for (const [key, list] of byDay) {
    result.set(key, sumMetricInputs(list));
  }
  return result;
}

const EMPTY_INPUTS: MetricInputs = {
  spend: 0,
  purchaseValue: 0,
  purchases: 0,
  impressions: 0,
  clicks: 0,
  linkClicks: 0,
  addToCart: 0,
  initiateCheckout: 0,
  frequency: 0,
};

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export async function getOverviewData(organizationId: string, rangeDays: number) {
  const today = startOfDay(new Date());
  const rangeStart = new Date(today);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - (rangeDays - 1));

  // Fetch a wider window so we can compute 7d/30d comparison baselines too.
  const historyStart = new Date(today);
  historyStart.setUTCDate(historyStart.getUTCDate() - 30);

  const rollups = await dailyRollupsForOrg(organizationId, historyStart, today);

  const todayInputs = rollups.get(dayKey(today)) ?? EMPTY_INPUTS;
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayInputs = rollups.get(dayKey(yesterday)) ?? EMPTY_INPUTS;

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - (i + 1));
    return rollups.get(dayKey(d)) ?? EMPTY_INPUTS;
  });
  const last30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - (i + 1));
    return rollups.get(dayKey(d)) ?? EMPTY_INPUTS;
  });

  const avg7 = sumMetricInputs(last7);
  const avg30 = sumMetricInputs(last30);
  for (const key of Object.keys(avg7) as (keyof MetricInputs)[]) {
    if (key !== "frequency") avg7[key] = avg7[key] / 7;
  }
  for (const key of Object.keys(avg30) as (keyof MetricInputs)[]) {
    if (key !== "frequency") avg30[key] = avg30[key] / 30;
  }

  const chartDays = Array.from({ length: rangeDays }, (_, i) => {
    const d = new Date(rangeStart);
    d.setUTCDate(d.getUTCDate() + i);
    const inputs = rollups.get(dayKey(d)) ?? EMPTY_INPUTS;
    return {
      date: dayKey(d),
      spend: Math.round(inputs.spend),
      revenue: Math.round(inputs.purchaseValue),
    };
  });

  const [activeCampaigns, adsPausedToday, budgetDecreasesToday, pausedEntitiesToday] =
    await Promise.all([
      prisma.campaign.count({
        where: { adAccount: { metaConnection: { organizationId } }, status: "ACTIVE" },
      }),
      prisma.automationAction.count({
        where: {
          organizationId,
          actionType: "PAUSE",
          status: "EXECUTED",
          executedAt: { gte: today },
        },
      }),
      prisma.budgetHistory.findMany({
        where: {
          adAccount: { metaConnection: { organizationId } },
          createdAt: { gte: today },
          changedBy: "AI",
        },
      }),
      prisma.automationAction.findMany({
        where: {
          organizationId,
          actionType: "PAUSE",
          status: "EXECUTED",
          executedAt: { gte: today },
        },
        include: { campaign: true, adSet: true },
      }),
    ]);

  const budgetSavedFromDecreases = budgetDecreasesToday.reduce((sum, h) => {
    const diff = Number(h.previousBudget) - Number(h.newBudget);
    return diff > 0 ? sum + diff : sum;
  }, 0);
  const budgetSavedFromPauses = pausedEntitiesToday.reduce((sum, action) => {
    const budget = action.campaign?.dailyBudget ?? action.adSet?.dailyBudget ?? 0;
    return sum + Number(budget);
  }, 0);

  return {
    today: deriveMetrics(todayInputs),
    changeVsYesterday: {
      spend: pctChange(todayInputs.spend, yesterdayInputs.spend),
      revenue: pctChange(todayInputs.purchaseValue, yesterdayInputs.purchaseValue),
      purchases: pctChange(todayInputs.purchases, yesterdayInputs.purchases),
    },
    changeVs7d: {
      spend: pctChange(todayInputs.spend, avg7.spend),
      revenue: pctChange(todayInputs.purchaseValue, avg7.purchaseValue),
    },
    changeVs30d: {
      spend: pctChange(todayInputs.spend, avg30.spend),
      revenue: pctChange(todayInputs.purchaseValue, avg30.purchaseValue),
    },
    activeCampaigns,
    adsPausedToday,
    budgetSavedToday: budgetSavedFromDecreases + budgetSavedFromPauses,
    chartData: chartDays,
    hasAnyData: rollups.size > 0,
  };
}
