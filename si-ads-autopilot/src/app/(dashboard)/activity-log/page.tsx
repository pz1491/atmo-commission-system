import { requireOrgContext } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const RESULT_TONE = { SUCCESS: "success", FAILED: "danger", BLOCKED: "warning" } as const;

export default async function ActivityLogPage() {
  const { organizationId } = await requireOrgContext();

  const logs = await prisma.auditLog.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actorUser: { select: { name: true, email: true } } },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-[28px] font-semibold">Activity Log</h1>
      <Card>
        <CardHeader>
          <CardTitle>What AI (and your team) changed</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="py-8 text-center text-sm text-secondary-text">No activity recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-secondary-text">
                    <th className="px-2 py-2">Time</th>
                    <th className="px-2 py-2">Actor</th>
                    <th className="px-2 py-2">Action</th>
                    <th className="px-2 py-2">Entity</th>
                    <th className="px-2 py-2">Before → After</th>
                    <th className="px-2 py-2">Reason</th>
                    <th className="px-2 py-2">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-border align-top">
                      <td className="whitespace-nowrap px-2 py-2 text-xs text-secondary-text">
                        {log.createdAt.toLocaleString("th-TH")}
                      </td>
                      <td className="px-2 py-2">
                        {log.actorType === "AI" ? (
                          <Badge tone="info">AI</Badge>
                        ) : (
                          <span>{log.actorUser?.name ?? log.actorUser?.email ?? "System"}</span>
                        )}
                      </td>
                      <td className="px-2 py-2">{log.action.replaceAll("_", " ")}</td>
                      <td className="px-2 py-2 text-xs text-secondary-text">
                        {log.entityType} {log.entityId?.slice(0, 8)}
                      </td>
                      <td className="max-w-[220px] truncate px-2 py-2 text-xs text-secondary-text">
                        {JSON.stringify(log.before)} → {JSON.stringify(log.after)}
                      </td>
                      <td className="max-w-[280px] px-2 py-2 text-xs text-secondary-text">{log.reason}</td>
                      <td className="px-2 py-2">
                        <Badge tone={RESULT_TONE[log.result]}>{log.result}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
