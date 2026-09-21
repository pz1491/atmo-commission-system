"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/session";
import { assertCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import type { AutomationMode } from "@/generated/prisma/enums";

export async function saveTargetsAndMode(formData: FormData) {
  const { organizationId, role } = await requireOrgContext();
  assertCan(role, "MANAGE_AUTOMATION");

  await prisma.safetySettings.update({
    where: { organizationId },
    data: {
      roasGuardTargetRoas: Number(formData.get("targetRoas")),
      targetCpa: formData.get("targetCpa") ? Number(formData.get("targetCpa")) : null,
      maxAccountDailySpend: Number(formData.get("dailyBudgetLimit")),
      automationMode: formData.get("automationMode") as AutomationMode,
    },
  });

  revalidatePath("/onboarding");
  revalidatePath("/automation/safety");
}
