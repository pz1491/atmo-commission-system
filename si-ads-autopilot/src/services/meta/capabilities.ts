import { MetaFeatureUnavailableError, type MetaCapability, type MetaCapabilityKey } from "./types";

// Single source of truth for "can the adapter actually do this against the
// Meta Marketing API today". Never invent data for a capability marked
// unavailable — the UI must show the reason instead.
//
// SCHEDULE_START_END (ad set start_time/end_time) and HOURLY_DAYPARTING
// (true hour-by-hour ad set scheduling) behave differently depending on the
// ad set's bid strategy and budget type on Meta's side, and dayparting is
// only exposed for specific lifetime-budget configurations. Rather than
// silently failing at execution time, we mark hourly dayparting as
// unavailable by default and let Section 9 fall back to its documented
// alternative: budget reduction rules during weak hours.
export const META_CAPABILITIES: Record<MetaCapabilityKey, MetaCapability> = {
  READ_INSIGHTS: { key: "READ_INSIGHTS", available: true },
  PAUSE_RESUME: { key: "PAUSE_RESUME", available: true },
  EDIT_BUDGET: { key: "EDIT_BUDGET", available: true },
  SET_BUDGET_CAP: { key: "SET_BUDGET_CAP", available: true },
  DUPLICATE_CAMPAIGN: {
    key: "DUPLICATE_CAMPAIGN",
    available: true,
    reason:
      "Implemented as read + recreate (no native copy edge is relied on), so duplicated campaigns start PAUSED for review.",
  },
  DUPLICATE_AD_SET: {
    key: "DUPLICATE_AD_SET",
    available: true,
    reason: "Implemented as read + recreate; starts PAUSED for review.",
  },
  DUPLICATE_AD: {
    key: "DUPLICATE_AD",
    available: true,
    reason:
      "Reuses the existing creative id; implemented as read + recreate; starts PAUSED for review.",
  },
  SCHEDULE_START_END: { key: "SCHEDULE_START_END", available: true },
  SEARCH_INTERESTS: { key: "SEARCH_INTERESTS", available: true },
  HOURLY_DAYPARTING: {
    key: "HOURLY_DAYPARTING",
    available: false,
    reason:
      "Hour-by-hour ad set scheduling depends on bid strategy / budget type and is not reliably available across all ad sets via the Marketing API. Use the Dayparting heatmap's 'Reduce budget during weak hours' rule action instead of a hard schedule.",
  },
};

export function getCapability(key: MetaCapabilityKey): MetaCapability {
  return META_CAPABILITIES[key];
}

export function assertCapability(key: MetaCapabilityKey): void {
  const cap = META_CAPABILITIES[key];
  if (!cap.available) {
    throw new MetaFeatureUnavailableError(
      key,
      cap.reason ?? "This feature is not available in the current Meta API adapter.",
    );
  }
}
