import { prisma } from "@/lib/prisma";
import { deriveMetrics, sumMetricInputs, type MetricInputs } from "@/services/automation/metrics";
import { DAILY_HOUR } from "@/lib/constants";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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

export interface HeatmapCell {
  day: number; // 0 = Sunday
  dayName: string;
  hour: number;
  roas: number | null;
  cpa: number | null;
  purchases: number;
  spend: number;
  revenue: number;
  classification: "PROFITABLE" | "NEUTRAL" | "POOR" | "NO_DATA";
}

/**
 * Builds the Dayparting heatmap (spec section 9) from real hourly Insight
 * rows synced over the trailing window (see sync.ts). Classification uses
 * the org's own ROAS Guard target/break-even thresholds — never a
 * hardcoded opinion of what's "good".
 */
export async function getDaypartingHeatmap(organizationId: string): Promise<HeatmapCell[]> {
  const [rows, settings] = await Promise.all([
    prisma.insight.findMany({
      where: {
        entityType: "CAMPAIGN",
        hour: { not: DAILY_HOUR },
        campaign: { adAccount: { metaConnection: { organizationId } } },
      },
    }),
    prisma.safetySettings.findUnique({ where: { organizationId } }),
  ]);

  const targetRoas = settings ? Number(settings.roasGuardTargetRoas) : 3;
  const breakEvenRoas = settings ? Number(settings.roasGuardBreakEvenRoas) : 2.2;

  const buckets = new Map<string, MetricInputs[]>();
  for (const row of rows) {
    const day = row.date.getUTCDay();
    const key = `${day}:${row.hour}`;
    const list = buckets.get(key) ?? [];
    list.push(toInputs(row));
    buckets.set(key, list);
  }

  const cells: HeatmapCell[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const list = buckets.get(`${day}:${hour}`);
      if (!list || list.length === 0) {
        cells.push({
          day,
          dayName: DAY_NAMES[day],
          hour,
          roas: null,
          cpa: null,
          purchases: 0,
          spend: 0,
          revenue: 0,
          classification: "NO_DATA",
        });
        continue;
      }
      const m = deriveMetrics(sumMetricInputs(list));
      const classification: HeatmapCell["classification"] =
        m.roas === null
          ? "NO_DATA"
          : m.roas >= targetRoas
            ? "PROFITABLE"
            : m.roas >= breakEvenRoas
              ? "NEUTRAL"
              : "POOR";

      cells.push({
        day,
        dayName: DAY_NAMES[day],
        hour,
        roas: m.roas,
        cpa: m.cpa,
        purchases: m.purchases,
        spend: m.spend,
        revenue: m.purchaseValue,
        classification,
      });
    }
  }

  return cells;
}
