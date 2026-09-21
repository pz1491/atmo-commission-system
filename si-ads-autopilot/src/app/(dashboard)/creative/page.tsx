import { requireOrgContext } from "@/lib/session";
import { getCreativePerformance } from "@/services/creative/performance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreativeTable } from "./creative-table";

export default async function CreativePage() {
  const { organizationId } = await requireOrgContext();
  const rows = await getCreativePerformance(organizationId);
  const fatigued = rows.filter((r) => r.fatigueDetected);

  return (
    <div className="space-y-6">
      <h1 className="text-[28px] font-semibold">Creative Performance</h1>

      {fatigued.length > 0 && (
        <Card className="border-danger/40 bg-red-50 p-4 text-sm dark:bg-red-950/20">
          <strong>Creative Fatigue Detected</strong> on {fatigued.length} ad
          {fatigued.length > 1 ? "s" : ""} — frequency rising, CTR falling, and CPA
          rising together. Recommendation: prepare new creative.
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Ads</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-secondary-text">No ad-level data synced yet.</p>
          ) : (
            <CreativeTable rows={rows} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
