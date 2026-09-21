import { NextResponse } from "next/server";
import { getOrgContextForApi } from "@/lib/session";
import { syncAllAdAccountsForOrganization } from "@/services/meta/sync";

// Manual trigger for the sync that would otherwise run on the background
// worker's interval (spec section 32). Automation itself never runs from
// the browser — this just lets a user (or the worker) kick a sync now.
export async function POST() {
  const ctx = await getOrgContextForApi();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const results = await syncAllAdAccountsForOrganization(ctx.organizationId);
  return NextResponse.json({ results });
}
