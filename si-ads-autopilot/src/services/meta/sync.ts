import { prisma } from "@/lib/prisma";
import { MetaAdsAdapter } from "./adapter";
import { MetaApiError } from "./types";
import { DAILY_HOUR } from "@/lib/constants";

function toDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/**
 * Full sync for one ad account: campaigns -> ad sets -> ads -> creatives,
 * then trailing-30-day daily insights at every level. Every write here
 * comes straight from a Graph API response — nothing is synthesized.
 */
export async function syncAdAccount(adAccountId: string): Promise<{ synced: boolean; error?: string }> {
  const adAccount = await prisma.adAccount.findUniqueOrThrow({
    where: { id: adAccountId },
    include: { metaConnection: true },
  });

  const adapter = new MetaAdsAdapter(adAccount.metaConnection.accessToken);
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);
  const sinceStr = since.toISOString().slice(0, 10);
  const untilStr = new Date().toISOString().slice(0, 10);

  try {
    const campaigns = await adapter.listCampaigns(adAccount.externalId);

    for (const c of campaigns) {
      const campaign = await prisma.campaign.upsert({
        where: { externalId: c.externalId },
        create: {
          adAccountId: adAccount.id,
          externalId: c.externalId,
          name: c.name,
          objective: c.objective,
          status: c.status,
          dailyBudget: c.dailyBudget,
          lifetimeBudget: c.lifetimeBudget,
          budgetCap: c.budgetCap,
          metaCreatedAt: c.createdTime ? new Date(c.createdTime) : null,
          lastSyncedAt: new Date(),
        },
        update: {
          name: c.name,
          objective: c.objective,
          status: c.status,
          dailyBudget: c.dailyBudget,
          lifetimeBudget: c.lifetimeBudget,
          budgetCap: c.budgetCap,
          lastSyncedAt: new Date(),
        },
      });

      const campaignInsights = await adapter.getInsights(
        c.externalId,
        "CAMPAIGN",
        sinceStr,
        untilStr,
      );
      for (const insight of campaignInsights) {
        await upsertInsight("CAMPAIGN", { campaignId: campaign.id }, insight);
      }

      // Trailing 7-day hourly breakdown, campaign level only — feeds the
      // Dayparting heatmap (spec section 9). Kept to a short window since
      // hourly rows are 24x the volume of daily ones.
      const hourlySince = new Date();
      hourlySince.setUTCDate(hourlySince.getUTCDate() - 7);
      const hourlyInsights = await adapter.getInsights(
        c.externalId,
        "CAMPAIGN",
        hourlySince.toISOString().slice(0, 10),
        untilStr,
        true,
      );
      for (const insight of hourlyInsights) {
        await upsertInsight("CAMPAIGN", { campaignId: campaign.id }, insight);
      }

      const adSets = await adapter.listAdSets(c.externalId);
      for (const as of adSets) {
        const adSet = await prisma.adSet.upsert({
          where: { externalId: as.externalId },
          create: {
            campaignId: campaign.id,
            externalId: as.externalId,
            name: as.name,
            status: as.status,
            dailyBudget: as.dailyBudget,
            lifetimeBudget: as.lifetimeBudget,
            optimizationGoal: as.optimizationGoal,
            targeting: as.targeting as never,
            lastSyncedAt: new Date(),
          },
          update: {
            name: as.name,
            status: as.status,
            dailyBudget: as.dailyBudget,
            lifetimeBudget: as.lifetimeBudget,
            optimizationGoal: as.optimizationGoal,
            targeting: as.targeting as never,
            lastSyncedAt: new Date(),
          },
        });

        const adSetInsights = await adapter.getInsights(
          as.externalId,
          "AD_SET",
          sinceStr,
          untilStr,
        );
        for (const insight of adSetInsights) {
          await upsertInsight("AD_SET", { adSetId: adSet.id }, insight);
        }

        const ads = await adapter.listAds(as.externalId);
        for (const ad of ads) {
          const adRecord = await prisma.ad.upsert({
            where: { externalId: ad.externalId },
            create: {
              adSetId: adSet.id,
              externalId: ad.externalId,
              name: ad.name,
              status: ad.status,
              lastSyncedAt: new Date(),
            },
            update: { name: ad.name, status: ad.status, lastSyncedAt: new Date() },
          });

          if (ad.creative) {
            await prisma.creative.upsert({
              where: { adId: adRecord.id },
              create: {
                adId: adRecord.id,
                externalId: ad.creative.externalId,
                thumbnailUrl: ad.creative.thumbnailUrl,
                headline: ad.creative.headline,
                body: ad.creative.body,
                videoUrl: ad.creative.videoUrl,
              },
              update: {
                thumbnailUrl: ad.creative.thumbnailUrl,
                headline: ad.creative.headline,
                body: ad.creative.body,
                videoUrl: ad.creative.videoUrl,
              },
            });
          }

          const adInsights = await adapter.getInsights(ad.externalId, "AD", sinceStr, untilStr);
          for (const insight of adInsights) {
            await upsertInsight("AD", { adId: adRecord.id }, insight);
          }
        }
      }
    }

    await prisma.adAccount.update({
      where: { id: adAccount.id },
      data: { lastSyncedAt: new Date(), syncStatus: "FRESH" },
    });
    await prisma.metaConnection.update({
      where: { id: adAccount.metaConnectionId },
      data: { lastSyncedAt: new Date(), status: "CONNECTED", lastError: null },
    });

    return { synced: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown sync error";
    await prisma.adAccount.update({
      where: { id: adAccount.id },
      data: { syncStatus: "ERROR" },
    });
    if (err instanceof MetaApiError && err.isTokenError) {
      await prisma.metaConnection.update({
        where: { id: adAccount.metaConnectionId },
        data: { status: "EXPIRED", lastError: message },
      });
    } else {
      await prisma.metaConnection.update({
        where: { id: adAccount.metaConnectionId },
        data: { lastError: message },
      });
    }
    return { synced: false, error: message };
  }
}

