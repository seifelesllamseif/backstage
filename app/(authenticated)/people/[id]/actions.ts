"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentCrewMember } from "@/lib/dal";

// Profile edit server actions. Authz: self OR admin tier can edit any
// member's profile. See decision 0018 (Edit access — deferred this pass,
// shipped in the follow-on).

export type UpdateProfileState = { error: string } | undefined;

// URL fields accept empty (cleared) or any non-empty string that starts
// with http(s)://. Looser than strict z.url() so we don't reject pasted
// `wa.me/...` short-links etc — but still rejects obvious garbage.
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
  // Comma-separated input, parsed below.
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

  const targetId = parsed.data.memberId;
  const isSelf = targetId === me.id;
  const isAdmin = me.accessTier === "admin";
  if (!isSelf && !isAdmin) {
    // Don't 403; redirect (server actions look ugly with thrown errors).
    redirect(`/people/${targetId}`);
  }

  // updateMany so a member from another company silently no-ops instead of
  // throwing — same pattern as archiveProject.
  const result = await prisma.crewMember.updateMany({
    where: { id: targetId, companyId: me.companyId },
    data: {
      avatarUrl: nullableTrim(parsed.data.avatarUrl),
      bio: nullableTrim(parsed.data.bio),
      socialInstagram: nullableTrim(parsed.data.socialInstagram),
      socialLinkedin: nullableTrim(parsed.data.socialLinkedin),
      socialWhatsapp: nullableTrim(parsed.data.socialWhatsapp),
      languages: parseLanguages(parsed.data.languagesRaw),
    },
  });
  if (result.count === 0) {
    return { error: "Profile not found in your company." };
  }

  revalidatePath(`/people/${targetId}`);
  redirect(`/people/${targetId}`);
}
