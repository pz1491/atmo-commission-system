import Link from "next/link";
import { requireOrgContext } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { describeCondition, type RuleCondition } from "@/services/automation/ruleEngine";
import { RuleToggle, DeleteRuleButton } from "./rule-controls";
import { PendingApprovalCard } from "./pending-approval-card";

export default async function AutomationPage() {
  const { organizationId } = await requireOrgContext();

  const [rules, pending] = await Promise.all([
    prisma.automationRule.findMany({
      where: { organizationId },
      orderBy: { priority: "desc" },
    }),
    prisma.automationAction.findMany({
      where: { organizationId, status: "PENDING_APPROVAL" },
      orderBy: { createdAt: "desc" },
      include: { campaign: true, adSet: true, ad: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-semibold">Automation</h1>
        <div className="flex gap-2">
          <Link href="/automation/safety">
            <Button variant="secondary">Safety Guardrails</Button>
          </Link>
          <Link href="/automation/new">
            <Button>New Rule</Button>
          </Link>
        </div>
      </div>

      {pending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Awaiting Approval ({pending.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.map((p) => (
              <PendingApprovalCard
                key={p.id}
                id={p.id}
                entityName={p.campaign?.name ?? p.adSet?.name ?? p.ad?.name ?? "Unknown"}
                actionType={p.actionType}
                reason={p.reason}
              />
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Rules</CardTitle>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <p className="py-8 text-center text-sm text-secondary-text">
              No rules yet.{" "}
              <Link href="/automation/new" className="text-primary underline">
                Create your first rule
              </Link>
              .
            </p>
          ) : (
            <div className="divide-y divide-border">
              {rules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{rule.name}</span>
                      <Badge tone={rule.isActive ? "success" : "default"}>
                        {rule.isActive ? "Active" : "Paused"}
                      </Badge>
                      <Badge tone="info">{rule.targetType}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-secondary-text">
                      IF {(rule.conditions as unknown as RuleCondition[]).map(describeCondition).join(" AND ")}{" "}
                      THEN {rule.action.replaceAll("_", " ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <RuleToggle ruleId={rule.id} isActive={rule.isActive} />
                    <DeleteRuleButton ruleId={rule.id} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
