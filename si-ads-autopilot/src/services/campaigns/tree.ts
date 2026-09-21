import { prisma } from "@/lib/prisma";
import { deriveMetrics, type MetricInputs } from "@/services/automation/metrics";
import { DAILY_HOUR } from "@/lib/constants";

function startOfDay(): Date {
  const d = new Date();
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

const ZERO: MetricInputs = {
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

export async function getCampaignTree(organizationId: string) {
  const [campaigns, todaysInsights] = await Promise.all([
    prisma.campaign.findMany({
      where: { adAccount: { metaConnection: { organizationId } } },
      orderBy: { name: "asc" },
      include: {
        adSets: {
          orderBy: { name: "asc" },
          include: { ads: { orderBy: { name: "asc" } } },
        },
      },
    }),
    prisma.insight.findMany({
      where: {
        hour: DAILY_HOUR,
        date: { gte: startOfDay() },
        campaign: { adAccount: { metaConnection: { organizationId } } },
      },
    }),
  ]);

  const metricsByEntity = new Map<string, MetricInputs>();
  for (const row of todaysInsights) {
    const id = row.adId ?? row.adSetId ?? row.campaignId;
    if (!id) continue;
    metricsByEntity.set(id, toInputs(row));
  }

  const metricsFor = (id: string) => deriveMetrics(metricsByEntity.get(id) ?? ZERO);

  return campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    dailyBudget: c.dailyBudget ? Number(c.dailyBudget) : null,
    metrics: metricsFor(c.id),
    adSets: c.adSets.map((as) => ({
      id: as.id,
      name: as.name,
      status: as.status,
      dailyBudget: as.dailyBudget ? Number(as.dailyBudget) : null,
      metrics: metricsFor(as.id),
      ads: as.ads.map((ad) => ({
        id: ad.id,
        name: ad.name,
        status: ad.status,
        metrics: metricsFor(ad.id),
      })),
    })),
  }));
}

export type CampaignTree = Awaited<ReturnType<typeof getCampaignTree>>;
