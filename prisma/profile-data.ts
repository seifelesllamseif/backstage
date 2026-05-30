import type { PrismaClient } from "@prisma/client";

type ProfileSample = {
  email: string;
  avatarUrl?: string | null;
  bio: string;
  socialInstagram?: string | null;
  socialLinkedin?: string | null;
  socialWhatsapp?: string | null;
  languages: string[];
};

export const PROFILE_SAMPLES: readonly ProfileSample[] = [
  {
    email: "iona.douglas@verbivore.app",
    bio: "Founder of Verbivore. Builds the team and the product, in that order. Less interested in being right than in shipping what gets used.",
    socialInstagram: null,
    socialLinkedin: null,
    socialWhatsapp: null,
    languages: ["English"],
  },
  {
    email: "seifelesllam.seif@verbivore.app",
    bio: "Full-stack at Verbivore. Backend to UI, takes things end to end. Believes the boring path is usually the fastest.",
    socialInstagram: null,
    socialLinkedin: null,
    socialWhatsapp: null,
    languages: ["English"],
  },
  {
    email: "maryam.baig@verbivore.app",
    bio: "Full-stack at Verbivore. Reads RFCs for fun, ships small PRs. Cares about the test that catches the regression before it ships.",
    socialInstagram: null,
    socialLinkedin: null,
    socialWhatsapp: null,
    languages: ["English"],
  },
  {
    email: "asim.selim@verbivore.app",
    bio: "UI/UX at Verbivore. Flows, components, the friction nobody asked about until it was gone. First sketch fast, ninth iteration slow.",
    socialInstagram: null,
    socialLinkedin: null,
    socialWhatsapp: null,
    languages: ["English"],
  },
  {
    email: "oheneba.bosompem@verbivore.app",
    bio: "Frontend at Verbivore. React, accessibility, the polish that ships. Thinks rough is faster than wrong and shares early.",
    socialInstagram: null,
    socialLinkedin: null,
    socialWhatsapp: null,
    languages: ["English"],
  },
  {
    email: "corentin.boissie@verbivore.app",
    bio: "Cybersecurity at Verbivore. Threat models, audits, the controls nobody notices until they save you. Reads incident postmortems on weekends.",
    socialInstagram: null,
    socialLinkedin: null,
    socialWhatsapp: null,
    languages: ["English"],
  },
  {
    email: "radmila.tantaeva@verbivore.app",
    bio: "Transcription at Verbivore. Captures the spoken word with the precision the written one needs. Faster than you would expect, accurate where it counts.",
    socialInstagram: null,
    socialLinkedin: null,
    socialWhatsapp: null,
    languages: ["English"],
  },
];

export async function seedProfileFields(
  prisma: PrismaClient,
  companyId: string,
): Promise<{ updated: number; skipped: number; missing: number }> {
  let updated = 0;
  let skipped = 0;
  let missing = 0;

  for (const profile of PROFILE_SAMPLES) {
    const member = await prisma.teamMember.findFirst({
      where: { companyId, email: profile.email },
      select: { id: true, bio: true, languages: true },
    });
    if (!member) {
      missing += 1;
      continue;
    }
    // Skip if already populated (bio present OR languages non-empty)
    if (
      (member.bio && member.bio.trim().length > 0) ||
      member.languages.length > 0
    ) {
      skipped += 1;
      continue;
    }
    await prisma.teamMember.update({
      where: { id: member.id },
      data: {
        bio: profile.bio,
        socialInstagram: profile.socialInstagram ?? null,
        socialLinkedin: profile.socialLinkedin ?? null,
        socialWhatsapp: profile.socialWhatsapp ?? null,
        languages: profile.languages,
        avatarUrl: profile.avatarUrl ?? null,
      },
    });
    updated += 1;
  }

  return { updated, skipped, missing };
}
