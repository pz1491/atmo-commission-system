import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OnboardingWizard } from "./wizard";

export default async function OnboardingPage({
  searchParams,
}: PageProps<"/onboarding">) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    return (
      <div className="flex min-h-screen items-center justify-center text-center">
        <div>
          <h1 className="text-xl font-semibold">No workspace yet</h1>
          <p className="mt-2 text-sm text-secondary-text">
            Ask your workspace owner to add you as a member.
          </p>
        </div>
      </div>
    );
  }

  const params = await searchParams;
  const metaConnected = params.meta_connected === "1";
  const metaError = typeof params.meta_error === "string" ? params.meta_error : null;

  const [connection, settings] = await Promise.all([
    prisma.metaConnection.findFirst({
      where: { organizationId: membership.organizationId, status: "CONNECTED" },
      include: { adAccounts: true },
    }),
    prisma.safetySettings.findUnique({ where: { organizationId: membership.organizationId } }),
  ]);

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-primary-deep">Set up SI Ads Autopilot</h1>
      <p className="mt-1 text-sm text-secondary-text">
        Six steps, then you&apos;re watching real data — never placeholders.
      </p>

      {metaConnected && (
        <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-success dark:bg-green-950/30">
          Meta account connected.
        </div>
      )}
      {metaError && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-danger dark:bg-red-950/30">
          Connection failed: {metaError}
        </div>
      )}

      <OnboardingWizard
        connected={Boolean(connection)}
        adAccounts={connection?.adAccounts.map((a) => ({ id: a.id, name: a.name, pixelId: a.pixelId })) ?? []}
        settings={settings ? JSON.parse(JSON.stringify(settings)) : null}
      />

      <div className="mt-8 text-center">
        <Link href="/" className="text-sm text-primary underline">
          Skip to dashboard
        </Link>
      </div>
    </div>
  );
}
