"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { calculateProfitBreakdown } from "@/services/economics/profit";
import { formatTHB, formatPercent } from "@/lib/utils";
import { upsertProductEconomics } from "./actions";

export function ProductEconomicsForm() {
  const [pending, startTransition] = useTransition();
  const [inputs, setInputs] = useState({
    name: "",
    sellingPrice: 0,
    cogs: 0,
    shippingCost: 0,
    platformFeePercent: 0,
    vatPercent: 7,
    paymentFeePercent: 0,
    refundRatePercent: 0,
    otherCost: 0,
  });

  const breakdown = useMemo(() => calculateProfitBreakdown(inputs), [inputs]);

  const set = (key: keyof typeof inputs) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setInputs((prev) => ({ ...prev, [key]: key === "name" ? e.target.value : Number(e.target.value) } as never));

  return (
    <form
      action={(fd) => startTransition(() => upsertProductEconomics(fd))}
      className="grid grid-cols-1 gap-6 md:grid-cols-2"
    >
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium">Product name</label>
          <input name="name" value={inputs.name} onChange={set("name")} className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm" />
        </div>
        {[
          ["sellingPrice", "Selling Price (THB)"],
          ["cogs", "COGS (THB)"],
          ["shippingCost", "Shipping Cost (THB)"],
          ["platformFeePercent", "Platform Fee (%)"],
          ["vatPercent", "VAT (%)"],
          ["paymentFeePercent", "Payment Fee (%)"],
          ["refundRatePercent", "Refund Rate (%)"],
          ["otherCost", "Other Cost (THB)"],
        ].map(([key, label]) => (
          <div key={key}>
            <label className="text-sm font-medium">{label}</label>
            <input
              name={key}
              type="number"
              step="0.01"
              value={inputs[key as keyof typeof inputs]}
              onChange={set(key as keyof typeof inputs)}
              className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
            />
          </div>
        ))}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save Product Economics"}
        </Button>
      </div>

      <div className="space-y-2 rounded-lg border border-border bg-primary-light p-4 text-sm">
        <div className="font-semibold text-primary-deep">Computed (disclosed formula)</div>
        <Row label="Gross Profit / Unit" value={formatTHB(breakdown.grossProfitPerUnit)} />
        <Row label="Contribution Margin" value={formatPercent(breakdown.contributionMarginPercent)} />
        <Row label="Break-even CPA" value={formatTHB(breakdown.breakEvenCpa)} />
        <Row
          label="Break-even ROAS"
          value={Number.isFinite(breakdown.breakEvenRoas) ? `${breakdown.breakEvenRoas.toFixed(2)}x` : "∞"}
        />
      </div>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-secondary-text">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
