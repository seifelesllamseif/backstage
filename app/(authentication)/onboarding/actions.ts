"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentTeamMember } from "@/lib/dal";
import { createAdminClient } from "@/supabase/admin";
import { createClient } from "@/supabase/server";
import { DEFAULT_REDIRECT_ROUTE } from "@/routes";
import { INVITE_DEFAULT_PASSWORD } from "@/supabase/dashboard/team";

// Decision 0029: onboarding writes go through @supabase/supabase-js with the
// user's session (RLS policies in migration 20260531_avatars_and_onboarding_*
// scope writes to auth.uid()=id). No Prisma here per memory rule
// "Supabase JS only on Backstage".

export type ActionResult = { ok: true } | { ok: false; error: string };

// High-water mark of completed wizard steps. The wizard reads
// team_members.onboarding_step on mount and starts at that step on resume.
// Step 3 (avatar) additionally sets avatar_url, which triggers the
// (workspace) layout to release the gate, so steps >= 4 only run if the
// user is mid-flow in the same session.
async function bumpStep(memberId: string, step: number) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("team_members")
    .select("onboarding_step")
    .eq("id", memberId)
    .maybeSingle();
  const current = data?.onboarding_step ?? 0;
  if (step <= current) return;
  await supabase
    .from("team_members")
    .update({ onboarding_step: step })
    .eq("id", memberId);
}

// ── Step 1: password ──────────────────────────────────────────────────────
// Requires the current password as a verification step before letting the
// session set a new one. Stops a session-hijack scenario from quietly
// rotating credentials without knowing what the member set previously
// (or what admin set as the temp / invite password).
const passwordSchema = z
  .object({
    // Optional on the first-time invite flow: when the member is still on
    // onboarding step 0 the action falls back to verifying against the
    // shared INVITE_DEFAULT_PASSWORD instead of asking them to retype it.
    oldPassword: z.string().min(1).nullable().optional(),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match.",
    path: ["confirm"],
  })
  .refine((d) => !d.oldPassword || d.password !== d.oldPassword, {
    message: "New password must be different from the current one.",
    path: ["password"],
  });

