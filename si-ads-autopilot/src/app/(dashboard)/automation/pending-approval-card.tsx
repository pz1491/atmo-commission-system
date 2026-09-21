"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { approvePendingAction, ignorePendingAction } from "./actions";

export function PendingApprovalCard({
  id,
  entityName,
  actionType,
  reason,
}: {
  id: string;
  entityName: string;
  actionType: string;
  reason: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between rounded-lg border border-warning/40 bg-amber-50 p-3 dark:bg-amber-950/20">
      <div>
        <div className="text-sm font-medium">
          {actionType.replaceAll("_", " ")} — {entityName}
        </div>
        <div className="text-xs text-secondary-text">{reason}</div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() => startTransition(() => approvePendingAction(id))}
        >
          Approve
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => startTransition(() => ignorePendingAction(id))}
        >
          Ignore
        </Button>
      </div>
    </div>
  );
}
