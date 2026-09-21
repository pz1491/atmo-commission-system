"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/session";
import { assertCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { executeAutomationAction } from "@/services/automation/execute";
import type { RuleCondition } from "@/services/automation/ruleEngine";
import type { ActionType, EntityType } from "@/generated/prisma/enums";
import type { ActionParams } from "@/services/automation/execute";

export interface CreateRuleInput {
  name: string;
  description?: string;
  targetType: EntityType;
  conditions: RuleCondition[];
  action: ActionType;
  actionParams?: ActionParams;
  cooldownHours: number;
  maxTriggersPerDay: number;
  priority: number;
}

export async function createRule(input: CreateRuleInput) {
  const { organizationId, userId, role } = await requireOrgContext();
  assertCan(role, "MANAGE_AUTOMATION");

  await prisma.automationRule.create({
    data: {
      organizationId,
      name: input.name,
      description: input.description,
      targetType: input.targetType,
      conditions: input.conditions as never,
      action: input.action,
      actionParams: (input.actionParams as never) ?? undefined,
      cooldownHours: input.cooldownHours,
      maxTriggersPerDay: input.maxTriggersPerDay,
      priority: input.priority,
      createdById: userId,
    },
  });

  revalidatePath("/automation");
}

export async function toggleRuleActive(ruleId: string, isActive: boolean) {
  const { organizationId, role } = await requireOrgContext();
  assertCan(role, "MANAGE_AUTOMATION");

  await prisma.automationRule.updateMany({
    where: { id: ruleId, organizationId },
    data: { isActive },
  });
  revalidatePath("/automation");
}

export async function deleteRule(ruleId: string) {
  const { organizationId, role } = await requireOrgContext();
  assertCan(role, "MANAGE_AUTOMATION");

  await prisma.automationRule.deleteMany({ where: { id: ruleId, organizationId } });
  revalidatePath("/automation");
}

export async function approvePendingAction(actionId: string) {
  const { organizationId, userId, role } = await requireOrgContext();
  assertCan(role, "MANAGE_ADS");

  const pending = await prisma.automationAction.findFirstOrThrow({
    where: { id: actionId, organizationId, status: "PENDING_APPROVAL" },
  });

  await executeAutomationAction({
    organizationId,
    ruleId: pending.ruleId,
    ruleName: pending.ruleTriggered,
    entityType: pending.entityType,
    entityId: (pending.campaignId ?? pending.adSetId ?? pending.adId)!,
    actionType: pending.actionType,
    reason: pending.reason,
    forceExecute: true,
    actorUserId: userId,
  });

  // The original PENDING_APPROVAL row stays as a record; mark it superseded.
  await prisma.automationAction.update({
    where: { id: actionId },
    data: { status: "IGNORED", blockedReason: "Approved — see the newer EXECUTED action for this entity." },
  });

  revalidatePath("/automation");
  revalidatePath("/ai-command-center");
}

export async function ignorePendingAction(actionId: string) {
  const { organizationId, role } = await requireOrgContext();
  assertCan(role, "MANAGE_ADS");

  await prisma.automationAction.updateMany({
    where: { id: actionId, organizationId, status: "PENDING_APPROVAL" },
    data: { status: "IGNORED" },
  });
  revalidatePath("/automation");
}
