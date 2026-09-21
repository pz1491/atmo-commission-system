"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toggleRuleActive, deleteRule } from "./actions";

export function RuleToggle({ ruleId, isActive }: { ruleId: string; isActive: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => startTransition(() => toggleRuleActive(ruleId, !isActive))}
      className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
    >
      {isActive ? "Pause" : "Activate"}
    </button>
  );
}

export function DeleteRuleButton({ ruleId }: { ruleId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (confirm("Delete this rule?")) startTransition(() => deleteRule(ruleId));
      }}
      className="rounded-lg p-1.5 text-secondary-text hover:bg-slate-100 hover:text-danger dark:hover:bg-slate-800"
    >
      <Trash2 size={16} />
    </button>
  );
}
