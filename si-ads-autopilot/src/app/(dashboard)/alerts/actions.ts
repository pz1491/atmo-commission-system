"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function markAlertRead(alertId: string) {
  const { organizationId } = await requireOrgContext();
  await prisma.alert.updateMany({
    where: { id: alertId, organizationId },
    data: { isRead: true },
  });
  revalidatePath("/alerts");
}

export async function markAllAlertsRead() {
  const { organizationId } = await requireOrgContext();
  await prisma.alert.updateMany({
    where: { organizationId, isRead: false },
    data: { isRead: true },
  });
  revalidatePath("/alerts");
}
