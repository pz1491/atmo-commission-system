// Shared types for the Meta Marketing API adapter layer.
// Nothing here should leak Graph API field names into the rest of the app —
// callers only ever see this normalized shape.

export type MetaEntityType = "CAMPAIGN" | "AD_SET" | "AD";

export type MetaStatus = "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED";

export interface MetaCampaign {
  externalId: string;
  name: string;
  objective: string | null;
  status: MetaStatus;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  budgetCap: number | null;
  createdTime: string | null;
}

export interface MetaAdSet {
  externalId: string;
  campaignExternalId: string;
  name: string;
  status: MetaStatus;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  optimizationGoal: string | null;
  targeting: unknown;
  startTime: string | null;
  endTime: string | null;
}

export interface MetaAd {
  externalId: string;
  adSetExternalId: string;
  name: string;
  status: MetaStatus;
  creative: {
    externalId: string | null;
    thumbnailUrl: string | null;
    headline: string | null;
    body: string | null;
    videoUrl: string | null;
  } | null;
}

// Normalized insight row — one entity, one day (or one hour, if `hour` set).
export interface MetaInsight {
  entityType: MetaEntityType;
  externalId: string;
  date: string; // YYYY-MM-DD
  hour: number | null;

  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  linkClicks: number;
  landingPageViews: number;
  addToCart: number;
  initiateCheckout: number;
  purchases: number;
  purchaseValue: number;
  frequency: number;

  // Ad-level only. Meta does not expose these at campaign/ad-set level.
  qualityRanking: string | null;
  engagementRateRanking: string | null;
  conversionRateRanking: string | null;
}

export type MetaCapabilityKey =
  | "READ_INSIGHTS"
  | "PAUSE_RESUME"
  | "EDIT_BUDGET"
  | "SET_BUDGET_CAP"
  | "DUPLICATE_CAMPAIGN"
  | "DUPLICATE_AD_SET"
  | "DUPLICATE_AD"
  | "SCHEDULE_START_END"
  | "HOURLY_DAYPARTING"
  | "SEARCH_INTERESTS";

export interface MetaCapability {
  key: MetaCapabilityKey;
  available: boolean;
  reason?: string;
}

export class MetaApiError extends Error {
  constructor(
    message: string,
    public code?: number,
    public subcode?: number,
    public httpStatus?: number,
    public isRateLimit = false,
    public isTokenError = false,
  ) {
    super(message);
    this.name = "MetaApiError";
  }
}

export class MetaFeatureUnavailableError extends Error {
  constructor(public capability: MetaCapabilityKey, reason: string) {
    super(reason);
    this.name = "MetaFeatureUnavailableError";
  }
}
