import type { DerivedMetrics } from "./metrics";

export type RuleMetric =
  | "SPEND"
  | "REVENUE"
  | "ROAS"
  | "CPA"
  | "PURCHASES"
  | "CTR"
  | "CPC"
  | "CPM"
  | "FREQUENCY"
  | "ADD_TO_CART"
  | "CHECKOUT"
  | "COST_PER_ADD_TO_CART"
  | "COST_PER_CHECKOUT"
  | "CONVERSION_RATE";

export type RuleOperator = "GT" | "LT" | "GTE" | "LTE" | "EQ" | "BETWEEN";

export interface RuleCondition {
  metric: RuleMetric;
  operator: RuleOperator;
  value: number;
  value2?: number; // only used with BETWEEN
}

const METRIC_ACCESSORS: Record<RuleMetric, (m: DerivedMetrics) => number | null> = {
  SPEND: (m) => m.spend,
  REVENUE: (m) => m.purchaseValue,
  ROAS: (m) => m.roas,
  CPA: (m) => m.cpa,
  PURCHASES: (m) => m.purchases,
  CTR: (m) => m.ctr,
  CPC: (m) => m.cpc,
  CPM: (m) => m.cpm,
  FREQUENCY: (m) => m.frequency,
  ADD_TO_CART: (m) => m.addToCart,
  CHECKOUT: (m) => m.initiateCheckout,
  COST_PER_ADD_TO_CART: (m) => m.costPerAddToCart,
  COST_PER_CHECKOUT: (m) => m.costPerCheckout,
  CONVERSION_RATE: (m) => m.conversionRate,
};

export function evaluateCondition(
  condition: RuleCondition,
  metrics: DerivedMetrics,
): boolean {
  const actual = METRIC_ACCESSORS[condition.metric](metrics);
  if (actual === null) return false; // e.g. divide-by-zero metric, not enough data

  switch (condition.operator) {
    case "GT":
      return actual > condition.value;
    case "LT":
      return actual < condition.value;
    case "GTE":
      return actual >= condition.value;
    case "LTE":
      return actual <= condition.value;
    case "EQ":
      return actual === condition.value;
    case "BETWEEN":
      return (
        condition.value2 !== undefined &&
        actual >= condition.value &&
        actual <= condition.value2
      );
    default:
      return false;
  }
}

/** All conditions are AND-combined, matching every example in the spec. */
export function evaluateConditions(
  conditions: RuleCondition[],
  metrics: DerivedMetrics,
): boolean {
  return conditions.every((c) => evaluateCondition(c, metrics));
}

export function describeCondition(condition: RuleCondition): string {
  const opLabel: Record<RuleOperator, string> = {
    GT: ">",
    LT: "<",
    GTE: ">=",
    LTE: "<=",
    EQ: "=",
    BETWEEN: "between",
  };
  if (condition.operator === "BETWEEN") {
    return `${condition.metric} between ${condition.value} and ${condition.value2}`;
  }
  return `${condition.metric} ${opLabel[condition.operator]} ${condition.value}`;
}
