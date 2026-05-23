// Seed script for Backstage slice 1.
// One-shot: refuses to run if the SKAM company already exists.
// See docs/decisions/0009-seed-script-approach.md for the full rationale.
//
// Env is loaded by Node's --env-file=.env.local flag (passed via the tsx
// command in package.json#db:seed and prisma.config.ts#migrations.seed).
// Loading env in source code would fail because ES module imports are
// hoisted and lib/prisma.ts reads DATABASE_URL at import time.

import WebSocket from "ws";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "../lib/prisma";
import { seedSlice2Handoffs } from "./slice-2-handoffs";
import { seedProfileFields } from "./profile-data";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEV_PASSWORD = "backstage-dev";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Seed aborted: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set in .env.local.",
  );
  process.exit(1);
}

// Node 20 has no native WebSocket; @supabase/realtime-js throws without one.
// We don't use realtime in seed, but createClient initializes it eagerly.
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
});

type AccessTier = "admin" | "lead" | "member";

type SeedPerson = {
  email: string;
  fullName: string;
  initials: string;
  tier: AccessTier;
  role: string;
};

const PEOPLE: readonly SeedPerson[] = [
  { email: "iman@skam.test",  fullName: "Iman Hadi",    initials: "IH", tier: "admin",  role: "founder" },
  { email: "tariq@skam.test", fullName: "Tariq Yusuf",  initials: "TY", tier: "lead",   role: "producer" },
  { email: "layla@skam.test", fullName: "Layla Saeed",  initials: "LS", tier: "member", role: "design" },
  { email: "omar@skam.test",  fullName: "Omar Khalil",  initials: "OK", tier: "member", role: "audio" },
  { email: "nadia@skam.test", fullName: "Nadia Farouk", initials: "NF", tier: "member", role: "casting" },
  { email: "karim@skam.test", fullName: "Karim Saleh",  initials: "KS", tier: "member", role: "writing" },
];

