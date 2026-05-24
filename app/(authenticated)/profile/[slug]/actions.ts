"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentCrewMember } from "@/lib/dal";

// Profile edit server action. Self OR admin. See decision 0018.
// The form lives inline on the profile bento — there's no separate
// edit page.

export type UpdateProfileState = { error: string } | undefined;

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .nullable()
  .refine(
    (v) => v == null || v === "" || /^https?:\/\//i.test(v),
    "Must be an http(s):// URL or empty.",
  );

const UpdateProfileSchema = z.object({
  memberId: z.uuid(),
  avatarUrl: optionalUrl,
  bio: z.string().trim().max(2000).optional().nullable(),
  socialInstagram: optionalUrl,
  socialLinkedin: optionalUrl,
  socialWhatsapp: optionalUrl,
  languagesRaw: z.string().max(500).optional().nullable(),
});

function parseLanguages(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function nullableTrim(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export async function updateProfile(
  _prev: UpdateProfileState,
  formData: FormData,
): Promise<UpdateProfileState> {
  const me = await getCurrentCrewMember();
  if (!me) return { error: "Not signed in." };

  const parsed = UpdateProfileSchema.safeParse({
    memberId: formData.get("memberId"),
    avatarUrl: formData.get("avatarUrl") ?? null,
    bio: formData.get("bio") ?? null,
    socialInstagram: formData.get("socialInstagram") ?? null,
    socialLinkedin: formData.get("socialLinkedin") ?? null,
    socialWhatsapp: formData.get("socialWhatsapp") ?? null,
    languagesRaw: formData.get("languagesRaw") ?? null,
  });
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message;
    return { error: firstIssue ?? "Couldn't save — check the inputs." };
  }

  const target = await prisma.crewMember.findFirst({
    where: { id: parsed.data.memberId, companyId: me.companyId },
    select: { id: true, slug: true },
  });
  if (!target) {
    return { error: "Profile not found in your company." };
  }

  const isSelf = target.id === me.id;
  const isAdmin = me.accessTier === "admin";
  if (!isSelf && !isAdmin) {
    redirect(target.slug ? `/profile/${target.slug}` : `/cockpit`);
  }

  await prisma.crewMember.update({
    where: { id: target.id },
    data: {
      avatarUrl: nullableTrim(parsed.data.avatarUrl),
      bio: nullableTrim(parsed.data.bio),
      socialInstagram: nullableTrim(parsed.data.socialInstagram),
      socialLinkedin: nullableTrim(parsed.data.socialLinkedin),
      socialWhatsapp: nullableTrim(parsed.data.socialWhatsapp),
      languages: parseLanguages(parsed.data.languagesRaw),
    },
  });

  if (target.slug) {
    revalidatePath(`/profile/${target.slug}`);
  }
  return undefined;
}
