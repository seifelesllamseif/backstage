"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, Plus, Trash2, Upload } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  skipOnboardingFinish,
  skipPasswordStep,
  updateAbout,
  updateIdentity,
  updatePassword,
  updateSocials,
  uploadAvatar,
} from "../actions";

type WorkLink = { label: string; url: string };
type Skill = { label: string; level: number };

export type OnboardingInitial = {
  userId: string;
  startStep: number;
  fullName: string;
  contactEmail: string;
  bio: string;
  // Existing avatar URL when the member re-enters onboarding partway
  // through (or replays the flow). Pre-populates the avatar step's
  // preview so they don't have to re-upload to advance.
  avatarUrl: string | null;
  socialLinkedin: string;
  socialInstagram: string;
  socialWhatsapp: string;
  roleFocus: string;
  timezone: string;
  workStyle: string;
  languages: string[];
  headline: string;
  workLinks: WorkLink[];
  skills: Skill[];
};

const STEP_TITLES = [
  "Set a new password",
  "Verify your details",
  "Add a profile photo",
  "Social links",
  "About you",
] as const;

export function OnboardingWizard({ initial }: { initial: OnboardingInitial }) {
  const router = useRouter();
  const [step, setStep] = useState(
    Math.min(Math.max(initial.startStep, 0), STEP_TITLES.length - 1),
  );
  // Direction of the next transition (1 = forward, -1 = back). Drives the
  // slide-in/out variants below.
  const [direction, setDirection] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Step state. Each step owns its inputs so back-and-forth navigation
  // doesn't reset what the user typed.
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [fullName, setFullName] = useState(initial.fullName);
  const [contactEmail, setContactEmail] = useState(initial.contactEmail);
  const [bio, setBio] = useState(initial.bio);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  // Preload the existing avatar (if any) so the preview shows it and the
  // member can advance without re-uploading. A fresh selection overrides
  // the URL with the local object URL.
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    initial.avatarUrl,
  );
  const [uploading, setUploading] = useState(false);

  const [socialLinkedin, setSocialLinkedin] = useState(initial.socialLinkedin);
  const [socialInstagram, setSocialInstagram] = useState(initial.socialInstagram);
  const [socialWhatsapp, setSocialWhatsapp] = useState(initial.socialWhatsapp);

  const [roleFocus, setRoleFocus] = useState(initial.roleFocus);
  const [timezone, setTimezone] = useState(
    initial.timezone || guessTimezone(),
  );
  const [workStyle, setWorkStyle] = useState(initial.workStyle);
  const [languages, setLanguages] = useState<string[]>(
    initial.languages.length ? initial.languages : ["English"],
  );
  const [headline, setHeadline] = useState(initial.headline);
  const [workLinks, setWorkLinks] = useState<WorkLink[]>(initial.workLinks);
  const [skills, setSkills] = useState<Skill[]>(initial.skills);

  function advance() {
    setError(null);
    setDirection(1);
    setStep((s) => s + 1);
  }

  function back() {
    setError(null);
    setDirection(-1);
    setStep((s) => Math.max(0, s - 1));
  }

  function finish() {
    router.replace("/dashboard");
    router.refresh();
  }

  // ── Step actions ────────────────────────────────────────────────────────
  function submitPassword() {
    const fd = new FormData();
    fd.set("password", password);
    fd.set("confirm", confirm);
    startTransition(async () => {
      const r = await updatePassword(fd);
      if (!r.ok) setError(r.error);
      else advance();
    });
  }

  function keepCurrentPassword() {
    startTransition(async () => {
      const r = await skipPasswordStep();
      if (!r.ok) setError(r.error);
      else advance();
    });
  }

  // Returning user heuristic: any populated profile state means they
  // were already in the app before. Surfaces a "Keep current password"
  // skip on step 0 instead of forcing them to set a new one.
  const isReturningUser =
    initial.avatarUrl !== null ||
    initial.fullName.trim().length > 0 ||
    initial.bio.trim().length > 0 ||
    initial.contactEmail.trim().length > 0;

  function submitIdentity() {
    const fd = new FormData();
    fd.set("fullName", fullName);
    fd.set("contactEmail", contactEmail);
    fd.set("bio", bio);
    startTransition(async () => {
      const r = await updateIdentity(fd);
      if (!r.ok) setError(r.error);
      else advance();
    });
  }

  async function submitAvatar() {
    // No new file picked: the existing avatar (preloaded from
    // initial.avatarUrl) is good enough to advance. Skip the upload
    // round-trip entirely.
    if (!avatarFile) {
      if (initial.avatarUrl) {
        advance();
        return;
      }
      setError("Pick an image first.");
      return;
    }
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.set("file", avatarFile);
    const r = await uploadAvatar(fd);
    setUploading(false);
    if (!r.ok) setError(r.error);
    else advance();
  }

  function submitSocials() {
    const fd = new FormData();
    fd.set("socialLinkedin", socialLinkedin);
    fd.set("socialInstagram", socialInstagram);
    fd.set("socialWhatsapp", socialWhatsapp);
    startTransition(async () => {
      const r = await updateSocials(fd);
      if (!r.ok) setError(r.error);
      else advance();
    });
  }

  function submitAbout(skip: boolean) {
    startTransition(async () => {
      const r = skip
        ? await skipOnboardingFinish()
        : await updateAbout({
            roleFocus,
            timezone,
            workStyle,
            languages: languages.map((s) => s.trim()).filter(Boolean),
            headline,
            workLinks: workLinks.filter((l) => l.label.trim() && l.url.trim()),
            skills: skills.filter((s) => s.label.trim()),
          });
      if (!r.ok) setError(r.error);
      else finish();
    });
  }

  return (
    <motion.div
      className="bg-card ring-foreground/10 relative w-full rounded-lg p-8 ring-1 md:p-10"
      initial={{ opacity: 0, y: 10, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 140, damping: 16 }}
    >
      <Stepper current={step} total={STEP_TITLES.length} />

      {error && (
        <motion.p
          key={`err-${error}`}
          initial={{ opacity: 0, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="text-destructive text-xs mt-4"
          role="alert"
        >
          {error}
        </motion.p>
      )}

      <div className="relative mt-4 overflow-hidden">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={step}
            custom={direction}
            variants={STEP_VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 360, damping: 32, mass: 0.7 }}
          >
            <h1 className="text-lg font-medium">{STEP_TITLES[step]}</h1>
            <p className="text-muted-foreground text-xs mt-1">
              {step === 0 && "Replace the shared starter password with one you'll remember."}
              {step === 1 && "Make sure these match what the team should see."}
              {step === 2 && "JPG, PNG, or WEBP up to 5 MB."}
              {step === 3 && "All optional. Leave anything blank you'd rather not share."}
              {step === 4 && "Skip if you'd rather come back later — your profile will still work."}
            </p>
            <div className="mt-5">
        {step === 0 && (
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="password">New password</FieldLabel>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                  className="pr-7"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-1 flex items-center"
                  tabIndex={-1}
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="confirm">Confirm password</FieldLabel>
              <Input
                id="confirm"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.currentTarget.value)}
              />
            </Field>
            <div className="flex items-center justify-between gap-2">
              {isReturningUser ? (
                <button
                  type="button"
                  onClick={keepCurrentPassword}
                  disabled={pending}
                  className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline disabled:opacity-50"
                >
                  Keep current password
                </button>
              ) : (
                <span />
              )}
              <Button onClick={submitPassword} disabled={pending}>
                {pending ? "Saving…" : "Continue"}
              </Button>
            </div>
          </FieldGroup>
        )}

        {step === 1 && (
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="fullName">Full name</FieldLabel>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.currentTarget.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="contactEmail">Contact email</FieldLabel>
              <Input
                id="contactEmail"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.currentTarget.value)}
                placeholder="you@example.com"
              />
              <p className="text-muted-foreground text-[10px]">
                Where you&apos;d like notifications. Different from your @verbivore.app sign-in.
              </p>
            </Field>
            <Field>
              <FieldLabel htmlFor="bio">Short bio</FieldLabel>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.currentTarget.value)}
                rows={3}
                maxLength={500}
                className="border-input bg-input/20 dark:bg-input/30 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/30 w-full rounded-md border px-2 py-1 text-xs/relaxed outline-none focus-visible:ring-2"
              />
            </Field>
            <Footer onBack={back} onNext={submitIdentity} nextLabel="Continue" pending={pending} />
          </FieldGroup>
        )}

        {step === 2 && (
          <FieldGroup className="gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-input/40 ring-foreground/10 flex size-20 items-center justify-center overflow-hidden rounded-full ring-1">
                {avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarPreview} alt="" className="size-full object-cover" />
                ) : (
                  <span className="text-muted-foreground text-xs">No photo</span>
                )}
              </div>
              <div className="flex-1">
                <label className="border-input bg-input/20 hover:bg-input/40 flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-xs">
                  <Upload className="size-3.5" />
                  {avatarFile
                    ? avatarFile.name
                    : initial.avatarUrl
                      ? "Replace photo"
                      : "Choose an image"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.currentTarget.files?.[0] ?? null;
                      setAvatarFile(f);
                      // New pick wins; if cleared, fall back to the
                      // existing avatar URL instead of going blank.
                      setAvatarPreview(
                        f ? URL.createObjectURL(f) : initial.avatarUrl,
                      );
                    }}
                  />
                </label>
                <p className="text-muted-foreground mt-2 text-[10px]">
                  {initial.avatarUrl
                    ? "We've kept the one you uploaded. Replace it or continue with this."
                    : "Required to finish onboarding. Stored in the avatars bucket."}
                </p>
              </div>
            </div>
            <Footer
              onBack={back}
              onNext={submitAvatar}
              nextLabel={
                uploading
                  ? "Uploading…"
                  : avatarFile
                    ? "Upload and continue"
                    : "Continue"
              }
              pending={uploading || pending}
              nextDisabled={!avatarFile && !initial.avatarUrl}
            />
          </FieldGroup>
        )}

        {step === 3 && (
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="li">LinkedIn URL</FieldLabel>
              <Input
                id="li"
                value={socialLinkedin}
                onChange={(e) => setSocialLinkedin(e.currentTarget.value)}
                placeholder="https://linkedin.com/in/..."
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="ig">Instagram URL</FieldLabel>
              <Input
                id="ig"
                value={socialInstagram}
                onChange={(e) => setSocialInstagram(e.currentTarget.value)}
                placeholder="https://instagram.com/..."
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="wa">WhatsApp link</FieldLabel>
              <Input
                id="wa"
                value={socialWhatsapp}
                onChange={(e) => setSocialWhatsapp(e.currentTarget.value)}
                placeholder="https://wa.me/..."
              />
            </Field>
            <Footer onBack={back} onNext={submitSocials} nextLabel="Continue" pending={pending} />
          </FieldGroup>
        )}

        {step === 4 && (
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="roleFocus">Role / focus</FieldLabel>
              <Input
                id="roleFocus"
                value={roleFocus}
                onChange={(e) => setRoleFocus(e.currentTarget.value)}
                placeholder="Frontend, Transcription, Cybersecurity…"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="timezone">Time zone</FieldLabel>
              <Input
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.currentTarget.value)}
                placeholder="Europe/Paris"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="workStyle">How you work best</FieldLabel>
              <textarea
                id="workStyle"
                rows={2}
                value={workStyle}
                onChange={(e) => setWorkStyle(e.currentTarget.value)}
                placeholder="async over meetings, pair when stuck…"
                className="border-input bg-input/20 dark:bg-input/30 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/30 w-full rounded-md border px-2 py-1 text-xs/relaxed outline-none focus-visible:ring-2"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="langs">Languages</FieldLabel>
              <Input
                id="langs"
                value={languages.join(", ")}
                onChange={(e) =>
                  setLanguages(
                    e.currentTarget.value.split(",").map((s) => s.trim()).filter(Boolean),
                  )
                }
                placeholder="English, French, Arabic"
              />
              <p className="text-muted-foreground text-[10px]">Comma-separated.</p>
            </Field>
            <Field>
              <FieldLabel htmlFor="headline">Headline</FieldLabel>
              <Input
                id="headline"
                value={headline}
                onChange={(e) => setHeadline(e.currentTarget.value)}
                placeholder="One sentence that leads your profile."
                maxLength={140}
              />
            </Field>
            <Field>
              <FieldLabel>Work links</FieldLabel>
              <WorkLinksEditor value={workLinks} onChange={setWorkLinks} />
            </Field>
            <Field>
              <FieldLabel>Skills</FieldLabel>
              <p className="text-muted-foreground text-[10px]">
                Rate yourself Beginner to Expert. Free-form — add whatever applies.
              </p>
              <SkillsEditor value={skills} onChange={setSkills} />
            </Field>
            <div className="mt-2 flex items-center justify-between gap-2">
              <Button variant="ghost" onClick={back} disabled={pending}>
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => submitAbout(true)} disabled={pending}>
                  Skip and finish
                </Button>
                <Button onClick={() => submitAbout(false)} disabled={pending}>
                  {pending ? "Saving…" : "Save and finish"}
                </Button>
              </div>
            </div>
          </FieldGroup>
        )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// Direction-aware slide + fade between wizard steps. `mode="wait"` on the
