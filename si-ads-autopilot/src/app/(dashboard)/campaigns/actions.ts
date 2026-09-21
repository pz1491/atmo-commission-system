"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/session";
import { assertCan } from "@/lib/rbac";
import { executeAutomationAction } from "@/services/automation/execute";
import type { EntityType } from "@/generated/prisma/enums";

export async function pauseResumeAction(entityType: EntityType, entityId: string, resume: boolean) {
  const { organizationId, userId, role } = await requireOrgContext();
  assertCan(role, "MANAGE_ADS");

  await executeAutomationAction({
    organizationId,
    ruleId: null,
    ruleName: null,
    entityType,
    entityId,
    actionType: resume ? "RESUME" : "PAUSE",
    reason: "Manual action from Campaign Explorer",
    actorUserId: userId,
  });

  revalidatePath("/campaigns");
}

export async function setBudgetAction(entityType: EntityType, entityId: string, currentBudget: number, newBudget: number) {
  const { organizationId, userId, role } = await requireOrgContext();
  assertCan(role, "MANAGE_ADS");

  const delta = newBudget - currentBudget;
  if (delta === 0) return;

  await executeAutomationAction({
    organizationId,
    ruleId: null,
    ruleName: null,
    entityType,
    entityId,
    actionType: delta > 0 ? "INCREASE_BUDGET_FIXED" : "DECREASE_BUDGET_FIXED",
    reason: "Manual budget edit from Campaign Explorer",
    actionParams: { amount: Math.abs(delta) },
    actorUserId: userId,
  });

  revalidatePath("/campaigns");
}

export async function duplicateEntityAction(entityType: EntityType, entityId: string) {
  const { organizationId, userId, role } = await requireOrgContext();
  assertCan(role, "MANAGE_ADS");

  await executeAutomationAction({
    organizationId,
    ruleId: null,
    ruleName: null,
    entityType,
    entityId,
    actionType: "DUPLICATE",
    reason: "Manual duplicate from Campaign Explorer",
    actorUserId: userId,
  });

  revalidatePath("/campaigns");
}
