import type { DerivedMetrics } from "./metrics";

// Winner Detection (spec section 7). Every score below is a disclosed
// formula over real synced metrics — never a model guess. Thresholds are
// parameters so they stay user-configurable from Settings rather than
// hardcoded product opinion.

export interface WinnerThresholds {
  targetRoas: number; // from ROAS Guard settings
  breakEvenRoas: number;
  minPurchasesForDecision: number;
  minSpendForDecision: number;
}

export const DEFAULT_WINNER_THRESHOLDS: WinnerThresholds = {
  targetRoas: 3,
  breakEvenRoas: 2.2,
  minPurchasesForDecision: 3,
  minSpendForDecision: 1000,
};

export type WinnerStatus =
  | "HOT_WINNER"
  | "WINNER"
  | "WATCH"
  | "LOSING"
  | "INSUFFICIENT_DATA";

export interface WinnerScores {
  creativeScore: number; // 0-100, CTR + frequency-decay based
  profitScore: number; // 0-100, ROAS vs target/break-even based
  scaleScore: number; // 0-100, purchase volume + spend based
  stabilityScore: number; // 0-100, inverse of day-over-day ROAS volatility
  overall: number; // weighted average
  status: WinnerStatus;
  recommendation: string;
}

/**
 * `history` = the entity's daily DerivedMetrics for the trailing window
 * (most recent last), used for the stability score's volatility check.
 */
export function scoreWinner(
  latest: DerivedMetrics,
  history: DerivedMetrics[],
  thresholds: WinnerThresholds = DEFAULT_WINNER_THRESHOLDS,
): WinnerScores {
  if (
    latest.spend < thresholds.minSpendForDecision ||
    latest.purchases < thresholds.minPurchasesForDecision
  ) {
    return {
      creativeScore: 0,
      profitScore: 0,
      scaleScore: 0,
      stabilityScore: 0,
      overall: 0,
      status: "INSUFFICIENT_DATA",
      recommendation: `Waiting for data: needs ≥ ${thresholds.minSpendForDecision} THB spend and ≥ ${thresholds.minPurchasesForDecision} purchases before scoring.`,
    };
  }

  // Creative score: CTR contributes up to 70 points (2% CTR = 70pts, capped),
  // frequency above 3 subtracts fatigue penalty up to 30 points.
  const ctr = latest.ctr ?? 0;
  const ctrPoints = Math.min((ctr / 2) * 70, 70);
  const fatiguePenalty = Math.min(Math.max(latest.frequency - 3, 0) * 10, 30);
  const creativeScore = Math.max(0, Math.min(100, ctrPoints + 30 - fatiguePenalty));

  // Profit score: 100 at 2x target ROAS, 50 at target ROAS, 0 at break-even or below.
  const roas = latest.roas ?? 0;
  let profitScore: number;
  if (roas <= thresholds.breakEvenRoas) {
    profitScore = 0;
  } else if (roas <= thresholds.targetRoas) {
    profitScore =
      ((roas - thresholds.breakEvenRoas) /
        (thresholds.targetRoas - thresholds.breakEvenRoas)) *
      50;
  } else {
    profitScore = Math.min(
      100,
      50 + ((roas - thresholds.targetRoas) / thresholds.targetRoas) * 50,
    );
  }

  // Scale score: purchase volume relative to a 20-purchase/day benchmark,
  // combined with spend relative to a 5,000 THB/day benchmark.
  const purchaseVolumeScore = Math.min((latest.purchases / 20) * 100, 100);
  const spendVolumeScore = Math.min((latest.spend / 5000) * 100, 100);
  const scaleScore = purchaseVolumeScore * 0.6 + spendVolumeScore * 0.4;

  // Stability score: 100 minus coefficient-of-variation of ROAS over the
  // trailing window (lower volatility = higher stability).
  const roasSeries = history.map((h) => h.roas ?? 0).filter((r) => r > 0);
  let stabilityScore = 50; // neutral when not enough history
  if (roasSeries.length >= 3) {
    const mean = roasSeries.reduce((a, b) => a + b, 0) / roasSeries.length;
    const variance =
      roasSeries.reduce((a, b) => a + (b - mean) ** 2, 0) / roasSeries.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
    stabilityScore = Math.max(0, Math.min(100, 100 - cv * 100));
  }

  const overall =
    creativeScore * 0.25 +
    profitScore * 0.4 +
    scaleScore * 0.15 +
    stabilityScore * 0.2;

  let status: WinnerStatus;
  let recommendation: string;
  if (roas <= thresholds.breakEvenRoas) {
    status = "LOSING";
    recommendation = "Below break-even ROAS — consider pausing.";
  } else if (overall >= 75 && roas >= thresholds.targetRoas) {
    status = "HOT_WINNER";
    recommendation = "Safe to scale — strong profit, creative, and stability.";
  } else if (roas >= thresholds.targetRoas) {
    status = "WINNER";
    recommendation = "Meeting target ROAS — candidate for budget increase.";
  } else {
    status = "WATCH";
    recommendation = "Above break-even but below target — keep monitoring.";
  }

  return {
    creativeScore: Math.round(creativeScore),
    profitScore: Math.round(profitScore),
    scaleScore: Math.round(scaleScore),
    stabilityScore: Math.round(stabilityScore),
    overall: Math.round(overall),
    status,
    recommendation,
  };
}
