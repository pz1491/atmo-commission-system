"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/session";
import { assertCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { syncAllAdAccountsForOrganization } from "@/services/meta/sync";
import type { Role } from "@/generated/prisma/enums";

export async function triggerSync() {
  const { organizationId } = await requireOrgContext();
  await syncAllAdAccountsForOrganization(organizationId);
  revalidatePath("/settings");
  revalidatePath("/");
}

export async function addMemberByEmail(formData: FormData) {
  const { organizationId, role: myRole } = await requireOrgContext();
  assertCan(myRole, "MANAGE_ORGANIZATION");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = formData.get("role") as Role;
  if (!email) return { error: "Email is required." };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { error: `No user with email ${email} has signed up yet.` };
  }

  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId } },
    create: { userId: user.id, organizationId, role },
    update: { role },
  });

  revalidatePath("/settings");
}

export async function removeMember(membershipId: string) {
  const { organizationId, role } = await requireOrgContext();
  assertCan(role, "MANAGE_ORGANIZATION");

  await prisma.membership.deleteMany({ where: { id: membershipId, organizationId } });
  revalidatePath("/settings");
}

export async function upsertProductEconomics(formData: FormData) {
  const { organizationId, role } = await requireOrgContext();
  assertCan(role, "MANAGE_AUTOMATION");

  const num = (key: string) => Number(formData.get(key));
  const name = String(formData.get("name") ?? "Product");
  const productId = formData.get("productId") as string | null;

  const product = productId
    ? await prisma.product.update({ where: { id: productId }, data: { name } })
    : await prisma.product.create({ data: { organizationId, name } });

  await prisma.productEconomics.upsert({
    where: { productId: product.id },
    create: {
      productId: product.id,
      sellingPrice: num("sellingPrice"),
      cogs: num("cogs"),
      shippingCost: num("shippingCost"),
      platformFeePercent: num("platformFeePercent"),
      vatPercent: num("vatPercent"),
      paymentFeePercent: num("paymentFeePercent"),
      refundRatePercent: num("refundRatePercent"),
      otherCost: num("otherCost"),
    },
    update: {
      sellingPrice: num("sellingPrice"),
      cogs: num("cogs"),
      shippingCost: num("shippingCost"),
      platformFeePercent: num("platformFeePercent"),
      vatPercent: num("vatPercent"),
      paymentFeePercent: num("paymentFeePercent"),
      refundRatePercent: num("refundRatePercent"),
      otherCost: num("otherCost"),
    },
  });

  revalidatePath("/settings");
  revalidatePath("/budget");
}
