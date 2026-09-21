import { Badge } from "@/components/ui/badge";
import { formatTHB } from "@/lib/utils";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "default" | "info"> = {
  EXECUTED: "success",
  SIMULATED: "info",
  PENDING_APPROVAL: "warning",
  BLOCKED: "danger",
  FAILED: "danger",
  IGNORED: "default",
};

const ACTION_LABEL: Record<string, string> = {
  PAUSE: "Paused",
  RESUME: "Resumed",
  INCREASE_BUDGET_PERCENT: "Increased budget",
  DECREASE_BUDGET_PERCENT: "Decreased budget",
  INCREASE_BUDGET_FIXED: "Increased budget",
  DECREASE_BUDGET_FIXED: "Decreased budget",
  DUPLICATE: "Duplicated",
  SEND_ALERT: "Sent alert for",
  ADD_TAG: "Tagged",
};

function formatBudgetChange(before: Record<string, unknown> | null, after: Record<string, unknown> | null) {
  const b = typeof before?.budget === "number" ? before.budget : null;
  const a = typeof after?.budget === "number" ? after.budget : null;
  if (b === null || a === null || b === a) return null;
  return `${formatTHB(b)} → ${formatTHB(a)}`;
}

export function ActionFeedItem({
  time,
  entityName,
  actionType,
  status,
  reason,
  ruleName,
  before,
  after,
  blockedReason,
}: {
  time: Date;
  entityName: string;
  actionType: string;
  status: string;
  reason: string;
  ruleName: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  blockedReason: string | null;
}) {
  const budgetChange = formatBudgetChange(before, after);

  return (
    <div className="fade-in flex gap-4 border-b border-border py-3 last:border-0">
      <div className="w-14 shrink-0 text-xs text-secondary-text">
        {time.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {ACTION_LABEL[actionType] ?? actionType} &ldquo;{entityName}&rdquo;
          </span>
          <Badge tone={STATUS_TONE[status] ?? "default"}>{status.replace("_", " ")}</Badge>
        </div>
        {budgetChange && <div className="text-sm text-secondary-text">{budgetChange}</div>}
        <div className="text-sm text-secondary-text">
          Reason: {reason}
          {blockedReason ? ` — ${blockedReason}` : ""}
        </div>
        {ruleName && (
          <div className="text-xs text-secondary-text">Rule triggered: {ruleName}</div>
        )}
      </div>
    </div>
  );
}
