import { requireOrgContext } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertRow } from "./alert-row";

export default async function AlertsPage() {
  const { organizationId } = await requireOrgContext();
  const alerts = await prisma.alert.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-[28px] font-semibold">Alerts</h1>
      <Card>
        <CardHeader>
          <CardTitle>
            ROAS drops, spend spikes, no-purchase ads, creative fatigue, tracking
            issues, and Meta API errors — all threshold-based on real synced data.
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <p className="py-8 text-center text-sm text-secondary-text">No alerts yet.</p>
          ) : (
            alerts.map((a) => (
              <AlertRow
                key={a.id}
                id={a.id}
                type={a.type}
                severity={a.severity}
                title={a.title}
                message={a.message}
                isRead={a.isRead}
                createdAt={a.createdAt.toISOString()}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
