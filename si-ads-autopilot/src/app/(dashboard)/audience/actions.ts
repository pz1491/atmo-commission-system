"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/session";
import { discoverAudience } from "@/services/audience/discover";

export async function runAudienceDiscovery(formData: FormData) {
  const { organizationId } = await requireOrgContext();

  await discoverAudience(organizationId, {
    productName: String(formData.get("productName") ?? ""),
    productDescription: String(formData.get("productDescription") ?? ""),
    targetCustomer: String(formData.get("targetCustomer") ?? ""),
    price: formData.get("price") ? Number(formData.get("price")) : null,
    country: String(formData.get("country") ?? "TH"),
  });

  revalidatePath("/audience");
}
