"use client";

import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { markAlertRead } from "./actions";

const SEVERITY_TONE = { INFO: "info", WARNING: "warning", CRITICAL: "danger" } as const;

export function AlertRow({
  id,
  type,
  severity,
  title,
  message,
  isRead,
  createdAt,
}: {
  id: string;
  type: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className={`flex items-start justify-between gap-4 border-b border-border py-3 last:border-0 ${isRead ? "opacity-60" : ""}`}>
      <div>
        <div className="flex items-center gap-2">
          <Badge tone={SEVERITY_TONE[severity]}>{severity}</Badge>
          <Badge tone="default">{type.replaceAll("_", " ")}</Badge>
          <span className="text-sm font-medium">{title}</span>
        </div>
        <p className="mt-1 text-sm text-secondary-text">{message}</p>
        <p className="mt-1 text-xs text-secondary-text">{new Date(createdAt).toLocaleString("th-TH")}</p>
      </div>
      {!isRead && (
        <button
          disabled={pending}
          onClick={() => startTransition(() => markAlertRead(id))}
          className="shrink-0 rounded-lg border border-border px-2 py-1 text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          Mark read
        </button>
      )}
    </div>
  );
}
