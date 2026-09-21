"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createRule } from "../actions";
import type { RuleCondition, RuleMetric, RuleOperator } from "@/services/automation/ruleEngine";
import type { ActionType, EntityType } from "@/generated/prisma/enums";

const METRICS: RuleMetric[] = [
  "SPEND",
  "REVENUE",
  "ROAS",
  "CPA",
  "PURCHASES",
  "CTR",
  "CPC",
  "CPM",
  "FREQUENCY",
  "ADD_TO_CART",
  "CHECKOUT",
  "COST_PER_ADD_TO_CART",
  "COST_PER_CHECKOUT",
  "CONVERSION_RATE",
];
const OPERATORS: { value: RuleOperator; label: string }[] = [
  { value: "GT", label: ">" },
  { value: "LT", label: "<" },
  { value: "GTE", label: ">=" },
  { value: "LTE", label: "<=" },
  { value: "EQ", label: "=" },
  { value: "BETWEEN", label: "between" },
];
const ACTIONS: { value: ActionType; label: string }[] = [
  { value: "PAUSE", label: "Pause" },
  { value: "RESUME", label: "Resume" },
  { value: "INCREASE_BUDGET_PERCENT", label: "Increase Budget %" },
  { value: "DECREASE_BUDGET_PERCENT", label: "Decrease Budget %" },
  { value: "INCREASE_BUDGET_FIXED", label: "Increase Fixed Amount" },
  { value: "DECREASE_BUDGET_FIXED", label: "Decrease Fixed Amount" },
  { value: "DUPLICATE", label: "Duplicate" },
  { value: "SEND_ALERT", label: "Send Alert" },
  { value: "ADD_TAG", label: "Add Tag" },
];
const TARGET_TYPES: EntityType[] = ["CAMPAIGN", "AD_SET", "AD"];

const emptyCondition = (): RuleCondition => ({ metric: "SPEND", operator: "GT", value: 0 });

export function RuleBuilderForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [targetType, setTargetType] = useState<EntityType>("AD");
  const [conditions, setConditions] = useState<RuleCondition[]>([emptyCondition()]);
  const [action, setAction] = useState<ActionType>("PAUSE");
  const [percent, setPercent] = useState(20);
  const [amount, setAmount] = useState(500);
  const [cooldownHours, setCooldownHours] = useState(6);
  const [maxTriggersPerDay, setMaxTriggersPerDay] = useState(10);

  const isBudgetAction = action.includes("BUDGET");
  const isPercentAction = action.endsWith("PERCENT");

  function updateCondition(index: number, patch: Partial<RuleCondition>) {
    setConditions((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function submit() {
    startTransition(async () => {
      await createRule({
        name: name || "Untitled rule",
        targetType,
        conditions,
        action,
        actionParams: isBudgetAction ? { percent: isPercentAction ? percent : undefined, amount: !isPercentAction ? amount : undefined } : undefined,
        cooldownHours,
        maxTriggersPerDay,
        priority: 0,
      });
      router.push("/automation");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Define the rule</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <label className="text-sm font-medium">Rule name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Pause zero-purchase ads"
            className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Applies to</label>
          <select
            value={targetType}
            onChange={(e) => setTargetType(e.target.value as EntityType)}
            className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
          >
            {TARGET_TYPES.map((t) => (
              <option key={t} value={t}>
                Every active {t.replace("_", " ").toLowerCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-semibold text-primary-deep">IF</div>
          {conditions.map((cond, i) => (
            <div key={i} className="flex items-center gap-2">
              {i > 0 && <span className="w-10 text-xs font-semibold text-secondary-text">AND</span>}
              <select
                value={cond.metric}
                onChange={(e) => updateCondition(i, { metric: e.target.value as RuleMetric })}
                className="rounded-lg border border-border bg-transparent px-2 py-1.5 text-sm"
              >
                {METRICS.map((m) => (
                  <option key={m} value={m}>
                    {m.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
              <select
                value={cond.operator}
                onChange={(e) => updateCondition(i, { operator: e.target.value as RuleOperator })}
                className="rounded-lg border border-border bg-transparent px-2 py-1.5 text-sm"
              >
                {OPERATORS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={cond.value}
                onChange={(e) => updateCondition(i, { value: Number(e.target.value) })}
                className="w-24 rounded-lg border border-border bg-transparent px-2 py-1.5 text-sm"
              />
              {cond.operator === "BETWEEN" && (
                <>
                  <span className="text-xs text-secondary-text">and</span>
                  <input
                    type="number"
                    value={cond.value2 ?? 0}
                    onChange={(e) => updateCondition(i, { value2: Number(e.target.value) })}
                    className="w-24 rounded-lg border border-border bg-transparent px-2 py-1.5 text-sm"
                  />
                </>
              )}
              <button
                onClick={() => setConditions((prev) => prev.filter((_, idx) => idx !== i))}
                className="rounded p-1 text-secondary-text hover:text-danger"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button
            onClick={() => setConditions((prev) => [...prev, emptyCondition()])}
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <Plus size={14} /> Add condition (AND)
          </button>
        </div>

        <div>
          <div className="mb-2 text-sm font-semibold text-primary-deep">THEN</div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as ActionType)}
              className="rounded-lg border border-border bg-transparent px-2 py-1.5 text-sm"
            >
              {ACTIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
            {isBudgetAction && isPercentAction && (
              <input
                type="number"
                value={percent}
                onChange={(e) => setPercent(Number(e.target.value))}
                className="w-24 rounded-lg border border-border bg-transparent px-2 py-1.5 text-sm"
              />
            )}
            {isBudgetAction && !isPercentAction && (
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-28 rounded-lg border border-border bg-transparent px-2 py-1.5 text-sm"
              />
            )}
            {isBudgetAction && (
              <span className="text-xs text-secondary-text">{isPercentAction ? "%" : "THB"}</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Cooldown (hours)</label>
            <input
              type="number"
              value={cooldownHours}
              onChange={(e) => setCooldownHours(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Max triggers / day</label>
            <input
              type="number"
              value={maxTriggersPerDay}
              onChange={(e) => setMaxTriggersPerDay(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
            />
          </div>
        </div>

        <Button onClick={submit} disabled={pending}>
          {pending ? "Saving..." : "Save Rule"}
        </Button>
      </CardContent>
    </Card>
  );
}
