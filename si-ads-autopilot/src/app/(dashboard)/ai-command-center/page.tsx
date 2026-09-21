import { requireOrgContext } from "@/lib/session";
import { getCommandCenterData } from "@/services/dashboard/commandCenter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActionFeedItem } from "@/components/dashboard/action-feed-item";
import { formatTHB, formatNumber } from "@/lib/utils";

function timeAgo(date: Date | null): string {
  if (!date) return "Never";
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"} ago`;
}

export default async function AiCommandCenterPage() {
  const { organizationId } = await requireOrgContext();
  const data = await getCommandCenterData(organizationId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-semibold">AI Command Center</h1>
        <Badge tone={data.killSwitchActive ? "danger" : data.mode === "AUTOPILOT" ? "success" : "warning"}>
          {data.killSwitchActive ? "KILL SWITCH ACTIVE" : `AUTOPILOT ${data.mode}`}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="p-5">
          <div className="text-sm text-secondary-text">Last Scan</div>
          <div className="mt-1 text-xl font-semibold">{timeAgo(data.lastScan)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-secondary-text">Today&apos;s Actions</div>
          <div className="mt-1 text-xl font-semibold">{formatNumber(data.todaysActions)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-secondary-text">Active Rules</div>
          <div className="mt-1 text-xl font-semibold">{formatNumber(data.activeRules)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-secondary-text">Budget Saved (est.)</div>
          <div className="mt-1 text-xl font-semibold">{formatTHB(data.budgetSaved)}</div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Action Feed</CardTitle>
        </CardHeader>
        <CardContent>
          {data.feed.length === 0 ? (
            <p className="py-8 text-center text-sm text-secondary-text">
              No automation actions yet — they&apos;ll show up here once rules start
              evaluating against synced data.
            </p>
          ) : (
            <div>
              {data.feed.map((item) => (
                <ActionFeedItem key={item.id} {...item} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