async function upsertInsight(
  entityType: "CAMPAIGN" | "AD_SET" | "AD",
  keys: { campaignId?: string; adSetId?: string; adId?: string },
  insight: Awaited<ReturnType<MetaAdsAdapter["getInsights"]>>[number],
) {
  const entityId = (keys.campaignId ?? keys.adSetId ?? keys.adId)!;
  const hour = insight.hour ?? DAILY_HOUR;

  await prisma.insight.upsert({
    where: {
      entityType_entityId_date_hour: {
        entityType,
        entityId,
        date: toDateOnly(insight.date),
        hour,
      },
    },
    create: {
      entityType,
      entityId,
      ...keys,
      date: toDateOnly(insight.date),
      hour,
      spend: insight.spend,
      impressions: insight.impressions,
      reach: insight.reach,
      clicks: insight.clicks,
      linkClicks: insight.linkClicks,
      landingPageViews: insight.landingPageViews,
      addToCart: insight.addToCart,
      initiateCheckout: insight.initiateCheckout,
      purchases: insight.purchases,
      purchaseValue: insight.purchaseValue,
      frequency: insight.frequency,
      qualityRanking: insight.qualityRanking,
      engagementRateRanking: insight.engagementRateRanking,
      conversionRateRanking: insight.conversionRateRanking,
      syncedAt: new Date(),
    },
    update: {
      spend: insight.spend,
      impressions: insight.impressions,
      reach: insight.reach,
      clicks: insight.clicks,
      linkClicks: insight.linkClicks,
      landingPageViews: insight.landingPageViews,
      addToCart: insight.addToCart,
      initiateCheckout: insight.initiateCheckout,
      purchases: insight.purchases,
      purchaseValue: insight.purchaseValue,
      frequency: insight.frequency,
      qualityRanking: insight.qualityRanking,
      engagementRateRanking: insight.engagementRateRanking,
      conversionRateRanking: insight.conversionRateRanking,
      syncedAt: new Date(),
    },
  });
}

export async function syncAllAdAccountsForOrganization(organizationId: string) {
  const accounts = await prisma.adAccount.findMany({
    where: { metaConnection: { organizationId } },
    select: { id: true },
  });
  const results = [];
  for (const acc of accounts) {
    results.push({ adAccountId: acc.id, ...(await syncAdAccount(acc.id)) });
  }
  return results;
}
