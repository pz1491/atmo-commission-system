import { assertCapability } from "./capabilities";
import { metaFetch, metaFetchAllPages } from "./client";
import type {
  MetaAd,
  MetaAdSet,
  MetaCampaign,
  MetaInsight,
  MetaStatus,
} from "./types";

// ─── Raw Graph API shapes (kept private to this file) ──────────────────────

interface RawCampaign {
  id: string;
  name: string;
  objective?: string;
  status: MetaStatus;
  daily_budget?: string;
  lifetime_budget?: string;
  spend_cap?: string;
  created_time?: string;
}

interface RawAdSet {
  id: string;
  campaign_id: string;
  name: string;
  status: MetaStatus;
  daily_budget?: string;
  lifetime_budget?: string;
  optimization_goal?: string;
  targeting?: unknown;
  start_time?: string;
  end_time?: string;
}

interface RawAd {
  id: string;
  adset_id: string;
  name: string;
  status: MetaStatus;
  creative?: { id: string };
}

interface RawCreative {
  id: string;
  thumbnail_url?: string;
  title?: string;
  body?: string;
  object_story_spec?: {
    video_data?: { video_id?: string };
  };
}

interface RawAction {
  action_type: string;
  value: string;
}

interface RawInsight {
  date_start: string;
  hourly_stats_aggregated_by_advertiser_time_zone?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  inline_link_clicks?: string;
  frequency?: string;
  quality_ranking?: string;
  engagement_rate_ranking?: string;
  conversion_rate_ranking?: string;
  actions?: RawAction[];
  action_values?: RawAction[];
}

const CAMPAIGN_FIELDS =
  "id,name,objective,status,daily_budget,lifetime_budget,spend_cap,created_time";
const ADSET_FIELDS =
  "id,campaign_id,name,status,daily_budget,lifetime_budget,optimization_goal,targeting,start_time,end_time";
const AD_FIELDS = "id,adset_id,name,status,creative{id}";
const CREATIVE_FIELDS =
  "id,thumbnail_url,title,body,object_story_spec";
const INSIGHT_FIELDS =
  "date_start,spend,impressions,reach,clicks,inline_link_clicks,frequency,quality_ranking,engagement_rate_ranking,conversion_rate_ranking,actions,action_values";

function toNumber(value: string | undefined): number {
  return value ? Number.parseFloat(value) : 0;
}

function actionValue(actions: RawAction[] | undefined, type: string): number {
  return toNumber(actions?.find((a) => a.action_type === type)?.value);
}

function mapCampaign(raw: RawCampaign): MetaCampaign {
  return {
    externalId: raw.id,
    name: raw.name,
    objective: raw.objective ?? null,
    status: raw.status,
    dailyBudget: raw.daily_budget ? toNumber(raw.daily_budget) / 100 : null,
    lifetimeBudget: raw.lifetime_budget
      ? toNumber(raw.lifetime_budget) / 100
      : null,
    budgetCap: raw.spend_cap ? toNumber(raw.spend_cap) / 100 : null,
    createdTime: raw.created_time ?? null,
  };
}

function mapAdSet(raw: RawAdSet): MetaAdSet {
  return {
    externalId: raw.id,
    campaignExternalId: raw.campaign_id,
    name: raw.name,
    status: raw.status,
    dailyBudget: raw.daily_budget ? toNumber(raw.daily_budget) / 100 : null,
    lifetimeBudget: raw.lifetime_budget
      ? toNumber(raw.lifetime_budget) / 100
      : null,
    optimizationGoal: raw.optimization_goal ?? null,
    targeting: raw.targeting ?? null,
    startTime: raw.start_time ?? null,
    endTime: raw.end_time ?? null,
  };
}

function mapAd(raw: RawAd, creative: RawCreative | null): MetaAd {
  return {
    externalId: raw.id,
    adSetExternalId: raw.adset_id,
    name: raw.name,
    status: raw.status,
    creative: creative
      ? {
          externalId: creative.id,
          thumbnailUrl: creative.thumbnail_url ?? null,
          headline: creative.title ?? null,
          body: creative.body ?? null,
          videoUrl: creative.object_story_spec?.video_data?.video_id ?? null,
        }
      : null,
  };
}

