import { NextResponse } from "next/server";
import { getOrgContextForApi } from "@/lib/session";
import { evaluateRulesForOrganization } from "@/services/automation/evaluator";

// Manual/worker trigger for a rule-evaluation pass (spec section 32). Runs
// server-side only — see src/workers/rules.worker.ts for the scheduled path.
export async function POST() {
  const ctx = await getOrgContextForApi();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const results = await evaluateRulesForOrganization(ctx.organizationId);
  return NextResponse.json({ results });
}
