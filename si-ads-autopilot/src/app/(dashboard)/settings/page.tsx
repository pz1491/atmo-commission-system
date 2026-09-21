import Link from "next/link";
import { requireOrgContext } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SyncButton } from "./sync-button";
import { AddMemberForm } from "./members-form";
import { ProductEconomicsForm } from "./product-economics-form";

export default async function SettingsPage() {
  const { organizationId } = await requireOrgContext();

  const [connections, memberships, products] = await Promise.all([
    prisma.metaConnection.findMany({
      where: { organizationId },
      include: { adAccounts: true },
    }),
    prisma.membership.findMany({
      where: { organizationId },
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.product.findMany({ where: { organizationId }, include: { economics: true } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-[28px] font-semibold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Meta Connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {connections.length === 0 ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-secondary-text">No Meta Business account connected yet.</p>
              <a href="/api/meta/oauth/start">
                <Button>Connect Meta Account</Button>
              </a>
            </div>
          ) : (
            connections.map((c) => (
              <div key={c.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge tone={c.status === "CONNECTED" ? "success" : "danger"}>{c.status}</Badge>
                    <span className="text-sm">Meta user {c.metaUserId}</span>
                  </div>
                  <div className="flex gap-2">
                    <SyncButton />
                    <a href="/api/meta/oauth/start">
                      <Button variant="secondary" size="sm">Reconnect</Button>
                    </a>
                  </div>
                </div>
                {c.lastError && <p className="mt-2 text-xs text-danger">{c.lastError}</p>}
                <div className="mt-3 space-y-1">
                  {c.adAccounts.map((acc) => (
                    <div key={acc.id} className="flex justify-between text-sm">
                      <span>{acc.name} ({acc.externalId})</span>
                      <span className="text-xs text-secondary-text">
                        {acc.lastSyncedAt ? `Synced ${acc.lastSyncedAt.toLocaleString("th-TH")}` : "Never synced"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
          <p className="text-xs text-secondary-text">
            Tracking health for pixel/CAPI events lives on the{" "}
            <Link href="/analytics" className="underline">
              Analytics
            </Link>{" "}
            page.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members &amp; Roles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="divide-y divide-border">
            {memberships.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2 text-sm">
                <span>{m.user.name ?? m.user.email}</span>
                <Badge tone="info">{m.role}</Badge>
              </div>
            ))}
          </div>
          <AddMemberForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Product Economics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {products.length > 0 && (
            <div className="space-y-1 text-sm">
              {products.map((p) => (
                <div key={p.id} className="flex justify-between">
                  <span>{p.name}</span>
                  <span className="text-secondary-text">
                    {p.economics ? `Selling price ${Number(p.economics.sellingPrice)} THB` : "No economics set"}
                  </span>
                </div>
              ))}
            </div>
          )}
          <ProductEconomicsForm />
        </CardContent>
      </Card>
    </div>
  );
}