function mapInsight(
  raw: RawInsight,
  entityType: MetaInsight["entityType"],
  externalId: string,
): MetaInsight {
  const purchases = actionValue(raw.actions, "purchase") ||
    actionValue(raw.actions, "omni_purchase");
  const purchaseValue =
    actionValue(raw.action_values, "purchase") ||
    actionValue(raw.action_values, "omni_purchase");

  return {
    entityType,
    externalId,
    date: raw.date_start,
    hour: raw.hourly_stats_aggregated_by_advertiser_time_zone
      ? Number.parseInt(
          raw.hourly_stats_aggregated_by_advertiser_time_zone.slice(0, 2),
          10,
        )
      : null,
    spend: toNumber(raw.spend),
    impressions: Math.round(toNumber(raw.impressions)),
    reach: Math.round(toNumber(raw.reach)),
    clicks: Math.round(toNumber(raw.clicks)),
    linkClicks: Math.round(toNumber(raw.inline_link_clicks)),
    landingPageViews: actionValue(raw.actions, "landing_page_view"),
    addToCart:
      actionValue(raw.actions, "add_to_cart") ||
      actionValue(raw.actions, "omni_add_to_cart"),
    initiateCheckout:
      actionValue(raw.actions, "initiate_checkout") ||
      actionValue(raw.actions, "omni_initiated_checkout"),
    purchases,
    purchaseValue,
    frequency: toNumber(raw.frequency),
    qualityRanking: raw.quality_ranking ?? null,
    engagementRateRanking: raw.engagement_rate_ranking ?? null,
    conversionRateRanking: raw.conversion_rate_ranking ?? null,
  };
}

// ─── Public adapter ─────────────────────────────────────────────────────────

export class MetaAdsAdapter {
  constructor(private readonly accessToken: string) {}

  // ── Reads ──

  async listCampaigns(adAccountExternalId: string): Promise<MetaCampaign[]> {
    const raw = await metaFetchAllPages<RawCampaign>(
      `/${adAccountExternalId}/campaigns`,
      this.accessToken,
      { fields: CAMPAIGN_FIELDS, limit: 100 },
    );
    return raw.map(mapCampaign);
  }

  async listAdSets(campaignExternalId: string): Promise<MetaAdSet[]> {
    const raw = await metaFetchAllPages<RawAdSet>(
      `/${campaignExternalId}/adsets`,
      this.accessToken,
      { fields: ADSET_FIELDS, limit: 100 },
    );
    return raw.map(mapAdSet);
  }

  async listAds(adSetExternalId: string): Promise<MetaAd[]> {
    const raw = await metaFetchAllPages<RawAd>(
      `/${adSetExternalId}/ads`,
      this.accessToken,
      { fields: AD_FIELDS, limit: 100 },
    );

    return Promise.all(
      raw.map(async (ad) => {
        if (!ad.creative?.id) return mapAd(ad, null);
        const creative = await metaFetch<RawCreative>(
          `/${ad.creative.id}`,
          this.accessToken,
          { params: { fields: CREATIVE_FIELDS } },
        );
        return mapAd(ad, creative);
      }),
    );
  }

  /** Daily insights for a single entity over [since, until] (inclusive, YYYY-MM-DD). */
  async getInsights(
    entityExternalId: string,
    entityType: MetaInsight["entityType"],
    since: string,
    until: string,
    breakdownHourly = false,
  ): Promise<MetaInsight[]> {
    assertCapability("READ_INSIGHTS");
    const raw = await metaFetchAllPages<RawInsight>(
      `/${entityExternalId}/insights`,
      this.accessToken,
      {
        fields: INSIGHT_FIELDS,
        time_range: JSON.stringify({ since, until }),
        time_increment: 1,
        ...(breakdownHourly
          ? { breakdowns: "hourly_stats_aggregated_by_advertiser_time_zone" }
          : {}),
        limit: 500,
      },
    );
    return raw.map((r) => mapInsight(r, entityType, entityExternalId));
  }

  // ── Writes: pause / resume ──

  async setStatus(
    entityExternalId: string,
    status: "ACTIVE" | "PAUSED",
  ): Promise<void> {
    assertCapability("PAUSE_RESUME");
    await metaFetch(`/${entityExternalId}`, this.accessToken, {
      method: "POST",
      body: { status },
    });
  }

  // ── Writes: budget ──

  async setDailyBudget(
    entityExternalId: string,
    dailyBudgetThb: number,
  ): Promise<void> {
    assertCapability("EDIT_BUDGET");
    await metaFetch(`/${entityExternalId}`, this.accessToken, {
      method: "POST",
      body: { daily_budget: Math.round(dailyBudgetThb * 100) },
    });
  }

