import { prisma } from "@/lib/prisma";
import { sumMetricInputs } from "@/services/automation/metrics";
import { DAILY_HOUR } from "@/lib/constants";

function startOfDay(offsetDays = 0): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Tracking Health (spec section 16) — Meta-side signals only; no external order source is connected. */
export async function getTrackingHealth(organizationId: string) {
  const [adAccounts, todayRows, avgRows] = await Promise.all([
    prisma.adAccount.findMany({
      where: { metaConnection: { organizationId } },
      include: { metaConnection: true },
    }),
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
  ]);

  const today = sumMetricInputs(
    todayRows.map((r) => ({
      spend: Number(r.spend),
      purchaseValue: Number(r.purchaseValue),
      purchases: r.purchases,
      impressions: r.impressions,
      clicks: r.clicks,
      linkClicks: r.linkClicks,
      addToCart: r.addToCart,
      initiateCheckout: r.initiateCheckout,
      frequency: 0,
    })),
  );
  const avg7 = sumMetricInputs(
    avgRows.map((r) => ({
      spend: Number(r.spend),
      purchaseValue: Number(r.purchaseValue),
      purchases: r.purchases,
      impressions: r.impressions,
      clicks: r.clicks,
      linkClicks: r.linkClicks,
      addToCart: r.addToCart,
      initiateCheckout: r.initiateCheckout,
      frequency: 0,
    })),
  );
  const avgPurchasesPerDay = avg7.purchases / 7;

  const anomaly =
    avgPurchasesPerDay > 2 && today.spend >= (avg7.spend / 7) * 0.7 && today.purchases < avgPurchasesPerDay * 0.3;

  return {
    accounts: adAccounts.map((a) => ({
      id: a.id,
      name: a.name,
      pixelId: a.pixelId,
      connectionStatus: a.metaConnection.status,
      syncStatus: a.syncStatus,
    })),
    todayPurchases: today.purchases,
    avgPurchasesPerDay,
    todayAddToCart: today.addToCart,
    todayInitiateCheckout: today.initiateCheckout,
    anomalyDetected: anomaly,
  };
}
