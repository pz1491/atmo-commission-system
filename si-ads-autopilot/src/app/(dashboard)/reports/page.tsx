import { requireOrgContext } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTHB, formatNumber } from "@/lib/utils";

interface DailyReportData {
  spend: number;
  revenue: number;
  purchases: number;
  roas: number | null;
  pausedByAi: number;
  scaledByAi: number;
  winners: { name: string; roas: number }[];
  losers: { name: string; roas: number }[];
  riskAlerts: { type: string; title: string; severity: string }[];
}

export default async function ReportsPage() {
  const { organizationId } = await requireOrgContext();
  const reports = await prisma.report.findMany({
    where: { organizationId, type: "DAILY_SUMMARY" },
    orderBy: { periodStart: "desc" },
    take: 30,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-[28px] font-semibold">Daily Reports</h1>
      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-secondary-text">
            No daily reports generated yet — the daily-report worker creates one
            automatically after each day closes.
          </CardContent>
        </Card>
      ) : (
        reports.map((r) => {
          const d = r.data as unknown as DailyReportData;
          return (
            <Card key={r.id}>
              <CardHeader>
                <CardTitle>{r.periodStart.toLocaleDateString("th-TH", { dateStyle: "full" })}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                  <Stat label="Spend" value={formatTHB(d.spend)} />
                  <Stat label="Revenue" value={formatTHB(d.revenue)} />
                  <Stat label="Purchases" value={formatNumber(d.purchases)} />
                  <Stat label="ROAS" value={d.roas ? `${d.roas.toFixed(2)}x` : "—"} />
                  <Stat label="AI Actions" value={`${d.pausedByAi} paused / ${d.scaledByAi} scaled`} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-success">Winners</div>
                    {d.winners.length === 0 ? (
                      <p className="text-sm text-secondary-text">None</p>
                    ) : (
                      d.winners.map((w, i) => (
                        <div key={i} className="text-sm">
                          {w.name} — {w.roas.toFixed(2)}x
                        </div>
                      ))
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-danger">Losers</div>
                    {d.losers.length === 0 ? (
                      <p className="text-sm text-secondary-text">None</p>
                    ) : (
                      d.losers.map((l, i) => (
                        <div key={i} className="text-sm">
                          {l.name} — {l.roas.toFixed(2)}x
                        </div>
                      ))
                    )}
                  </div>
                </div>
                {d.riskAlerts.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-warning">Risk Alerts</div>
                    {d.riskAlerts.map((a, i) => (
                      <div key={i} className="text-sm text-secondary-text">
                        {a.title}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-secondary-text">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
