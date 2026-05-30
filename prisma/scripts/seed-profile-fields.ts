// Patch profile fields on the six Verbivore members in an already-seeded DB.
// Idempotent — skips members whose bio is already populated.
//
// Run: pnpm tsx --env-file=.env.local prisma/scripts/seed-profile-fields.ts
//
// See docs/decisions/0018-profile-pages.md.

import { prisma } from "../../lib/prisma";
import { seedProfileFields } from "../profile-data";

async function main(): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { slug: "verbivore" },
    select: { id: true, name: true },
  });
  if (!company) {
    console.error(
      "Patch aborted: no Verbivore company. Run `pnpm db:seed` first to set up slice-1 data.",
    );
    process.exit(1);
  }

  console.log(`Patching profile fields into ${company.name}…`);
  const result = await seedProfileFields(prisma, company.id);

  console.log(
    `Done. ${result.updated} member${result.updated === 1 ? "" : "s"} updated, ${result.skipped} already populated, ${result.missing} not found.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
