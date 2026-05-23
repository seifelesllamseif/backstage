// Idempotent slice-2 handoff seeder for an already-seeded DB.
// Run: pnpm tsx --env-file=.env.local prisma/scripts/seed-slice-2-handoffs.ts
//
// Looks up the SKAM company, then inserts handoffs for the four sample tasks
// by title. Skips any task that already has a handoff. Safe to re-run.
// See docs/decisions/0015-slice-2-handoff-architecture.md.

import { prisma } from "../../lib/prisma";
import { seedSlice2Handoffs } from "../slice-2-handoffs";

async function main(): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { slug: "skam" },
    select: { id: true, name: true },
  });
  if (!company) {
    console.error(
      "Patch aborted: no SKAM company. Run `pnpm db:seed` first to set up slice-1 data.",
    );
    process.exit(1);
  }

  console.log(`Patching slice-2 handoffs into ${company.name}…`);
  const result = await seedSlice2Handoffs(prisma, company.id);

  console.log(
    `Done. ${result.inserted} handoff${result.inserted === 1 ? "" : "s"} inserted, ${result.skipped} already present, ${result.missing} target task${result.missing === 1 ? "" : "s"} not found.`,
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
