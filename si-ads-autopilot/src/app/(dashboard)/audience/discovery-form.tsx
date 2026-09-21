"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { runAudienceDiscovery } from "./actions";

export function DiscoveryForm() {
  const [pending, startTransition] = useTransition();

  return (
    <form action={(fd) => startTransition(() => runAudienceDiscovery(fd))} className="space-y-3">
      <div>
        <label className="text-sm font-medium">Product Name</label>
        <input name="productName" required className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm" placeholder="e.g. Luxury Artificial Flower Vase" />
      </div>
      <div>
        <label className="text-sm font-medium">Product Description</label>
        <textarea name="productDescription" required rows={3} className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Target Customer</label>
          <input name="targetCustomer" className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm" placeholder="e.g. Women 30-50, homeowners" />
        </div>
        <div>
          <label className="text-sm font-medium">Price (THB)</label>
          <input name="price" type="number" className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Country</label>
        <input name="country" defaultValue="TH" className="mt-1 w-32 rounded-lg border border-border bg-transparent px-3 py-2 text-sm" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Analyzing..." : "Discover Audience"}
      </Button>
    </form>
  );
}
