import { requireOrgContext } from "@/lib/session";
import { getDaypartingHeatmap } from "@/services/analytics/dayparting";
import { getTrackingHealth } from "@/services/analytics/trackingHealth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DaypartingHeatmap } from "@/components/dashboard/dayparting-heatmap";

export default async function AnalyticsPage() {
  const { organizationId } = await requireOrgContext();
  const [cells, tracking] = await Promise.all([
    getDaypartingHeatmap(organizationId),
    getTrackingHealth(organizationId),
  ]);

  const hasHeatmapData = cells.some((c) => c.classification !== "NO_DATA");

  return (
    <div className="space-y-6">
      <h1 className="text-[28px] font-semibold">Analytics</h1>

      <Card>
        <CardHeader>
          <CardTitle>Dayparting — ROAS by day &amp; hour</CardTitle>
        </CardHeader>
        <CardContent>
          {!hasHeatmapData ? (
            <p className="py-8 text-center text-sm text-secondary-text">
              No hourly data synced yet — the last 7 days of hourly breakdowns
              populate this after your next sync.
            </p>
          ) : (
            <DaypartingHeatmap cells={cells} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tracking Health</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {tracking.anomalyDetected && (
            <div className="rounded-lg border border-danger/40 bg-red-50 p-3 text-sm text-danger dark:bg-red-950/20">
              Possible tracking issue: purchases ({tracking.todayPurchases}) are far
              below the 7-day average ({tracking.avgPurchasesPerDay.toFixed(1)}/day)
              despite similar spend.
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 text-sm">
            <div>
              <div className="text-secondary-text">Purchases Today</div>
              <div className="font-medium">{tracking.todayPurchases}</div>
            </div>
            <div>
              <div className="text-secondary-text">Add To Cart Today</div>
              <div className="font-medium">{tracking.todayAddToCart}</div>
            </div>
            <div>
              <div className="text-secondary-text">Initiate Checkout Today</div>
              <div className="font-medium">{tracking.todayInitiateCheckout}</div>
            </div>
            <div>
              <div className="text-secondary-text">7-day Avg Purchases/day</div>
              <div className="font-medium">{tracking.avgPurchasesPerDay.toFixed(1)}</div>
            </div>
          </div>
          <div className="divide-y divide-border">
            {tracking.accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2 text-sm">
                <span>{a.name}</span>
                <div className="flex gap-2">
                  <Badge tone={a.pixelId ? "success" : "warning"}>
                    Pixel {a.pixelId ? "Connected" : "Not detected"}
                  </Badge>
                  <Badge tone={a.connectionStatus === "CONNECTED" ? "success" : "danger"}>
                    {a.connectionStatus}
                  </Badge>
                  <Badge tone={a.syncStatus === "FRESH" ? "success" : a.syncStatus === "DELAYED" ? "warning" : "danger"}>
                    {a.syncStatus}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