function daysFromToday(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

async function main(): Promise<void> {
  const existing = await prisma.company.findUnique({ where: { slug: "skam" } });
  if (existing) {
    console.error(
      'Seed aborted: company "skam" already exists. Run `pnpm prisma migrate reset` to start over.',
    );
    process.exit(1);
  }

  console.log("Creating company SKAM...");
  const company = await prisma.company.create({
    data: { name: "SKAM", slug: "skam" },
  });

  console.log("Creating 6 auth users + matching crew_member rows...");
  const idByEmail = new Map<string, string>();
  for (const p of PEOPLE) {
    // INVARIANT: crew_member.id MUST equal the auth.users.id we just got
    // back. This is the only place in the codebase that bridges Supabase
    // Auth and Prisma — see schema.prisma's CrewMember model + decisions
    // 0002 / 0016. Any future signup flow must follow the same pattern:
    //   1. supabase.auth.admin.createUser (or signUp)
    //   2. prisma.crewMember.create with `id: <returned auth user id>`
    // The previous DB-level FK that enforced this is gone (slice 2); we
    // rely on this invariant being honored by every writer.
    const { data, error } = await supabase.auth.admin.createUser({
      email: p.email,
      password: DEV_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: p.fullName },
    });
    if (error || !data.user) {
      throw new Error(
        `Failed to create auth user for ${p.email}: ${error?.message ?? "unknown error"}`,
      );
    }
    await prisma.crewMember.create({
      data: {
        id: data.user.id, // ← auth user id, NOT a generated UUID
        companyId: company.id,
        email: p.email,
        fullName: p.fullName,
        avatarInitials: p.initials,
        accessTier: p.tier,
      },
    });
    idByEmail.set(p.email, data.user.id);
  }

  console.log("Creating 2 projects (Operations + Pilot Episode)...");
  const ops = await prisma.project.create({
    data: { companyId: company.id, name: "Operations", kind: "operations" },
  });
  const pilot = await prisma.project.create({
    data: { companyId: company.id, name: "Pilot Episode", kind: "standard" },
  });

  const id = (email: string): string => {
    const v = idByEmail.get(email);
    if (!v) throw new Error(`No seeded user for ${email}`);
    return v;
  };

  type SeedTask = {
    projectId: string;
    title: string;
    status: "backlog" | "unscoped" | "todo" | "in_progress" | "in_review" | "done" | "canceled";
    assigneeId: string | null;
    dueDate: Date | null;
    createdBy: string;
  };

  const tasks: SeedTask[] = [
    // Pilot Episode
    { projectId: pilot.id, title: "Write episode 1 outline",       status: "done",        assigneeId: id("karim@skam.test"), dueDate: daysFromToday(-5),  createdBy: id("tariq@skam.test") },
    { projectId: pilot.id, title: "Cast lead role",                status: "in_review",   assigneeId: id("nadia@skam.test"), dueDate: daysFromToday(3),   createdBy: id("tariq@skam.test") },
    { projectId: pilot.id, title: "Design opening titles",         status: "in_progress", assigneeId: id("layla@skam.test"), dueDate: daysFromToday(7),   createdBy: id("tariq@skam.test") },
    { projectId: pilot.id, title: "Record location ambience",      status: "todo",        assigneeId: id("omar@skam.test"),  dueDate: daysFromToday(14),  createdBy: id("tariq@skam.test") },
    { projectId: pilot.id, title: "Storyboard cold open",          status: "in_progress", assigneeId: id("layla@skam.test"), dueDate: daysFromToday(-2),  createdBy: id("tariq@skam.test") }, // overdue
    { projectId: pilot.id, title: "Hire DP",                       status: "in_progress", assigneeId: id("tariq@skam.test"), dueDate: daysFromToday(10),  createdBy: id("iman@skam.test") },
    { projectId: pilot.id, title: "Lock script for ep 1",          status: "in_review",   assigneeId: id("karim@skam.test"), dueDate: daysFromToday(1),   createdBy: id("tariq@skam.test") },
    { projectId: pilot.id, title: "Scout primary location",        status: "backlog",     assigneeId: null,                  dueDate: null,               createdBy: id("tariq@skam.test") },
    // Operations
    { projectId: ops.id,   title: "Set up shared Drive structure", status: "done",        assigneeId: id("iman@skam.test"),  dueDate: daysFromToday(-7),  createdBy: id("iman@skam.test") },
    { projectId: ops.id,   title: "Onboard new intern",            status: "todo",        assigneeId: id("tariq@skam.test"), dueDate: daysFromToday(2),   createdBy: id("iman@skam.test") },
    { projectId: ops.id,   title: "Renew studio insurance",        status: "todo",        assigneeId: id("iman@skam.test"),  dueDate: daysFromToday(30),  createdBy: id("iman@skam.test") },
    { projectId: ops.id,   title: "Pay invoices for camera rental",status: "in_progress", assigneeId: id("iman@skam.test"),  dueDate: daysFromToday(-1),  createdBy: id("iman@skam.test") }, // overdue
    { projectId: ops.id,   title: "Update equipment inventory",    status: "backlog",     assigneeId: null,                  dueDate: null,               createdBy: id("iman@skam.test") },
    { projectId: ops.id,   title: "Plan Q3 team offsite",          status: "unscoped",    assigneeId: null,                  dueDate: null,               createdBy: id("iman@skam.test") },
    { projectId: ops.id,   title: "Cancel old SaaS subscriptions", status: "canceled",    assigneeId: id("tariq@skam.test"), dueDate: null,               createdBy: id("iman@skam.test") },
  ];

  console.log(`Creating ${tasks.length} tasks...`);
  for (const t of tasks) {
    await prisma.task.create({
      data: {
        companyId: company.id,
        projectId: t.projectId,
        title: t.title,
        status: t.status,
        assigneeId: t.assigneeId,
        dueDate: t.dueDate,
        createdBy: t.createdBy,
      },
    });
  }

  console.log("Creating slice-2 handoff samples...");
  const handoffs = await seedSlice2Handoffs(prisma, company.id);

  console.log("Filling profile fields (bio, socials, languages)...");
  const profiles = await seedProfileFields(prisma, company.id);

  console.log("");
  console.log(
    `Seeded SKAM — 6 people, 2 projects, ${tasks.length} tasks, ${handoffs.inserted} handoffs, ${profiles.updated} profile patches.`,
  );
  console.log("");
  console.log(`Login password (all users): ${DEV_PASSWORD}`);
  console.log("");
  console.log("  tier    email                  name");
  console.log("  ─────── ─────────────────────  ───────────────────────────");
  for (const p of PEOPLE) {
    console.log(
      `  ${p.tier.padEnd(7)} ${p.email.padEnd(22)} ${p.fullName} (${p.role})`,
    );
  }
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