// parent AnimatePresence keeps height calculations stable; the outer card
// resizes smoothly thanks to overflow-hidden + the spring easing.
const STEP_VARIANTS = {
  enter: (dir: number) => ({ x: dir * 28, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -28, opacity: 0 }),
};

function Footer({
  onBack,
  onNext,
  nextLabel,
  pending,
  nextDisabled,
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel: string;
  pending: boolean;
  nextDisabled?: boolean;
}) {
  return (
    <div className="mt-2 flex items-center justify-between gap-2">
      <Button variant="ghost" onClick={onBack} disabled={pending}>
        Back
      </Button>
      <Button onClick={onNext} disabled={pending || nextDisabled}>
        {nextLabel}
      </Button>
    </div>
  );
}

function Stepper({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-1 flex-1 rounded-full transition-colors",
            i <= current ? "bg-primary" : "bg-input/60",
          )}
        />
      ))}
    </div>
  );
}

function WorkLinksEditor({
  value,
  onChange,
}: {
  value: WorkLink[];
  onChange: (next: WorkLink[]) => void;
}) {
  function update(idx: number, patch: Partial<WorkLink>) {
    onChange(value.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }
  function add() {
    if (value.length >= 10) return;
    onChange([...value, { label: "", url: "" }]);
  }
  return (
    <div className="flex flex-col gap-2">
      {value.map((link, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Input
            value={link.label}
            onChange={(e) => update(i, { label: e.currentTarget.value })}
            placeholder="GitHub"
            className="w-28"
          />
          <Input
            value={link.url}
            onChange={(e) => update(i, { url: e.currentTarget.value })}
            placeholder="https://..."
          />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => remove(i)}
            aria-label="Remove link"
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} disabled={value.length >= 10}>
        <Plus className="size-3" /> Add link
      </Button>
    </div>
  );
}

const LEVEL_LABELS = ["Beginner", "Novice", "Intermediate", "Advanced", "Expert"] as const;

function SkillsEditor({
  value,
  onChange,
}: {
  value: Skill[];
  onChange: (next: Skill[]) => void;
}) {
  function update(idx: number, patch: Partial<Skill>) {
    onChange(value.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }
  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }
  function add() {
    if (value.length >= 30) return;
    onChange([...value, { label: "", level: 3 }]);
  }

  return (
    <div className="flex flex-col gap-3">
      {value.map((skill, i) => (
        <div key={i} className="flex flex-col gap-1.5 rounded-md border border-input bg-input/10 p-2.5">
          <div className="flex items-center gap-1.5">
            <Input
              value={skill.label}
              onChange={(e) => update(i, { label: e.currentTarget.value })}
              placeholder="React, Figma, Arabic transcription…"
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => remove(i)}
              aria-label="Remove skill"
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
          <RatingScale
            name={`skill-${i}`}
            value={skill.level}
            onChange={(level) => update(i, { level })}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={add}
        disabled={value.length >= 30}
      >
        <Plus className="size-3" /> Add skill
      </Button>
    </div>
  );
}

function RatingScale({
  name,
  value,
  onChange,
}: {
  name: string;
  value: number;
  onChange: (level: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground w-16 text-[10px]">Beginner</span>
      <div className="flex flex-1 items-center justify-between gap-1">
        {LEVEL_LABELS.map((label, idx) => {
          const level = idx + 1;
          const active = value === level;
          return (
            <label
              key={level}
              className="group flex flex-1 cursor-pointer flex-col items-center gap-0.5"
              title={label}
            >
              <input
                type="radio"
                name={name}
                value={level}
                checked={active}
                onChange={() => onChange(level)}
                className="sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  "size-4 rounded-full border-2 transition-all",
                  active
                    ? "border-primary bg-primary"
                    : "border-input bg-input/30 group-hover:border-foreground/40",
                )}
              />
              <span
                className={cn(
                  "text-[9px] tabular-nums transition-colors",
                  active ? "text-foreground" : "text-muted-foreground/60",
                )}
              >
                {level}
              </span>
            </label>
          );
        })}
      </div>
      <span className="text-muted-foreground w-12 text-right text-[10px]">Expert</span>
    </div>
  );
}

function guessTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}
