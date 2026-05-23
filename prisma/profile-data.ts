// Profile content for the six seeded SKAM members. Used by both the main
// seed (fresh DB) and prisma/scripts/seed-profile-fields.ts (patch existing).
// See docs/decisions/0018-profile-pages.md.

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
    email: "iman@skam.test",
    bio: "Founder of SKAM. Director and producer, building a studio that takes work seriously and people more so. Less interested in being right than in shipping something the team is proud of.",
    socialInstagram: "https://instagram.com/skam.studio",
    socialLinkedin: "https://linkedin.com/in/iman-hadi",
    socialWhatsapp: "https://wa.me/00000000001",
    languages: ["English", "Arabic", "Turkish"],
  },
  {
    email: "tariq@skam.test",
    bio: "Producer at SKAM. Lives in spreadsheets, prefers a call. Spends his days untangling the gap between what's planned and what's actually possible — likes the days when those are close.",
    socialInstagram: "https://instagram.com/tariqyusuf",
    socialLinkedin: "https://linkedin.com/in/tariq-yusuf",
    socialWhatsapp: "https://wa.me/00000000002",
    languages: ["English", "Arabic"],
  },
  {
    email: "layla@skam.test",
    bio: "Designer at SKAM. Storyboards, titles, set graphics, anything that lives on screen. Thinks rough is faster than wrong and shares early.",
    socialInstagram: "https://instagram.com/laylasaeed",
    socialLinkedin: null,
    socialWhatsapp: "https://wa.me/00000000003",
    languages: ["English", "Arabic", "French"],
  },
  {
    email: "omar@skam.test",
    bio: "Sound at SKAM. Ambience, dialog, the mix that nobody notices because it's right. Spends weekends recording rooms.",
    socialInstagram: "https://instagram.com/omarkhalil",
    socialLinkedin: "https://linkedin.com/in/omar-khalil",
    socialWhatsapp: null,
    languages: ["English", "Arabic"],
  },
  {
    email: "nadia@skam.test",
    bio: "Casting at SKAM. Reads more than she sleeps. Knows half the working actors in two cities and gets back to people the same day.",
    socialInstagram: "https://instagram.com/nadiafarouk",
    socialLinkedin: "https://linkedin.com/in/nadia-farouk",
    socialWhatsapp: "https://wa.me/00000000005",
    languages: ["English", "Arabic", "Turkish"],
  },
  {
    email: "karim@skam.test",
    bio: "Writer at SKAM. First draft fast, ninth draft slow. Believes the cold open is the only contract you sign with the audience.",
    socialInstagram: null,
    socialLinkedin: "https://linkedin.com/in/karim-saleh",
    socialWhatsapp: "https://wa.me/00000000006",
    languages: ["English", "Arabic"],
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
    const member = await prisma.crewMember.findFirst({
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
    await prisma.crewMember.update({
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
