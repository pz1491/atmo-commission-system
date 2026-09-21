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

export interface CreativeRow {
  adId: string;
  name: string;
  thumbnailUrl: string | null;
  headline: string | null;
  status: string;
  spend: number;
  purchases: number;
  cpa: number | null;
  roas: number | null;
  ctr: number | null;
  frequency: number;
  fatigueDetected: boolean;
}

/** Creative Fatigue Detection (spec section 10): frequency up + CTR down + CPA up, all at once, vs a 7-day baseline. */
export async function getCreativePerformance(organizationId: string): Promise<CreativeRow[]> {
  const ads = await prisma.ad.findMany({
    where: { adSet: { campaign: { adAccount: { metaConnection: { organizationId } } } } },
    include: { creative: true },
  });

  const rows: CreativeRow[] = [];
  for (const ad of ads) {
    const [todayInsights, baselineInsights] = await Promise.all([
      prisma.insight.findMany({
        where: { adId: ad.id, entityType: "AD", hour: DAILY_HOUR, date: { gte: startOfDay(-2) } },
      }),
      prisma.insight.findMany({
        where: {
          adId: ad.id,
          entityType: "AD",
          hour: DAILY_HOUR,
          date: { gte: startOfDay(-9), lt: startOfDay(-2) },
        },
      }),
    ]);
    if (todayInsights.length === 0) continue;

    const recent = deriveMetrics(sumMetricInputs(todayInsights.map(toInputs)));
    const baseline =
      baselineInsights.length > 0 ? deriveMetrics(sumMetricInputs(baselineInsights.map(toInputs))) : null;

    const fatigueDetected = Boolean(
      baseline &&
        recent.frequency > baseline.frequency * 1.15 &&
        recent.ctr !== null &&
        baseline.ctr !== null &&
        recent.ctr < baseline.ctr * 0.85 &&
        recent.cpa !== null &&
        baseline.cpa !== null &&
        recent.cpa > baseline.cpa * 1.15,
    );

    rows.push({
      adId: ad.id,
      name: ad.name,
      thumbnailUrl: ad.creative?.thumbnailUrl ?? null,
      headline: ad.creative?.headline ?? ad.creative?.hook ?? null,
      status: ad.status,
      spend: recent.spend,
      purchases: recent.purchases,
      cpa: recent.cpa,
      roas: recent.roas,
      ctr: recent.ctr,
      frequency: recent.frequency,
      fatigueDetected,
    });
  }

  return rows;
}
