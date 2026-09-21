import { requireOrgContext } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KillSwitchPanel } from "./kill-switch-panel";
import { SafetyForm } from "./safety-form";

export default async function SafetyGuardrailsPage() {
  const { organizationId } = await requireOrgContext();
  const settings = await prisma.safetySettings.findUniqueOrThrow({ where: { organizationId } });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-[28px] font-semibold">Safety Guardrails</h1>

      <Card className="border-danger/40">
        <CardHeader>
          <CardTitle>Emergency Kill Switch</CardTitle>
        </CardHeader>
        <CardContent>
          <KillSwitchPanel active={settings.killSwitchActive} pausesAds={settings.killSwitchPausesAds} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Automation Mode, Limits, ROAS Guard &amp; Scaling</CardTitle>
        </CardHeader>
        <CardContent>
          <SafetyForm settings={JSON.parse(JSON.stringify(settings))} />
        </CardContent>
      </Card>
    </div>
  );
}
