"use client";

import { Fragment, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Copy, Pause, Play, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatTHB, formatNumber, formatPercent, cn } from "@/lib/utils";
import { pauseResumeAction, setBudgetAction, duplicateEntityAction } from "./actions";
import type { CampaignTree } from "@/services/campaigns/tree";
import type { EntityType } from "@/generated/prisma/enums";
import type { DerivedMetrics } from "@/services/automation/metrics";

function MetricsCells({ m, budget }: { m: DerivedMetrics; budget: number | null }) {
  return (
    <>
      <td className="px-2 py-2 text-right tabular-nums">{formatTHB(m.spend)}</td>
      <td className="px-2 py-2 text-right tabular-nums">{formatNumber(m.purchases)}</td>
      <td className="px-2 py-2 text-right tabular-nums">{m.cpa ? formatTHB(m.cpa) : "—"}</td>
      <td className="px-2 py-2 text-right tabular-nums">{m.roas ? `${m.roas.toFixed(2)}x` : "—"}</td>
      <td className="px-2 py-2 text-right tabular-nums">{m.ctr ? formatPercent(m.ctr, 2) : "—"}</td>
      <td className="px-2 py-2 text-right tabular-nums">{budget !== null ? formatTHB(budget) : "—"}</td>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <Badge tone={status === "ACTIVE" ? "success" : "default"}>{status}</Badge>;
}

function QuickActions({
  entityType,
  entityId,
  status,
  budget,
}: {
  entityType: EntityType;
  entityId: string;
  status: string;
  budget: number | null;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(budget?.toString() ?? "");

  if (editing) {
    return (
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          const next = Number(value);
          if (!Number.isNaN(next) && budget !== null) {
            startTransition(() => setBudgetAction(entityType, entityId, budget, next));
          }
          setEditing(false);
        }}
      >
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-20 rounded border border-border bg-transparent px-1 py-0.5 text-xs"
        />
        <button type="submit" className="text-xs text-primary">
          Save
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-secondary-text">
      <button
        disabled={pending}
        onClick={() => startTransition(() => pauseResumeAction(entityType, entityId, status !== "ACTIVE"))}
        title={status === "ACTIVE" ? "Pause" : "Resume"}
        className="rounded p-1 hover:bg-slate-100 hover:text-foreground dark:hover:bg-slate-800"
      >
        {status === "ACTIVE" ? <Pause size={14} /> : <Play size={14} />}
      </button>
      {budget !== null && (
        <button
          onClick={() => setEditing(true)}
          title="Edit budget"
          className="rounded p-1 hover:bg-slate-100 hover:text-foreground dark:hover:bg-slate-800"
        >
          <Pencil size={14} />
        </button>
      )}
      <button
        disabled={pending}
        onClick={() => startTransition(() => duplicateEntityAction(entityType, entityId))}
        title="Duplicate"
        className="rounded p-1 hover:bg-slate-100 hover:text-foreground dark:hover:bg-slate-800"
      >
        <Copy size={14} />
      </button>
    </div>
  );
}

export function CampaignTreeView({ campaigns }: { campaigns: CampaignTree }) {
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [expandedAdSets, setExpandedAdSets] = useState<Set<string>>(new Set());

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    setter(next);
  };

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left text-xs text-secondary-text">
          <th className="px-2 py-2 font-medium">Name</th>
          <th className="px-2 py-2 font-medium">Status</th>
          <th className="px-2 py-2 text-right font-medium">Spend</th>
          <th className="px-2 py-2 text-right font-medium">Purchases</th>
          <th className="px-2 py-2 text-right font-medium">CPA</th>
          <th className="px-2 py-2 text-right font-medium">ROAS</th>
          <th className="px-2 py-2 text-right font-medium">CTR</th>
          <th className="px-2 py-2 text-right font-medium">Budget</th>
          <th className="px-2 py-2 font-medium">Actions</th>
        </tr>
      </thead>
      <tbody>
        {campaigns.map((c) => {
          const campaignOpen = expandedCampaigns.has(c.id);
          return (
            <Fragment key={c.id}>
              <tr className="border-b border-border hover:bg-slate-50 dark:hover:bg-slate-900">
                <td className="px-2 py-2">
                  <button
                    onClick={() => toggle(expandedCampaigns, c.id, setExpandedCampaigns)}
                    className="flex items-center gap-1 font-medium"
                  >
                    {campaignOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    {c.name}
                  </button>
                </td>
                <td className="px-2 py-2">
                  <StatusBadge status={c.status} />
                </td>
                <MetricsCells m={c.metrics} budget={c.dailyBudget} />
                <td className="px-2 py-2">
                  <QuickActions entityType="CAMPAIGN" entityId={c.id} status={c.status} budget={c.dailyBudget} />
                </td>
              </tr>
              {campaignOpen &&
                c.adSets.map((as) => {
                  const adSetOpen = expandedAdSets.has(as.id);
                  return (
                    <Fragment key={as.id}>
                      <tr className="border-b border-border bg-slate-50/50 dark:bg-slate-900/40">
                        <td className={cn("px-2 py-2 pl-8")}>
                          <button
                            onClick={() => toggle(expandedAdSets, as.id, setExpandedAdSets)}
                            className="flex items-center gap-1"
                          >
                            {adSetOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            {as.name}
                          </button>
                        </td>
                        <td className="px-2 py-2">
                          <StatusBadge status={as.status} />
                        </td>
                        <MetricsCells m={as.metrics} budget={as.dailyBudget} />
                        <td className="px-2 py-2">
                          <QuickActions entityType="AD_SET" entityId={as.id} status={as.status} budget={as.dailyBudget} />
                        </td>
                      </tr>
                      {adSetOpen &&
                        as.ads.map((ad) => (
                          <tr key={ad.id} className="border-b border-border">
                            <td className="px-2 py-2 pl-14 text-secondary-text">{ad.name}</td>
                            <td className="px-2 py-2">
                              <StatusBadge status={ad.status} />
                            </td>
                            <MetricsCells m={ad.metrics} budget={null} />
                            <td className="px-2 py-2">
                              <QuickActions entityType="AD" entityId={ad.id} status={ad.status} budget={null} />
                            </td>
                          </tr>
                        ))}
                    </Fragment>
                  );
                })}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
