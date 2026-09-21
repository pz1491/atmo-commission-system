import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Seeds only the structural rows a brand-new workspace needs to sign in and
// configure automation — an owner account, an organization, and default
// safety settings. Deliberately does NOT create any Campaign/AdSet/Ad/
// Insight rows: those only ever come from a real Meta sync, never from
// fixtures, per the "no fabricated ad data" rule this whole app follows.
async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const email = process.env.SEED_OWNER_EMAIL ?? "owner@example.com";
  const password = process.env.SEED_OWNER_PASSWORD ?? "changeme123";
  const orgName = process.env.SEED_ORG_NAME ?? "Demo Organization";

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name: "Owner", hashedPassword },
    update: {},
  });

  const org = await prisma.organization.upsert({
    where: { slug: "demo-organization" },
    create: { name: orgName, slug: "demo-organization" },
    update: {},
  });

  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
    create: { userId: user.id, organizationId: org.id, role: "OWNER" },
    update: { role: "OWNER" },
  });

  await prisma.safetySettings.upsert({
    where: { organizationId: org.id },
    create: { organizationId: org.id },
    update: {},
  });

  console.log(`Seeded owner account: ${email} / ${password}`);
  console.log(`Organization: ${orgName}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
