import { requireOrgContext } from "@/lib/session";
import { getBudgetControlData } from "@/services/budget/control";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatTHB } from "@/lib/utils";

export default async function BudgetPage() {
  const { organizationId } = await requireOrgContext();
  const data = await getBudgetControlData(organizationId);

  return (
    <div className="space-y-6">
      <h1 className="text-[28px] font-semibold">Budget Control Center</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="p-5">
          <div className="text-sm text-secondary-text">Today&apos;s Budget</div>
          <div className="mt-1 text-xl font-semibold">{formatTHB(data.totalDailyBudget)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-secondary-text">Spent</div>
          <div className="mt-1 text-xl font-semibold">{formatTHB(data.spendToday)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-secondary-text">Projected (end of day)</div>
          <div className="mt-1 text-xl font-semibold">{formatTHB(data.projectedSpend)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-secondary-text">Remaining Budget</div>
          <div className="mt-1 text-xl font-semibold">{formatTHB(data.remainingBudget)}</div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Spend Caps</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-secondary-text">Account Spend Cap</div>
            <div className="font-medium">{data.accountSpendCap ? formatTHB(data.accountSpendCap) : "Not set"}</div>
          </div>
          <div>
            <div className="text-secondary-text">Campaign Spend Cap</div>
            <div className="font-medium">{data.campaignSpendCap ? formatTHB(data.campaignSpendCap) : "Not set"}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Forecast</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-secondary-text">Expected Revenue</div>
            <div className="font-medium">{data.expectedRevenue ? formatTHB(data.expectedRevenue) : "—"}</div>
          </div>
          <div>
            <div className="text-secondary-text">Expected ROAS</div>
            <div className="font-medium">{data.expectedRoas ? `${data.expectedRoas.toFixed(2)}x` : "—"}</div>
          </div>
          <div>
            <div className="text-secondary-text">Confidence</div>
            <Badge tone={data.confidence === "High" ? "success" : data.confidence === "Medium" ? "warning" : "default"}>
              {data.confidence}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Campaign Budgets</CardTitle>
        </CardHeader>
        <CardContent>
          {data.campaigns.length === 0 ? (
            <p className="py-4 text-center text-sm text-secondary-text">No active campaigns.</p>
          ) : (
            <div className="divide-y divide-border">
              {data.campaigns.map((c) => (
                <div key={c.id} className="flex justify-between py-2 text-sm">
                  <span>{c.name}</span>
                  <span className="font-medium">{formatTHB(c.dailyBudget)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
