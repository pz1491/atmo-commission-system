// Profit-based optimization (spec section 14). All formulas are disclosed
// here — nothing about "break-even" or "profit ROAS" is an AI estimate.

export interface ProductEconomicsInput {
  sellingPrice: number;
  cogs: number;
  shippingCost: number;
  platformFeePercent: number; // e.g. 5 = 5%
  vatPercent: number; // e.g. 7 = 7%
  paymentFeePercent: number;
  refundRatePercent: number;
  otherCost: number;
}

export interface ProfitBreakdown {
  vatAmount: number;
  platformFeeAmount: number;
  paymentFeeAmount: number;
  refundAllowance: number;
  totalCost: number; // cogs + shipping + fees + vat + refund allowance + other
  grossProfitPerUnit: number; // sellingPrice - totalCost
  contributionMarginPercent: number; // grossProfitPerUnit / sellingPrice * 100
  breakEvenCpa: number; // = grossProfitPerUnit (ad spend per purchase you can afford at 0 profit)
  breakEvenRoas: number; // sellingPrice / breakEvenCpa
}

export function calculateProfitBreakdown(
  input: ProductEconomicsInput,
): ProfitBreakdown {
  const vatAmount = input.sellingPrice * (input.vatPercent / 100);
  const platformFeeAmount = input.sellingPrice * (input.platformFeePercent / 100);
  const paymentFeeAmount = input.sellingPrice * (input.paymentFeePercent / 100);
  const refundAllowance = input.sellingPrice * (input.refundRatePercent / 100);

  const totalCost =
    input.cogs +
    input.shippingCost +
    vatAmount +
    platformFeeAmount +
    paymentFeeAmount +
    refundAllowance +
    input.otherCost;

  const grossProfitPerUnit = input.sellingPrice - totalCost;
  const contributionMarginPercent =
    input.sellingPrice > 0 ? (grossProfitPerUnit / input.sellingPrice) * 100 : 0;

  // Break-even CPA is the maximum you can spend to acquire one purchase
  // before the ad spend itself erases the unit's gross profit.
  const breakEvenCpa = Math.max(grossProfitPerUnit, 0);
  const breakEvenRoas =
    breakEvenCpa > 0 ? input.sellingPrice / breakEvenCpa : Number.POSITIVE_INFINITY;

  return {
    vatAmount,
    platformFeeAmount,
    paymentFeeAmount,
    refundAllowance,
    totalCost,
    grossProfitPerUnit,
    contributionMarginPercent,
    breakEvenCpa,
    breakEvenRoas,
  };
}

export function calculateNetProfitAfterAds(
  breakdown: ProfitBreakdown,
  purchases: number,
  adSpend: number,
): number {
  return breakdown.grossProfitPerUnit * purchases - adSpend;
}

export function calculateProfitPerPurchase(
  breakdown: ProfitBreakdown,
  actualCpa: number,
): number {
  return breakdown.grossProfitPerUnit - actualCpa;
}
