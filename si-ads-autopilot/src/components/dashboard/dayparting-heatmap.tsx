"use client";

import { Fragment, useState } from "react";
import type { HeatmapCell } from "@/services/analytics/dayparting";
import { formatTHB } from "@/lib/utils";

const CLASS_COLOR: Record<HeatmapCell["classification"], string> = {
  PROFITABLE: "bg-green-500",
  NEUTRAL: "bg-amber-400",
  POOR: "bg-red-500",
  NO_DATA: "bg-slate-100 dark:bg-slate-800",
};

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday-first, per spec

export function DaypartingHeatmap({ cells }: { cells: HeatmapCell[] }) {
  const [hovered, setHovered] = useState<HeatmapCell | null>(null);
  const byKey = new Map(cells.map((c) => [`${c.day}:${c.hour}`, c]));

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="inline-grid grid-cols-[60px_repeat(24,20px)] gap-[3px]">
          <div />
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="text-center text-[9px] text-secondary-text">
              {h}
            </div>
          ))}
          {DAY_ORDER.map((day) => (
            <Fragment key={day}>
              <div className="pr-2 text-right text-xs text-secondary-text">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]}
              </div>
              {Array.from({ length: 24 }, (_, h) => {
                const cell = byKey.get(`${day}:${h}`);
                return (
                  <div
                    key={`${day}-${h}`}
                    onMouseEnter={() => cell && setHovered(cell)}
                    onMouseLeave={() => setHovered(null)}
                    className={`h-5 w-5 rounded-sm ${cell ? CLASS_COLOR[cell.classification] : CLASS_COLOR.NO_DATA} opacity-90 transition-opacity hover:opacity-100`}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-secondary-text">
        <Legend color="bg-green-500" label="Profitable" />
        <Legend color="bg-amber-400" label="Neutral" />
        <Legend color="bg-red-500" label="Poor" />
        <Legend color="bg-slate-200 dark:bg-slate-700" label="No data" />
      </div>

      {hovered && (
        <div className="mt-3 rounded-lg border border-border p-3 text-sm">
          <div className="font-medium">
            {hovered.dayName} {hovered.hour}:00–{hovered.hour + 1}:00
          </div>
          {hovered.classification === "NO_DATA" ? (
            <p className="text-secondary-text">No synced data for this slot yet.</p>
          ) : (
            <p className="text-secondary-text">
              ROAS {hovered.roas?.toFixed(2)}x · Spend {formatTHB(hovered.spend)} · Revenue{" "}
              {formatTHB(hovered.revenue)} · {hovered.purchases} purchases
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-sm ${color}`} /> {label}
    </span>
  );
}
