import { prisma } from "@/lib/prisma";
import { deriveMetrics, sumMetricInputs, type MetricInputs } from "@/services/automation/metrics";
import type { AlertSeverity, AlertType } from "@/generated/prisma/enums";
import { DAILY_HOUR } from "@/lib/constants";

function startOfDay(offsetDays = 0): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function campaignMetrics(campaignId: string, since: Date, until: Date): Promise<MetricInputs[]> {
  const rows = await prisma.insight.findMany({
    where: { campaignId, entityType: "CAMPAIGN", hour: DAILY_HOUR, date: { gte: since, lte: until } },
  });
  return rows.map((r) => ({
    spend: Number(r.spend),
    purchaseValue: Number(r.purchaseValue),
    purchases: r.purchases,
    impressions: r.impressions,
    clicks: r.clicks,
    linkClicks: r.linkClicks,
    addToCart: r.addToCart,
    initiateCheckout: r.initiateCheckout,
    frequency: Number(r.frequency),
  }));
}

async function createAlertIfNew(
  organizationId: string,
  type: AlertType,
  severity: AlertSeverity,
  title: string,
  message: string,
  entityId?: string,
) {
  const existing = await prisma.alert.findFirst({
    where: { organizationId, type, entityId, createdAt: { gte: startOfDay() } },
  });
  if (existing) return;
  await prisma.alert.create({
    data: { organizationId, type, severity, title, message, entityId, entityType: entityId ? "CAMPAIGN" : undefined },
  });
}

/**
 * Threshold-based alert scan (spec section 15). Every alert here is
 * triggered by a disclosed comparison against real synced numbers — never a
 * model guess. Intended to run from the alerts-generation worker after each
 * sync + rule evaluation pass.
 */
export async function generateAlertsForOrganization(organizationId: string) {
  const settings = await prisma.safetySettings.findUnique({ where: { organizationId } });

  // Connection-level errors.
  const connections = await prisma.metaConnection.findMany({ where: { organizationId } });
  for (const conn of connections) {
    if (conn.status === "ERROR" || conn.status === "EXPIRED") {
      await createAlertIfNew(
        organizationId,
        "META_API_ERROR",
        "CRITICAL",
        "Meta connection needs attention",
        conn.lastError ?? `Connection status is ${conn.status}. Reconnect in Settings.`,
      );
    }
  }

  const campaigns = await prisma.campaign.findMany({
    where: { adAccount: { metaConnection: { organizationId } }, status: "ACTIVE" },
  });

  for (const campaign of campaigns) {
    const today = await campaignMetrics(campaign.id, startOfDay(), startOfDay(1));
    const trailing7 = await campaignMetrics(campaign.id, startOfDay(-7), startOfDay());

    const todayMetrics = deriveMetrics(sumMetricInputs(today));
    const avg7Inputs = sumMetricInputs(trailing7);
    const avg7 = deriveMetrics({
      ...avg7Inputs,
      spend: avg7Inputs.spend / 7,
      purchaseValue: avg7Inputs.purchaseValue / 7,
      purchases: avg7Inputs.purchases / 7,
      impressions: avg7Inputs.impressions / 7,
      clicks: avg7Inputs.clicks / 7,
      linkClicks: avg7Inputs.linkClicks / 7,
      addToCart: avg7Inputs.addToCart / 7,
      initiateCheckout: avg7Inputs.initiateCheckout / 7,
    });

    const minSpend = Number(settings?.roasGuardMinSpend ?? 1000);

    if (todayMetrics.spend >= minSpend && todayMetrics.purchases === 0) {
      await createAlertIfNew(
        organizationId,
        "NO_PURCHASE",
        "WARNING",
        `No purchases: ${campaign.name}`,
        `Spent ${todayMetrics.spend.toFixed(0)} THB today with 0 purchases.`,
        campaign.id,
      );
    }

    if (avg7.roas && todayMetrics.spend >= minSpend && todayMetrics.roas !== null && todayMetrics.roas < avg7.roas * 0.7) {
      await createAlertIfNew(
        organizationId,
        "ROAS_DROP",
        "WARNING",
        `ROAS dropping: ${campaign.name}`,
        `Today's ROAS (${todayMetrics.roas.toFixed(2)}x) is down more than 30% from the 7-day average (${avg7.roas.toFixed(2)}x).`,
        campaign.id,
      );
    }

    if (avg7.spend > 0 && todayMetrics.spend > avg7.spend * 1.5) {
      await createAlertIfNew(
        organizationId,
        "SPEND_SPIKE",
        "WARNING",
        `Spend spike: ${campaign.name}`,
        `Today's spend (${todayMetrics.spend.toFixed(0)} THB) is over 1.5x the 7-day average (${avg7.spend.toFixed(0)} THB).`,
        campaign.id,
      );
    }

    if (
      avg7.purchases > 2 &&
      todayMetrics.spend >= avg7.spend * 0.7 &&
      todayMetrics.purchases < avg7.purchases * 0.3
    ) {
      await createAlertIfNew(
        organizationId,
        "PURCHASE_DROP",
        "CRITICAL",
        `Possible tracking issue: ${campaign.name}`,
        `Purchases (${todayMetrics.purchases}) are far below the 7-day average (${avg7.purchases.toFixed(1)}) despite similar spend — check pixel/CAPI health in Tracking Health.`,
        campaign.id,
      );
    }
  }

  if (settings) {
    const active = await prisma.campaign.findMany({
      where: { adAccount: { metaConnection: { organizationId } }, status: "ACTIVE" },
      select: { dailyBudget: true },
    });
    const totalDailyBudget = active.reduce((sum, c) => sum + Number(c.dailyBudget ?? 0), 0);
    const cap = Number(settings.maxAccountDailySpend);
    if (cap > 0 && totalDailyBudget / cap >= 0.9) {
      await createAlertIfNew(
        organizationId,
        "BUDGET_NEAR_LIMIT",
        "WARNING",
        "Account budget nearly reached",
        `Active campaign budgets total ${totalDailyBudget.toFixed(0)} THB/day — ${((totalDailyBudget / cap) * 100).toFixed(0)}% of your ${cap.toFixed(0)} THB/day max account spend.`,
      );
    }
  }
}
