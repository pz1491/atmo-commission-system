"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { saveTargetsAndMode } from "./actions";

interface AdAccountSummary {
  id: string;
  name: string;
  pixelId: string | null;
}

interface SettingsShape {
  roasGuardTargetRoas: string;
  targetCpa: string | null;
  maxAccountDailySpend: string;
  automationMode: string;
}

const STEPS = [
  "Connect Meta Account",
  "Choose Ad Account",
  "Choose Pixel",
  "Business Economics",
  "Set Targets",
  "Automation Mode",
];

export function OnboardingWizard({
  connected,
  adAccounts,
  settings,
}: {
  connected: boolean;
  adAccounts: AdAccountSummary[];
  settings: SettingsShape | null;
}) {
  const [step, setStep] = useState(connected ? 1 : 0);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center gap-2 text-xs text-secondary-text">
          {STEPS.map((label, i) => (
            <span key={label} className={i === step ? "font-semibold text-primary-deep" : ""}>
              {i + 1}. {label}
              {i < STEPS.length - 1 ? " ›" : ""}
            </span>
          ))}
        </div>
        <CardTitle className="mt-2 text-base text-foreground">{STEPS[step]}</CardTitle>
      </CardHeader>
      <CardContent>
        {step === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-secondary-text">
              Connect a Meta Business account with ads_management, ads_read, and
              business_management permissions.
            </p>
            <a href="/api/meta/oauth/start">
              <Button>Connect Meta Account</Button>
            </a>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            {adAccounts.length === 0 ? (
              <p className="text-sm text-secondary-text">
                No ad accounts found on this token yet — run a sync from Settings once connected.
              </p>
            ) : (
              adAccounts.map((a) => (
                <div key={a.id} className="rounded-lg border border-border p-3 text-sm">
                  {a.name}
                </div>
              ))
            )}
            <p className="text-xs text-secondary-text">
              All ad accounts on this connection are synced — a per-account switch
              lives in the top bar.
            </p>
            <Button onClick={() => setStep(2)}>Continue</Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            {adAccounts.some((a) => a.pixelId) ? (
              adAccounts.map((a) => (
                <div key={a.id} className="text-sm">
                  {a.name}: {a.pixelId ?? "No pixel detected"}
                </div>
              ))
            ) : (
              <p className="text-sm text-secondary-text">
                Pixel IDs are detected automatically during sync from each ad account&apos;s
                configuration — nothing to configure here manually.
              </p>
            )}
            <Button onClick={() => setStep(3)}>Continue</Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-secondary-text">
              Set your product&apos;s selling price, cost, and margin on the{" "}
              <a href="/settings" className="underline">
                Settings
              </a>{" "}
              page so automation can use Profit Per Purchase, not just ROAS.
            </p>
            <Button onClick={() => setStep(4)}>Continue</Button>
          </div>
        )}

        {step === 4 && settings && (
          <form
            action={(fd) =>
              startTransition(async () => {
                await saveTargetsAndMode(fd);
                setStep(5);
              })
            }
            className="space-y-3"
          >
            <input type="hidden" name="automationMode" value="SIMULATION" />
            <div>
              <label className="text-sm font-medium">Target ROAS</label>
              <input name="targetRoas" type="number" step="0.1" defaultValue={settings.roasGuardTargetRoas} className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium">Target CPA (THB, optional)</label>
              <input name="targetCpa" type="number" defaultValue={settings.targetCpa ?? ""} className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium">Daily Budget Limit (THB)</label>
              <input name="dailyBudgetLimit" type="number" defaultValue={settings.maxAccountDailySpend} className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm" />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Continue"}
            </Button>
          </form>
        )}

        {step === 5 && settings && (
          <form
            action={(fd) =>
              startTransition(async () => {
                await saveTargetsAndMode(fd);
                setDone(true);
              })
            }
            className="space-y-3"
          >
            <input type="hidden" name="targetRoas" value={settings.roasGuardTargetRoas} />
            <input type="hidden" name="targetCpa" value={settings.targetCpa ?? ""} />
            <input type="hidden" name="dailyBudgetLimit" value={settings.maxAccountDailySpend} />
            <p className="text-sm text-secondary-text">
              We recommend starting in <strong>Simulation</strong> — the AI logs what
              it would do without touching your live ads.
            </p>
            <select name="automationMode" defaultValue="SIMULATION" className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm">
              <option value="OFF">Manual (AI does nothing)</option>
              <option value="SIMULATION">Simulation (recommended)</option>
              <option value="APPROVAL_REQUIRED">Approval Required</option>
              <option value="AUTOPILOT">Full Autopilot</option>
            </select>
            <Button type="submit" disabled={pending}>
              {pending ? "Finishing..." : "Finish setup"}
            </Button>
          </form>
        )}

        {done && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-success">Setup complete.</p>
            <a href="/">
              <Button>Go to Dashboard</Button>
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
