import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Resolves the signed-in user's active organization membership. A user can
 * belong to multiple organizations (Membership is many-to-many via join
 * table), but this build's UI only ever operates on the first one — an org
 * switcher is future work, not a change to the data model.
 */
export async function requireOrgContext() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) redirect("/onboarding");

  return {
    userId: session.user.id,
    role: membership.role,
    organizationId: membership.organizationId,
    organization: membership.organization,
  };
}

/** Same lookup as requireOrgContext, but for route handlers — returns null instead of redirecting. */
export async function getOrgContextForApi() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) return null;

  return {
    userId: session.user.id,
    role: membership.role,
    organizationId: membership.organizationId,
    organization: membership.organization,
  };
}
