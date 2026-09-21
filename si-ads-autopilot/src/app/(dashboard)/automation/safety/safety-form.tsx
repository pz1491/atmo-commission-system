"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateSafetySettings } from "./actions";

interface SettingsShape {
  automationMode: string;
  maxAccountDailySpend: string;
  maxCampaignDailyBudget: string;
  maxIncreasePerActionPercent: number;
  maxBudgetIncreasePer24hPercent: number;
  maxDuplicatesPerDay: number;
  maxAiActionsPerHour: number;
  budgetChangeCooldownHours: number;
  roasGuardTargetRoas: string;
  roasGuardBreakEvenRoas: string;
  roasGuardMinPurchases: number;
  roasGuardMinSpend: string;
  scalingStrategy: string;
  scalingIncreasePercent: number;
  scalingMinPurchases: number;
  scalingMinSpend: string;
  scalingMinActiveHours: number;
  dataFreshnessMaxMinutes: number;
}

function Field({ label, name, defaultValue, step }: { label: string; name: string; defaultValue: string | number; step?: string }) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <input
        name={name}
        type="number"
        step={step ?? "1"}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
      />
    </div>
  );
}

export function SafetyForm({ settings }: { settings: SettingsShape }) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => startTransition(() => updateSafetySettings(formData))}
      className="space-y-8"
    >
      <div>
        <label className="text-sm font-medium">Automation Mode</label>
        <select
          name="automationMode"
          defaultValue={settings.automationMode}
          className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
        >
          <option value="OFF">Manual (AI does nothing)</option>
          <option value="SIMULATION">Simulation (AI logs what it would do)</option>
          <option value="APPROVAL_REQUIRED">Approval Required (AI proposes, you approve)</option>
          <option value="AUTOPILOT">Autopilot (AI executes within guardrails)</option>
        </select>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-primary-deep">Budget Guardrails</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Max Account Daily Spend (THB)" name="maxAccountDailySpend" defaultValue={settings.maxAccountDailySpend} />
          <Field label="Max Campaign Daily Budget (THB)" name="maxCampaignDailyBudget" defaultValue={settings.maxCampaignDailyBudget} />
          <Field label="Max Increase Per Action (%)" name="maxIncreasePerActionPercent" defaultValue={settings.maxIncreasePerActionPercent} />
          <Field label="Max Budget Increase Per 24h (%)" name="maxBudgetIncreasePer24hPercent" defaultValue={settings.maxBudgetIncreasePer24hPercent} />
          <Field label="Max Duplicates Per Day" name="maxDuplicatesPerDay" defaultValue={settings.maxDuplicatesPerDay} />
          <Field label="Max AI Actions Per Hour" name="maxAiActionsPerHour" defaultValue={settings.maxAiActionsPerHour} />
          <Field label="Budget Change Cooldown (hours)" name="budgetChangeCooldownHours" defaultValue={settings.budgetChangeCooldownHours} />
          <Field label="Data Freshness Max Age (minutes)" name="dataFreshnessMaxMinutes" defaultValue={settings.dataFreshnessMaxMinutes} />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-primary-deep">ROAS Guard</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Target ROAS" name="roasGuardTargetRoas" step="0.1" defaultValue={settings.roasGuardTargetRoas} />
          <Field label="Break-even ROAS" name="roasGuardBreakEvenRoas" step="0.1" defaultValue={settings.roasGuardBreakEvenRoas} />
          <Field label="Min Purchases Before Decision" name="roasGuardMinPurchases" defaultValue={settings.roasGuardMinPurchases} />
          <Field label="Min Spend Before Decision (THB)" name="roasGuardMinSpend" defaultValue={settings.roasGuardMinSpend} />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-primary-deep">Smart Scaling</h3>
        <div>
          <label className="text-sm font-medium">Strategy</label>
          <select
            name="scalingStrategy"
            defaultValue={settings.scalingStrategy}
            className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
          >
            <option value="CONSERVATIVE">Conservative (+10%)</option>
            <option value="NORMAL">Normal (+20%)</option>
            <option value="AGGRESSIVE">Aggressive (+30%)</option>
            <option value="CUSTOM">Custom</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Increase (%)" name="scalingIncreasePercent" defaultValue={settings.scalingIncreasePercent} />
          <Field label="Min Purchases Before Scale" name="scalingMinPurchases" defaultValue={settings.scalingMinPurchases} />
          <Field label="Min Spend Before Scale (THB)" name="scalingMinSpend" defaultValue={settings.scalingMinSpend} />
          <Field label="Min Active Time (hours)" name="scalingMinActiveHours" defaultValue={settings.scalingMinActiveHours} />
        </div>
      </section>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save Settings"}
      </Button>
    </form>
  );
}