  async setBudgetCap(
    campaignExternalId: string,
    capThb: number,
  ): Promise<void> {
    assertCapability("SET_BUDGET_CAP");
    await metaFetch(`/${campaignExternalId}`, this.accessToken, {
      method: "POST",
      body: { spend_cap: Math.round(capThb * 100) },
    });
  }

  // ── Writes: scheduling (start/end only — see capabilities.ts) ──

  async setSchedule(
    adSetExternalId: string,
    startTime: string | null,
    endTime: string | null,
  ): Promise<void> {
    assertCapability("SCHEDULE_START_END");
    const body: Record<string, unknown> = {};
    if (startTime) body.start_time = startTime;
    if (endTime) body.end_time = endTime;
    await metaFetch(`/${adSetExternalId}`, this.accessToken, {
      method: "POST",
      body,
    });
  }

  // ── Writes: duplication (read + recreate, always starts PAUSED) ──

  async duplicateCampaign(
    campaignExternalId: string,
    adAccountExternalId: string,
    nameSuffix = " (Copy)",
  ): Promise<MetaCampaign> {
    assertCapability("DUPLICATE_CAMPAIGN");
    const raw = await metaFetch<RawCampaign>(
      `/${campaignExternalId}`,
      this.accessToken,
      { params: { fields: CAMPAIGN_FIELDS } },
    );

    const created = await metaFetch<{ id: string }>(
      `/${adAccountExternalId}/campaigns`,
      this.accessToken,
      {
        method: "POST",
        body: {
          name: `${raw.name}${nameSuffix}`,
          objective: raw.objective,
          status: "PAUSED",
          daily_budget: raw.daily_budget,
          lifetime_budget: raw.lifetime_budget,
          spend_cap: raw.spend_cap,
          special_ad_categories: [],
        },
      },
    );

    return mapCampaign({ ...raw, id: created.id, status: "PAUSED" });
  }

  async duplicateAdSet(
    adSetExternalId: string,
    nameSuffix = " (Copy)",
  ): Promise<MetaAdSet> {
    assertCapability("DUPLICATE_AD_SET");
    const raw = await metaFetch<RawAdSet>(
      `/${adSetExternalId}`,
      this.accessToken,
      { params: { fields: ADSET_FIELDS } },
    );

    const created = await metaFetch<{ id: string }>(
      `/${raw.campaign_id}/adsets`,
      this.accessToken,
      {
        method: "POST",
        body: {
          name: `${raw.name}${nameSuffix}`,
          campaign_id: raw.campaign_id,
          status: "PAUSED",
          daily_budget: raw.daily_budget,
          lifetime_budget: raw.lifetime_budget,
          optimization_goal: raw.optimization_goal,
          targeting: raw.targeting,
        },
      },
    );

    return mapAdSet({ ...raw, id: created.id, status: "PAUSED" });
  }

  async duplicateAd(adExternalId: string, nameSuffix = " (Copy)"): Promise<MetaAd> {
    assertCapability("DUPLICATE_AD");
    const raw = await metaFetch<RawAd>(`/${adExternalId}`, this.accessToken, {
      params: { fields: AD_FIELDS },
    });

    const created = await metaFetch<{ id: string }>(
      `/${raw.adset_id}/ads`,
      this.accessToken,
      {
        method: "POST",
        body: {
          name: `${raw.name}${nameSuffix}`,
          adset_id: raw.adset_id,
          status: "PAUSED",
          creative: raw.creative ? { creative_id: raw.creative.id } : undefined,
        },
      },
    );

    return mapAd({ ...raw, id: created.id, status: "PAUSED" }, null);
  }

  // ── Reads: interest targeting search ──

  /**
   * Verifies whether a candidate interest actually exists as a targetable
   * Meta interest (spec section 11: never fabricate an interest that isn't
   * real). Returns the canonical name + audience size when found.
   */
  async searchInterest(
    query: string,
  ): Promise<{ name: string; audienceSizeLowerBound: number; audienceSizeUpperBound: number } | null> {
    assertCapability("SEARCH_INTERESTS");
    const results = await metaFetch<{
      data: Array<{ name: string; audience_size_lower_bound?: number; audience_size_upper_bound?: number }>;
    }>("/search", this.accessToken, {
      params: { type: "adinterest", q: query, limit: 1 },
    });
    const match = results.data[0];
    if (!match) return null;
    return {
      name: match.name,
      audienceSizeLowerBound: match.audience_size_lower_bound ?? 0,
      audienceSizeUpperBound: match.audience_size_upper_bound ?? 0,
    };
  }
}
