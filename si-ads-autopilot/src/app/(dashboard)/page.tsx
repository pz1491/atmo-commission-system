import Link from "next/link";
import { requireOrgContext } from "@/lib/session";
import { getOverviewData } from "@/services/dashboard/overview";
import { StatCard } from "@/components/dashboard/stat-card";
import { SpendRevenueChart } from "@/components/dashboard/spend-revenue-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTHB, formatNumber, formatPercent } from "@/lib/utils";
import { prisma } from "@/lib/prisma";

const RANGE_OPTIONS: Record<string, number> = {
  today: 1,
  "7d": 7,
  "14d": 14,
  "30d": 30,
};

export default async function OverviewPage({
  searchParams,
}: PageProps<"/">) {
  const { organizationId } = await requireOrgContext();
  const params = await searchParams;
  const rangeKey = typeof params.range === "string" ? params.range : "7d";
  const rangeDays = RANGE_OPTIONS[rangeKey] ?? 7;

  const hasConnection = await prisma.metaConnection.findFirst({
    where: { organizationId, status: "CONNECTED" },
  });

  if (!hasConnection) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-semibold">Connect your Meta Ad Account</h1>
        <p className="mt-2 max-w-md text-secondary-text">
          No live data yet — the dashboard only ever shows real synced numbers,
          never placeholders. Connect a Meta Business account to get started.
        </p>
        <Link
          href="/onboarding"
          className="mt-6 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-deep"
        >
          Start onboarding
        </Link>
      </div>
    );
  }

  const data = await getOverviewData(organizationId, rangeDays);
  const m = data.today;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-semibold">Overview</h1>
        <div className="flex gap-2 text-sm">
          {Object.keys(RANGE_OPTIONS).map((key) => (
            <Link
              key={key}
              href={`/?range=${key}`}
              className={`rounded-lg px-3 py-1.5 ${
                rangeKey === key
                  ? "bg-primary-light text-primary-deep"
                  : "text-secondary-text hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {key.toUpperCase()}
            </Link>
          ))}
        </div>
      </div>

      {!data.hasAnyData && (
        <Card className="border-warning/40 bg-amber-50 p-4 text-sm dark:bg-amber-950/30">
          Connected, but no synced insight data yet. Run a sync from{" "}
          <Link href="/settings" className="underline">
            Settings
          </Link>{" "}
          to populate real numbers.
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Spend Today"
          value={m.spend}
          format={formatTHB}
          changePercent={data.changeVsYesterday.spend}
          invertChangeColor
        />
        <StatCard
          label="Revenue Today"
          value={m.purchaseValue}
          format={formatTHB}
          changePercent={data.changeVsYesterday.revenue}
        />
        <StatCard
          label="Purchases"
          value={m.purchases}
          format={(v) => formatNumber(Math.round(v))}
          changePercent={data.changeVsYesterday.purchases}
        />
        <StatCard label="ROAS" value={m.roas ?? 0} format={(v) => `${v.toFixed(2)}x`} />
        <StatCard label="CPA" value={m.cpa ?? 0} format={formatTHB} invertChangeColor />
        <StatCard label="CTR" value={m.ctr ?? 0} format={(v) => formatPercent(v, 2)} />
        <StatCard label="CPM" value={m.cpm ?? 0} format={formatTHB} />
        <StatCard
          label="Active Campaigns"
          value={data.activeCampaigns}
          format={(v) => formatNumber(Math.round(v))}
        />
        <StatCard
          label="Ads Paused by AI"
          value={data.adsPausedToday}
          format={(v) => formatNumber(Math.round(v))}
        />
        <StatCard
          label="AI Budget Saved (est.)"
          value={data.budgetSavedToday}
          format={formatTHB}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Spend vs Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <SpendRevenueChart data={data.chartData} />
        </CardContent>
      </Card>
    </div>
  );
}
