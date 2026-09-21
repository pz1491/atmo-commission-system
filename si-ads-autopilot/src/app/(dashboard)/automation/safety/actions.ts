"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/session";
import { assertCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { executeAutomationAction } from "@/services/automation/execute";
import type { AutomationMode } from "@/generated/prisma/enums";

export async function updateSafetySettings(formData: FormData) {
  const { organizationId, role } = await requireOrgContext();
  assertCan(role, "MANAGE_AUTOMATION");

  const num = (key: string) => Number(formData.get(key));

  await prisma.safetySettings.update({
    where: { organizationId },
    data: {
      automationMode: formData.get("automationMode") as AutomationMode,
      maxAccountDailySpend: num("maxAccountDailySpend"),
      maxCampaignDailyBudget: num("maxCampaignDailyBudget"),
      maxIncreasePerActionPercent: num("maxIncreasePerActionPercent"),
      maxBudgetIncreasePer24hPercent: num("maxBudgetIncreasePer24hPercent"),
      maxDuplicatesPerDay: num("maxDuplicatesPerDay"),
      maxAiActionsPerHour: num("maxAiActionsPerHour"),
      budgetChangeCooldownHours: num("budgetChangeCooldownHours"),
      roasGuardTargetRoas: num("roasGuardTargetRoas"),
      roasGuardBreakEvenRoas: num("roasGuardBreakEvenRoas"),
      roasGuardMinPurchases: num("roasGuardMinPurchases"),
      roasGuardMinSpend: num("roasGuardMinSpend"),
      scalingStrategy: formData.get("scalingStrategy") as string,
      scalingIncreasePercent: num("scalingIncreasePercent"),
      scalingMinPurchases: num("scalingMinPurchases"),
      scalingMinSpend: num("scalingMinSpend"),
      scalingMinActiveHours: num("scalingMinActiveHours"),
      dataFreshnessMaxMinutes: num("dataFreshnessMaxMinutes"),
    },
  });

  revalidatePath("/automation/safety");
}

export async function setKillSwitch(active: boolean, pausesAds: boolean) {
  const { organizationId, userId, role } = await requireOrgContext();
  assertCan(role, "MANAGE_AUTOMATION");

  await prisma.safetySettings.update({
    where: { organizationId },
    data: { killSwitchActive: active, killSwitchPausesAds: pausesAds },
  });

  if (active && pausesAds) {
    const campaigns = await prisma.campaign.findMany({
      where: { adAccount: { metaConnection: { organizationId } }, status: "ACTIVE" },
      select: { id: true },
    });
    for (const c of campaigns) {
      await executeAutomationAction({
        organizationId,
        ruleId: null,
        ruleName: null,
        entityType: "CAMPAIGN",
        entityId: c.id,
        actionType: "PAUSE",
        reason: "Kill switch activated with 'pause all active ads' enabled",
        actorUserId: userId,
      });
    }
  }

  revalidatePath("/automation/safety");
  revalidatePath("/");
}
