// Every derived metric used anywhere in the app (dashboard cards, winner
// scoring, rule evaluation) goes through this file. Formulas are plain
// arithmetic on real synced numbers — nothing here is a model guess.

export interface MetricInputs {
  spend: number;
  purchaseValue: number;
  purchases: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  addToCart: number;
  initiateCheckout: number;
  frequency: number;
}

export interface DerivedMetrics extends MetricInputs {
  roas: number | null; // purchaseValue / spend
  cpa: number | null; // spend / purchases
  ctr: number | null; // linkClicks / impressions * 100
  cpc: number | null; // spend / linkClicks
  cpm: number | null; // spend / impressions * 1000
  costPerAddToCart: number | null; // spend / addToCart
  costPerCheckout: number | null; // spend / initiateCheckout
  conversionRate: number | null; // purchases / linkClicks * 100
}

const safeDiv = (numerator: number, denominator: number): number | null =>
  denominator > 0 ? numerator / denominator : null;

export function deriveMetrics(input: MetricInputs): DerivedMetrics {
  return {
    ...input,
    roas: safeDiv(input.purchaseValue, input.spend),
    cpa: safeDiv(input.spend, input.purchases),
    ctr: safeDiv(input.linkClicks, input.impressions) === null
      ? null
      : (input.linkClicks / input.impressions) * 100,
    cpc: safeDiv(input.spend, input.linkClicks),
    cpm: safeDiv(input.spend, input.impressions) === null
      ? null
      : (input.spend / input.impressions) * 1000,
    costPerAddToCart: safeDiv(input.spend, input.addToCart),
    costPerCheckout: safeDiv(input.spend, input.initiateCheckout),
    conversionRate:
      safeDiv(input.purchases, input.linkClicks) === null
        ? null
        : (input.purchases / input.linkClicks) * 100,
  };
}

export function sumMetricInputs(rows: MetricInputs[]): MetricInputs {
  return rows.reduce(
    (acc, row) => ({
      spend: acc.spend + row.spend,
      purchaseValue: acc.purchaseValue + row.purchaseValue,
      purchases: acc.purchases + row.purchases,
      impressions: acc.impressions + row.impressions,
      clicks: acc.clicks + row.clicks,
      linkClicks: acc.linkClicks + row.linkClicks,
      addToCart: acc.addToCart + row.addToCart,
      initiateCheckout: acc.initiateCheckout + row.initiateCheckout,
      // Frequency doesn't sum meaningfully; last-value-wins for display use only.
      frequency: row.frequency,
    }),
    {
      spend: 0,
      purchaseValue: 0,
      purchases: 0,
      impressions: 0,
      clicks: 0,
      linkClicks: 0,
      addToCart: 0,
      initiateCheckout: 0,
      frequency: 0,
    },
  );
}