export async function updatePassword(formData: FormData): Promise<ActionResult> {
  const member = await getCurrentTeamMember();
  if (!member) return { ok: false, error: "Not signed in." };
  const parsed = passwordSchema.safeParse({
    oldPassword: formData.get("oldPassword"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  // First-time onboarding has no "old password" input - the user just
  // signed in with INVITE_DEFAULT_PASSWORD, so we verify against that.
  // Subsequent changes (member already past step 0) still require the
  // current password to defend against session hijack.
  const { data: stepRow } = await supabase
    .from("team_members")
    .select("onboarding_step")
    .eq("id", member.id)
    .maybeSingle();
  const isFirstTimeFlow = (stepRow?.onboarding_step ?? 0) === 0;
  const verifyPassword = parsed.data.oldPassword ?? (isFirstTimeFlow ? INVITE_DEFAULT_PASSWORD : null);
  if (!verifyPassword) {
    return { ok: false, error: "Enter your current password." };
  }
  if (parsed.data.password === verifyPassword) {
    return { ok: false, error: "New password must be different from the current one." };
  }
  const { error: verifyErr } = await supabase.auth.signInWithPassword({
    email: member.email,
    password: verifyPassword,
  });
  if (verifyErr) {
    return {
      ok: false,
      error: isFirstTimeFlow
        ? "Couldn't verify the starter password. Try signing out and back in."
        : "Current password is wrong.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: error.message };
  await bumpStep(member.id, 1);
  return { ok: true };
}

// ── Step 2: identity verification ─────────────────────────────────────────
const identitySchema = z.object({
  fullName: z.string().trim().min(1, "Name is required."),
  contactEmail: z
    .string()
    .trim()
    .email("Enter a valid email.")
    .or(z.literal("").transform(() => null)),
  bio: z
    .string()
    .trim()
    .max(500, "Bio must be 500 characters or fewer.")
    .or(z.literal("").transform(() => null)),
});

export async function updateIdentity(formData: FormData): Promise<ActionResult> {
  const member = await getCurrentTeamMember();
  if (!member) return { ok: false, error: "Not signed in." };

  const parsed = identitySchema.safeParse({
    fullName: formData.get("fullName"),
    contactEmail: formData.get("contactEmail"),
    bio: formData.get("bio"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("team_members")
    .update({
      full_name: parsed.data.fullName,
      contact_email: parsed.data.contactEmail,
      bio: parsed.data.bio,
    })
    .eq("id", member.id);
  if (error) return { ok: false, error: error.message };
  await bumpStep(member.id, 2);
  return { ok: true };
}

// ── Step 3: avatar upload (server-side) ───────────────────────────────────
// Storage upload goes through the service-role admin client (bypasses RLS).
// The SSR-cookie session doesn't reliably propagate to the storage HTTP
// request, so user-scoped uploads hit "new row violates row-level security
// policy" even though the same client can write to team_members fine.
// Safety: we constrain the path to `${member.id}/...` after verifying the
// member via getCurrentTeamMember(), so a user still can't reach anyone
// else's folder.
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export async function uploadAvatar(formData: FormData): Promise<ActionResult> {
  const member = await getCurrentTeamMember();
  if (!member) return { ok: false, error: "Not signed in." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Pick an image first." };
  }
  if (!ALLOWED_AVATAR_TYPES.includes(file.type as (typeof ALLOWED_AVATAR_TYPES)[number])) {
    return { ok: false, error: "Image must be JPG, PNG, or WEBP." };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { ok: false, error: "Image must be 5 MB or smaller." };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${member.id}/avatar.${ext}`;

  const admin = createAdminClient();
  const { error: upErr } = await admin.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (upErr) return { ok: false, error: upErr.message };

  const { data } = admin.storage.from("avatars").getPublicUrl(path);
  const avatarUrl = `${data.publicUrl}?t=${Date.now()}`;

  const supabase = await createClient();
  const { error: dbErr } = await supabase
    .from("team_members")
    .update({ avatar_url: avatarUrl })
    .eq("id", member.id);
  if (dbErr) return { ok: false, error: dbErr.message };

  await bumpStep(member.id, 3);
  revalidatePath("/dashboard");
  return { ok: true };
}

// ── Step 4: social links (each field optional) ────────────────────────────
// Tightened from "any URL" to platform-specific matches so a typo or a
// link to the wrong service is caught at submit time. Empty stays valid.
const linkedinSchema = z
  .string()
  .trim()
  .regex(
    /^https:\/\/(www\.)?linkedin\.com\/(in|company)\/[A-Za-z0-9\-_%]+\/?$/i,
    "Use a real LinkedIn profile or company URL (https://linkedin.com/in/…).",
  )
  .or(z.literal("").transform(() => null));

const instagramSchema = z
  .string()
  .trim()
  .regex(
    /^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._]+\/?$/i,
    "Use a real Instagram profile URL (https://instagram.com/…).",
  )
  .or(z.literal("").transform(() => null));

// Generated client-side from a phone-number input; we still revalidate
// the resulting wa.me URL on the server.
const whatsappSchema = z
  .string()
  .trim()
  .regex(
    /^https:\/\/wa\.me\/\d{6,20}$/,
    "WhatsApp number must include the country code (digits only).",
  )
  .or(z.literal("").transform(() => null));

const socialsSchema = z.object({
  socialLinkedin: linkedinSchema,
  socialInstagram: instagramSchema,
  socialWhatsapp: whatsappSchema,
});

export async function updateSocials(formData: FormData): Promise<ActionResult> {
  const member = await getCurrentTeamMember();
  if (!member) return { ok: false, error: "Not signed in." };

  const parsed = socialsSchema.safeParse({
    socialLinkedin: formData.get("socialLinkedin"),
    socialInstagram: formData.get("socialInstagram"),
    socialWhatsapp: formData.get("socialWhatsapp"),
  });
  if (!parsed.success) {
    return { ok: false, error: "One of the social URLs is invalid." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("team_members")
    .update({
      social_linkedin: parsed.data.socialLinkedin,
      social_instagram: parsed.data.socialInstagram,
      social_whatsapp: parsed.data.socialWhatsapp,
    })
    .eq("id", member.id);
  if (error) return { ok: false, error: error.message };
  await bumpStep(member.id, 4);
  return { ok: true };
}

// Steps 5 / 6: about you - split into "basics" and "work". Step 5 saves
// the 'who I am' fields; step 6 saves the editor-heavy work links + skills.
// Both optional.
const workLinkSchema = z.object({
  label: z.string().trim().min(1).max(40),
  url: z.string().trim().url(),
});

const skillSchema = z.object({
  label: z.string().trim().min(1).max(40),
  level: z.number().int().min(1).max(5),
});

const aboutBasicsSchema = z.object({
  roleFocus: z.string().trim().max(80).or(z.literal("").transform(() => null)),
  timezone: z.string().trim().max(60).or(z.literal("").transform(() => null)),
  workStyle: z.string().trim().max(280).or(z.literal("").transform(() => null)),
  languages: z.array(z.string().trim().min(1)).max(20),
  headline: z.string().trim().max(140).or(z.literal("").transform(() => null)),
});

const aboutWorkSchema = z.object({
  workLinks: z.array(workLinkSchema).max(10),
  skills: z.array(skillSchema).max(30),
});

export async function updateAboutBasics(payload: {
  roleFocus: string;
  timezone: string;
  workStyle: string;
  languages: string[];
  headline: string;
}): Promise<ActionResult> {
  const member = await getCurrentTeamMember();
  if (!member) return { ok: false, error: "Not signed in." };

  const parsed = aboutBasicsSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("team_members")
    .update({
      role_focus: parsed.data.roleFocus,
      timezone: parsed.data.timezone,
      work_style: parsed.data.workStyle,
      languages: parsed.data.languages,
      headline: parsed.data.headline,
    })
    .eq("id", member.id);
  if (error) return { ok: false, error: error.message };
  await bumpStep(member.id, 5);
  return { ok: true };
}

export async function updateAboutWork(payload: {
  workLinks: { label: string; url: string }[];
  skills: { label: string; level: number }[];
}): Promise<ActionResult> {
  const member = await getCurrentTeamMember();
  if (!member) return { ok: false, error: "Not signed in." };

  const parsed = aboutWorkSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("team_members")
    .update({
      work_links: parsed.data.workLinks.length ? parsed.data.workLinks : null,
      skills: parsed.data.skills.length ? parsed.data.skills : null,
    })
    .eq("id", member.id);
  if (error) return { ok: false, error: error.message };
  await bumpStep(member.id, 6);
  // Server-side redirect so Next ends the React transition cleanly; if we
  // returned { ok: true } and let the wizard call router.replace, the
  // transition could stay pending through the dashboard render and leave
  // the "Saving…" label visible past the actual save.
  redirect(DEFAULT_REDIRECT_ROUTE);
}

// Skipping the final optional step still counts as "wizard done" — bump
// onboarding_step past the last index so the layout stops sending them
// back to /onboarding.
export async function skipOnboardingFinish(): Promise<ActionResult> {
  const member = await getCurrentTeamMember();
  if (!member) return { ok: false, error: "Not signed in." };
  await bumpStep(member.id, 6);
  redirect(DEFAULT_REDIRECT_ROUTE);
}

// Returning user wants to keep their existing password (admin reset
// onboarding_step but their auth.users row still has the hash). Just
// bumps the step pointer; no auth changes.
export async function skipPasswordStep(): Promise<ActionResult> {
  const member = await getCurrentTeamMember();
  if (!member) return { ok: false, error: "Not signed in." };
  await bumpStep(member.id, 1);
  return { ok: true };
}

// Generic "this step is already filled, keep what I have" advance.
// Just bumps onboarding_step to `step` (capped at WIZARD_STEPS). Used by
// the Identity / Avatar / Socials / About steps when the member is
// re-running the wizard and doesn't want to re-enter data they already
// have.
export async function skipToStep(step: number): Promise<ActionResult> {
  const member = await getCurrentTeamMember();
  if (!member) return { ok: false, error: "Not signed in." };
  if (!Number.isInteger(step) || step < 0 || step > 6) {
    return { ok: false, error: "Invalid step." };
  }
  await bumpStep(member.id, step);
  return { ok: true };
}

// Set avatar_url directly to an external URL the member pasted, no
// upload. Useful when the photo lives on a CDN they already trust.
// Constraints: https only, hostname required, length cap to keep DB
// column sane. Storage is NOT involved here, so members can later
// replace the URL with an upload via uploadAvatar() the normal way.
const avatarUrlSchema = z
  .string()
  .trim()
  .url("That doesn't look like a URL.")
  .max(2048, "URL is too long.");

export async function setAvatarUrl(rawUrl: string): Promise<ActionResult> {
  const member = await getCurrentTeamMember();
  if (!member) return { ok: false, error: "Not signed in." };
  const parsed = avatarUrlSchema.safeParse(rawUrl);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid URL." };
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(parsed.data);
  } catch {
    return { ok: false, error: "Invalid URL." };
  }
  if (parsedUrl.protocol !== "https:") {
    return { ok: false, error: "Use an https URL." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("team_members")
    .update({ avatar_url: parsed.data })
    .eq("id", member.id);
  if (error) return { ok: false, error: error.message };

  await bumpStep(member.id, 3);
  revalidatePath("/dashboard");
  return { ok: true };
}
