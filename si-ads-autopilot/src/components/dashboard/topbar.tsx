import Link from "next/link";
import { Bell, Power } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { SignOutButton } from "./sign-out-button";

export async function Topbar({ organizationId }: { organizationId: string }) {
  const [adAccounts, settings, unreadAlerts] = await Promise.all([
    prisma.adAccount.findMany({
      where: { metaConnection: { organizationId } },
      select: { id: true, name: true, externalId: true },
      take: 10,
    }),
    prisma.safetySettings.findUnique({ where: { organizationId } }),
    prisma.alert.count({ where: { organizationId, isRead: false } }),
  ]);

  const mode = settings?.automationMode ?? "OFF";
  const modeTone =
    mode === "AUTOPILOT" ? "success" : mode === "OFF" ? "default" : "warning";

  return (
    <header className="flex h-16 items-center gap-4 border-b border-border bg-card px-6">
      <select
        className="rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm"
        disabled={adAccounts.length === 0}
      >
        {adAccounts.length === 0 ? (
          <option>No ad account connected</option>
        ) : (
          adAccounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name} ({acc.externalId})
            </option>
          ))
        )}
      </select>

      <select className="rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm">
        <option>Today</option>
        <option>Yesterday</option>
        <option>7 Days</option>
        <option>14 Days</option>
        <option>30 Days</option>
        <option>Custom Range</option>
      </select>

      <div className="ml-auto flex items-center gap-4">
        <Link href="/automation/safety" className="flex items-center gap-2">
          {settings?.killSwitchActive ? (
            <Badge tone="danger">
              <Power size={12} /> KILL SWITCH ACTIVE
            </Badge>
          ) : (
            <Badge tone={modeTone}>
              <span
                className={mode === "AUTOPILOT" ? "pulse-live h-1.5 w-1.5 rounded-full bg-green-500" : ""}
              />
              AUTOPILOT {mode}
            </Badge>
          )}
        </Link>

        <Link href="/alerts" className="relative text-secondary-text hover:text-foreground">
          <Bell size={18} />
          {unreadAlerts > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] text-white">
              {unreadAlerts > 9 ? "9+" : unreadAlerts}
            </span>
          )}
        </Link>

        <SignOutButton />
      </div>
    </header>
  );
}
