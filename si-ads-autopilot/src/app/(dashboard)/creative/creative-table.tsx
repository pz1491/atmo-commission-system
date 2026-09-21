"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { formatTHB, formatPercent } from "@/lib/utils";
import type { CreativeRow } from "@/services/creative/performance";

type SortKey = "roas" | "cpa" | "purchases" | "ctr" | "spend";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "roas", label: "Highest ROAS" },
  { key: "cpa", label: "Lowest CPA" },
  { key: "purchases", label: "Most Purchases" },
  { key: "ctr", label: "Highest CTR" },
  { key: "spend", label: "Highest Spend" },
];

export function CreativeTable({ rows }: { rows: CreativeRow[] }) {
  const [sort, setSort] = useState<SortKey>("roas");

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      if (sort === "cpa") return (a.cpa ?? Infinity) - (b.cpa ?? Infinity);
      return (b[sort] ?? 0) - (a[sort] ?? 0);
    });
    return copy;
  }, [rows, sort]);

  return (
    <div>
      <div className="mb-3 flex gap-2">
        {SORT_OPTIONS.map((o) => (
          <button
            key={o.key}
            onClick={() => setSort(o.key)}
            className={`rounded-lg px-3 py-1.5 text-xs ${
              sort === o.key ? "bg-primary-light text-primary-deep" : "text-secondary-text hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-secondary-text">
            <th className="px-2 py-2">Ad</th>
            <th className="px-2 py-2 text-right">Spend</th>
            <th className="px-2 py-2 text-right">Purchases</th>
            <th className="px-2 py-2 text-right">CPA</th>
            <th className="px-2 py-2 text-right">ROAS</th>
            <th className="px-2 py-2 text-right">CTR</th>
            <th className="px-2 py-2 text-right">Frequency</th>
            <th className="px-2 py-2">Fatigue</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.adId} className="border-b border-border">
              <td className="flex items-center gap-2 px-2 py-2">
                {row.thumbnailUrl ? (
                  <Image src={row.thumbnailUrl} alt="" width={32} height={32} className="rounded object-cover" unoptimized />
                ) : (
                  <div className="h-8 w-8 rounded bg-slate-100 dark:bg-slate-800" />
                )}
                <div>
                  <div className="font-medium">{row.name}</div>
                  {row.headline && <div className="text-xs text-secondary-text">{row.headline}</div>}
                </div>
              </td>
              <td className="px-2 py-2 text-right tabular-nums">{formatTHB(row.spend)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{row.purchases}</td>
              <td className="px-2 py-2 text-right tabular-nums">{row.cpa ? formatTHB(row.cpa) : "—"}</td>
              <td className="px-2 py-2 text-right tabular-nums">{row.roas ? `${row.roas.toFixed(2)}x` : "—"}</td>
              <td className="px-2 py-2 text-right tabular-nums">{row.ctr ? formatPercent(row.ctr, 2) : "—"}</td>
              <td className="px-2 py-2 text-right tabular-nums">{row.frequency.toFixed(2)}</td>
              <td className="px-2 py-2">
                {row.fatigueDetected && <Badge tone="danger">Fatigue Detected</Badge>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
