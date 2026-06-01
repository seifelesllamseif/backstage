'use client'

import { useRef, useState, useTransition } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Eye, EyeOff, Upload, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  skipOnboardingFinish,
  skipPasswordStep,
  skipToStep,
  updateAboutBasics,
  updateAboutWork,
  updateIdentity,
  updatePassword,
  updateSocials,
  uploadAvatar
} from '../actions'

type WorkLink = { label: string; url: string }
type Skill = { label: string; level: number }

export type OnboardingInitial = {
  userId: string
  startStep: number
  fullName: string
  contactEmail: string
  bio: string
  // Existing avatar URL when the member re-enters onboarding partway
  // through (or replays the flow). Pre-populates the avatar step's
  // preview so they don't have to re-upload to advance.
  avatarUrl: string | null
  socialLinkedin: string
  socialInstagram: string
  socialWhatsapp: string
  roleFocus: string
  timezone: string
  workStyle: string
  languages: string[]
  headline: string
  workLinks: WorkLink[]
  skills: Skill[]
}

const STEP_TITLES = [
  'Set a new password',
  'Verify your details',
  'Add a profile photo',
  'Social links',
  'About you',
  'Your work'
] as const

// Curated role pills shown on the About step so members can fill the field
// with a click. Static by design (no server call); edit this list to retune.
const ROLE_SUGGESTIONS = [
  'Frontend',
  'Backend',
  'Full-stack',
  'Mobile',
  'Design',
  'QA',
  'DevOps',
  'Data',
  'Product',
  'Content',
  'Marketing',
  'Sales',
  'Customer support',
  'Transcription',
  'Security',
  'Legal & compliance',
  'Finance',
  'People & HR',
  'Operations',
  'Research'
] as const

export function OnboardingWizard({ initial }: { initial: OnboardingInitial }) {
  const [step, setStep] = useState(
    Math.min(Math.max(initial.startStep, 0), STEP_TITLES.length - 1)
  )
  // Direction of the next transition (1 = forward, -1 = back). Drives the
  // slide-in/out variants below.
  const [direction, setDirection] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Step state. Each step owns its inputs so back-and-forth navigation
  // doesn't reset what the user typed.
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)

  const [fullName, setFullName] = useState(initial.fullName)
  const [contactEmail, setContactEmail] = useState(initial.contactEmail)
  const [bio, setBio] = useState(initial.bio)

  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  // Preload the existing avatar (if any) so the preview shows it and the
  // member can advance without re-uploading. A fresh selection overrides
  // the URL with the local object URL.
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    initial.avatarUrl
  )
  const [uploading, setUploading] = useState(false)

  const [socialLinkedin, setSocialLinkedin] = useState(initial.socialLinkedin)
  const [socialInstagram, setSocialInstagram] = useState(
    initial.socialInstagram
  )
  const [socialWhatsapp, setSocialWhatsapp] = useState(initial.socialWhatsapp)

  const [roleFocus, setRoleFocus] = useState(initial.roleFocus)
  const [timezone, setTimezone] = useState(initial.timezone || guessTimezone())
  const [workStyle, setWorkStyle] = useState(initial.workStyle)
  const [languages, setLanguages] = useState<string[]>(
    initial.languages.length ? initial.languages : ['Maltese']
  )
  const [headline, setHeadline] = useState(initial.headline)
  const [workLinks, setWorkLinks] = useState<WorkLink[]>(initial.workLinks)
  const [skills, setSkills] = useState<Skill[]>(initial.skills)

  function advance() {
    setError(null)
    setDirection(1)
    setStep((s) => s + 1)
  }

  function back() {
    setError(null)
    setDirection(-1)
    setStep((s) => Math.max(0, s - 1))
  }

  // Step actions

  function submitPassword() {
    const fd = new FormData()
    fd.set('password', password)
    fd.set('confirm', confirm)
    startTransition(async () => {
      const r = await updatePassword(fd)
      if (!r.ok) setError(r.error)
      else advance()
    })
  }

  function keepCurrentPassword() {
    startTransition(async () => {
      const r = await skipPasswordStep()
      if (!r.ok) setError(r.error)
      else advance()
    })
  }

  // Bumps onboarding_step to (current + 1) without touching the data
  // and advances the wizard. Reused on every step's 'Keep current ...'
  // button when the member already filled that section.
  function keepAndAdvance(nextStep: number) {
    startTransition(async () => {
      const r = await skipToStep(nextStep)
      if (!r.ok) setError(r.error)
      else advance()
    })
  }

  // Returning user heuristic: any populated profile state means they
  // were already in the app before. Surfaces a "Keep current password"
  // skip on step 0 instead of forcing them to set a new one.
  const isReturningUser =
    initial.avatarUrl !== null ||
    initial.fullName.trim().length > 0 ||
    initial.bio.trim().length > 0 ||
    initial.contactEmail.trim().length > 0

  // Per-step 'already filled' flags. When true, we render a 'Keep
  // current ...' skip alongside Continue so the member can re-run the
  // wizard without re-entering everything. The avatar step has its own
  // 'Continue without uploading' path so no flag here; the About step
  // already exposes 'Skip and finish' for the same reason.
  const identityFilled =
    initial.fullName.trim().length > 0 || initial.bio.trim().length > 0
  const socialsFilled =
    initial.socialLinkedin.trim().length > 0 ||
    initial.socialInstagram.trim().length > 0 ||
    initial.socialWhatsapp.trim().length > 0

  function submitIdentity() {
    const fd = new FormData()
    fd.set('fullName', fullName)
    fd.set('contactEmail', contactEmail)
    fd.set('bio', bio)
    startTransition(async () => {
      const r = await updateIdentity(fd)
      if (!r.ok) setError(r.error)
      else advance()
    })
  }

  async function submitAvatar() {
    // No new file picked: the existing avatar (preloaded from
    // initial.avatarUrl) is good enough to advance. Skip the upload
    // round-trip entirely.
    if (!avatarFile) {
      if (initial.avatarUrl) {
        advance()
        return
      }
      setError('Pick an image first.')
      return
    }
    setUploading(true)
    setError(null)
    const fd = new FormData()
    fd.set('file', avatarFile)
    const r = await uploadAvatar(fd)
    setUploading(false)
    if (!r.ok) setError(r.error)
    else advance()
  }

  function submitSocials() {
    const fd = new FormData()
    fd.set('socialLinkedin', socialLinkedin)
    fd.set('socialInstagram', socialInstagram)
    fd.set('socialWhatsapp', socialWhatsapp)
    startTransition(async () => {
      const r = await updateSocials(fd)
      if (!r.ok) setError(r.error)
      else advance()
    })
  }

  function submitAboutBasics() {
    startTransition(async () => {
      const r = await updateAboutBasics({
        roleFocus,
        timezone,
        workStyle,
        languages: languages.map((s) => s.trim()).filter(Boolean),
        headline
      })
      if (!r.ok) setError(r.error)
      else advance()
    })
  }

  function submitAboutWork(skip: boolean) {
    startTransition(async () => {
      // Both actions redirect server-side on success, so the resolved value
      // is only present on validation failure. Treat a missing value as a
      // successful redirect already in flight.
      const r = skip
        ? await skipOnboardingFinish()
        : await updateAboutWork({
            workLinks: workLinks.filter((l) => l.label.trim() && l.url.trim()),
            skills: skills.filter((s) => s.label.trim())
          })
      if (r && !r.ok) setError(r.error)
    })
  }

  return (
    <motion.div
      className="bg-card ring-foreground/10 relative w-full rounded-lg p-8 ring-1 md:p-10"
      initial={{ opacity: 0, y: 10, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 140, damping: 16 }}
    >
      <Stepper current={step} total={STEP_TITLES.length} />

      {error && (
        <motion.p
          key={`err-${error}`}
          initial={{ opacity: 0, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="text-destructive mt-4 text-xs"
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
            transition={{
              type: 'spring',
              stiffness: 360,
              damping: 32,
              mass: 0.7
            }}
          >
            <h1 className="text-lg font-medium">{STEP_TITLES[step]}</h1>
            <p className="text-muted-foreground mt-1 text-xs">
              {step === 0 &&
                "Replace the shared starter password with one you'll remember."}
              {step === 1 && 'Make sure these match what the team should see.'}
              {step === 2 && 'JPG, PNG, or WEBP up to 5 MB.'}
              {step === 3 &&
                "All optional. Leave anything blank you'd rather not share."}
              {step === 4 &&
                'A few details so teammates know what to ask you about.'}
              {step === 5 &&
                "Skip if you'd rather come back later, your profile will still work."}
            </p>
            <div className="mt-5">
              {step === 0 && (
                <FieldGroup className="gap-4">
                  <Field>
                    <FieldLabel htmlFor="password">New password</FieldLabel>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPw ? 'text' : 'password'}
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
                        aria-label={showPw ? 'Hide password' : 'Show password'}
                      >
                        {showPw ? (
                          <EyeOff className="size-3.5" />
                        ) : (
                          <Eye className="size-3.5" />
                        )}
                      </button>
                    </div>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="confirm">Confirm password</FieldLabel>
                    <Input
                      id="confirm"
                      type={showPw ? 'text' : 'password'}
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
                      {pending ? 'Saving…' : 'Continue'}
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
                    <FieldLabel htmlFor="contactEmail">
                      Contact email
                    </FieldLabel>
                    <Input
                      id="contactEmail"
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.currentTarget.value)}
                      placeholder="you@example.com"
                    />
                    <p className="text-muted-foreground text-[10px]">
                      Where you&apos;d like notifications. Different from your
                      @verbivore.app sign-in.
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
                  <Footer
                    onBack={back}
                    onNext={submitIdentity}
                    nextLabel="Continue"
                    pending={pending}
                    skipLabel={
                      identityFilled ? 'Keep current details' : undefined
                    }
                    onSkip={
                      identityFilled ? () => keepAndAdvance(2) : undefined
                    }
                  />
                </FieldGroup>
              )}

              {step === 2 && (
                <FieldGroup className="gap-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-input/40 ring-foreground/10 flex size-20 items-center justify-center overflow-hidden rounded-full ring-1">
                      {avatarPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatarPreview}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          No photo
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <label className="border-input bg-input/20 hover:bg-input/40 flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-xs">
                        <Upload className="size-3.5" />
                        {avatarFile
                          ? avatarFile.name
                          : initial.avatarUrl
                            ? 'Replace photo'
                            : 'Choose an image'}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="sr-only"
                          onChange={(e) => {
                            const f = e.currentTarget.files?.[0] ?? null
                            setAvatarFile(f)
                            // New pick wins; if cleared, fall back to the
                            // existing avatar URL instead of going blank.
                            setAvatarPreview(
                              f ? URL.createObjectURL(f) : initial.avatarUrl
                            )
                          }}
                        />
                      </label>
                      <p className="text-muted-foreground mt-2 text-[10px]">
                        {initial.avatarUrl
                          ? "We've kept the one you uploaded. Replace it or continue with this."
                          : 'Required to finish onboarding. Stored in the avatars bucket.'}
                      </p>
                    </div>
                  </div>
                  <Footer
                    onBack={back}
                    onNext={submitAvatar}
                    nextLabel={
                      uploading
                        ? 'Uploading…'
                        : avatarFile
                          ? 'Upload and continue'
                          : 'Continue'
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
                      onChange={(e) =>
                        setSocialInstagram(e.currentTarget.value)
                      }
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
                  <Footer
                    onBack={back}
                    onNext={submitSocials}
                    nextLabel="Continue"
                    pending={pending}
                    skipLabel={
                      socialsFilled ? 'Keep current socials' : undefined
                    }
                    onSkip={socialsFilled ? () => keepAndAdvance(4) : undefined}
                  />
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
                    <RolePills value={roleFocus} onChange={setRoleFocus} />
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
                    <FieldLabel htmlFor="workStyle">
                      How you work best
                    </FieldLabel>
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
                      value={languages.join(', ')}
                      onChange={(e) =>
                        setLanguages(
                          e.currentTarget.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean)
                        )
                      }
                      placeholder="Maltese, English, French"
                    />
                    <p className="text-muted-foreground text-[10px]">
                      Comma-separated.
                    </p>
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
                  <Footer
                    onBack={back}
                    onNext={submitAboutBasics}
                    nextLabel="Continue"
                    pending={pending}
                  />
                </FieldGroup>
              )}

              {step === 5 && (
                <FieldGroup className="gap-4">
                  <Field>
                    <FieldLabel>Work links</FieldLabel>
                    <p className="text-muted-foreground text-[10px]">
                      Pick a platform to prefill, or paste any URL.
                    </p>
                    <WorkLinksEditor
                      value={workLinks}
                      onChange={setWorkLinks}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Skills</FieldLabel>
                    <p className="text-muted-foreground text-[10px]">
                      Pick from suggestions or type your own.
                    </p>
                    <SkillsEditor value={skills} onChange={setSkills} />
                    <SkillSuggestions value={skills} onChange={setSkills} />
                  </Field>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <Button variant="ghost" onClick={back} disabled={pending}>
                      Back
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => submitAboutWork(true)}
                        disabled={pending}
                      >
                        Skip and finish
                      </Button>
                      <Button
                        onClick={() => submitAboutWork(false)}
                        disabled={pending}
                      >
                        {pending ? 'Saving…' : 'Save and finish'}
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
  )
}

// Direction-aware slide + fade between wizard steps. `mode="wait"` on the
// parent AnimatePresence keeps height calculations stable; the outer card
// resizes smoothly thanks to overflow-hidden + the spring easing.
const STEP_VARIANTS = {
  enter: (dir: number) => ({ x: dir * 28, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -28, opacity: 0 })
}

function Footer({
  onBack,
  onNext,
  nextLabel,
  pending,
  nextDisabled,
  skipLabel,
  onSkip
}: {
  onBack: () => void
  onNext: () => void
  nextLabel: string
  pending: boolean
  nextDisabled?: boolean
  // Optional 'Keep current X' link. Rendered between Back and Next when
  // provided. Used by re-runs of the wizard where the member already
  // filled this step before.
  skipLabel?: string
  onSkip?: () => void
}) {
  return (
    <div className="mt-2 flex items-center justify-between gap-2">
      <Button variant="ghost" onClick={onBack} disabled={pending}>
        Back
      </Button>
      <div className="flex items-center gap-3">
        {skipLabel && onSkip && (
          <button
            type="button"
            onClick={onSkip}
            disabled={pending}
            className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline disabled:opacity-50"
          >
            {skipLabel}
          </button>
        )}
        <Button onClick={onNext} disabled={pending || nextDisabled}>
          {nextLabel}
        </Button>
      </div>
    </div>
  )
}

function Stepper({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            'h-1 flex-1 rounded-full transition-colors',
            i <= current ? 'bg-primary' : 'bg-input/60'
          )}
        />
      ))}
    </div>
  )
}

// Click-to-add role pills. Treats the input as a comma-separated list so a
// member can pick multiple ("Frontend, Design"). Clicking a pill that's
// already in the list removes it.
function RolePills({
  value,
  onChange
}: {
  value: string
  onChange: (next: string) => void
}) {
  const selected = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const selectedSet = new Set(selected.map((s) => s.toLowerCase()))

  function toggle(role: string) {
    const lower = role.toLowerCase()
    const next = selectedSet.has(lower)
      ? selected.filter((s) => s.toLowerCase() !== lower)
      : [...selected, role]
    onChange(next.join(', '))
  }

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {ROLE_SUGGESTIONS.map((role) => {
        const active = selectedSet.has(role.toLowerCase())
        return (
          <button
            key={role}
            type="button"
            onClick={() => toggle(role)}
            className={cn(
              'rounded-md border px-1.5 py-0.5 text-[10px] transition-colors',
              active
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-input bg-input/10 hover:bg-input/30 hover:border-foreground/30'
            )}
          >
            {active ? role : `+ ${role}`}
          </button>
        )
      })}
    </div>
  )
}

// Maps the URL's hostname to a friendlier label. Used by the work-links chip
// input so the member can paste a URL and skip naming it.
const HOST_LABELS: Record<string, string> = {
  'github.com': 'GitHub',
  'linkedin.com': 'LinkedIn',
  'twitter.com': 'X',
  'x.com': 'X',
  'instagram.com': 'Instagram',
  'figma.com': 'Figma',
  'dribbble.com': 'Dribbble',
  'behance.net': 'Behance',
  'youtube.com': 'YouTube',
  'medium.com': 'Medium',
  'notion.so': 'Notion',
  'vimeo.com': 'Vimeo'
}

function inferLinkLabel(url: string): string {
  try {
    const normalized = url.match(/^https?:\/\//) ? url : `https://${url}`
    const host = new URL(normalized).hostname.replace(/^www\./, '')
    if (HOST_LABELS[host]) return HOST_LABELS[host]
    const stem = host.split('.')[0]
    return stem.charAt(0).toUpperCase() + stem.slice(1)
  } catch {
    return url
  }
}

// Quick-pick platforms for the work-links chip input. `stub` is the URL prefix
// the member only needs to append their handle to. Edit to retune.
const WORK_LINK_SUGGESTIONS: ReadonlyArray<{ label: string; stub: string }> = [
  { label: 'GitHub', stub: 'https://github.com/' },
  { label: 'Behance', stub: 'https://behance.net/' },
  { label: 'Dribbble', stub: 'https://dribbble.com/' },
  { label: 'Figma', stub: 'https://figma.com/@' },
  { label: 'YouTube', stub: 'https://youtube.com/@' },
  { label: 'Vimeo', stub: 'https://vimeo.com/' },
  { label: 'Medium', stub: 'https://medium.com/@' },
  { label: 'Notion', stub: 'https://notion.so/' },
  { label: 'Personal site', stub: 'https://' },
  { label: 'Portfolio', stub: 'https://' }
]

function WorkLinksEditor({
  value,
  onChange
}: {
  value: WorkLink[]
  onChange: (next: WorkLink[]) => void
}) {
  const [draft, setDraft] = useState('')
  // When the member clicks a platform pill we remember the label so the
  // committed chip carries it (avoids deriving "Notion" from a random
  // sub-page or losing the "Personal site" / "Portfolio" intent).
  const [pendingLabel, setPendingLabel] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const picked = new Set(value.map((v) => v.label.toLowerCase()))

  function commit() {
    const url = draft.trim()
    if (!url || value.length >= 10) return
    const label = pendingLabel ?? inferLinkLabel(url)
    onChange([...value, { label, url }])
    setDraft('')
    setPendingLabel(null)
  }

  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx))
  }

  function pickPlatform(s: { label: string; stub: string }) {
    setDraft(s.stub)
    setPendingLabel(s.label)
    requestAnimationFrame(() => {
      const el = inputRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <ChipShell>
        {value.map((link, i) => (
          <Chip key={i} onRemove={() => remove(i)} title={link.url}>
            {link.label || link.url}
          </Chip>
        ))}
        <ChipInput
          ref={inputRef}
          value={draft}
          onChange={(next) => {
            setDraft(next)
            if (!next) setPendingLabel(null)
          }}
          onCommit={commit}
          onBackspace={() => value.length && remove(value.length - 1)}
          disabled={value.length >= 10}
          placeholder={
            value.length
              ? value.length >= 10
                ? 'Up to 10 links'
                : 'Add another link'
              : 'Paste a URL, then Enter'
          }
        />
      </ChipShell>
      <div className="flex flex-wrap gap-1">
        {WORK_LINK_SUGGESTIONS.filter(
          (s) => !picked.has(s.label.toLowerCase())
        ).map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => pickPlatform(s)}
            disabled={value.length >= 10}
            className="border-input bg-input/10 hover:bg-input/30 hover:border-foreground/30 rounded-md border px-1.5 py-0.5 text-[10px] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            + {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function SkillsEditor({
  value,
  onChange
}: {
  value: Skill[]
  onChange: (next: Skill[]) => void
}) {
  const [draft, setDraft] = useState('')

  function commit() {
    const label = draft.trim()
    if (!label || value.length >= 30) return
    // Existing skill level stays at the schema's mid default; without the
    // rating UI we can't surface per-skill levels.
    onChange([...value, { label, level: 3 }])
    setDraft('')
  }

  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx))
  }

  return (
    <ChipShell>
      {value.map((skill, i) => (
        <Chip key={i} onRemove={() => remove(i)}>
          {skill.label}
        </Chip>
      ))}
      <ChipInput
        value={draft}
        onChange={setDraft}
        onCommit={commit}
        onBackspace={() => value.length && remove(value.length - 1)}
        disabled={value.length >= 30}
        placeholder={
          value.length
            ? value.length >= 30
              ? 'Up to 30 skills'
              : 'Add another skill'
            : 'Type a skill, then Enter'
        }
      />
    </ChipShell>
  )
}

// Curated, static suggestions grouped by discipline. Edit this map to retune
// what the chip picker offers; it stays local so there's no network call.
const SKILL_SUGGESTIONS: Record<string, readonly string[]> = {
  Engineering: [
    'React',
    'Next.js',
    'TypeScript',
    'Node.js',
    'Python',
    'SQL',
    'Postgres',
    'Supabase'
  ],
  Design: [
    'Figma',
    'UI design',
    'UX research',
    'Illustration',
    'Motion',
    'Branding'
  ],
  Content: [
    'Copywriting',
    'Editing',
    'SEO',
    'Video editing',
    'Podcast production'
  ],
  Production: [
    'Transcription',
    'Translation',
    'Subtitling',
    'Color grading',
    'Audio mixing'
  ],
  Operations: [
    'Project management',
    'QA',
    'Customer support',
    'Recruiting',
    'Finance ops'
  ],
  Security: ['Pen testing', 'Threat modeling', 'Incident response', 'Compliance']
}

function SkillSuggestions({
  value,
  onChange
}: {
  value: Skill[]
  onChange: (next: Skill[]) => void
}) {
  const picked = new Set(value.map((s) => s.label.toLowerCase()))

  function pick(label: string) {
    if (picked.has(label.toLowerCase()) || value.length >= 30) return
    onChange([...value, { label, level: 3 }])
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      {Object.entries(SKILL_SUGGESTIONS).map(([category, items]) => {
        const available = items.filter((s) => !picked.has(s.toLowerCase()))
        if (!available.length) return null
        return (
          <div key={category} className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground w-20 shrink-0 text-[10px]">
              {category}
            </span>
            <div className="flex flex-1 flex-wrap gap-1">
              {available.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => pick(label)}
                  className="border-input bg-input/10 hover:bg-input/30 hover:border-foreground/30 rounded-md border px-1.5 py-0.5 text-[10px] transition-colors"
                >
                  + {label}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ChipShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-input bg-input/20 focus-within:border-ring focus-within:ring-ring/30 flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border px-1.5 py-1 transition-colors focus-within:ring-2">
      {children}
    </div>
  )
}

function Chip({
  children,
  onRemove,
  title
}: {
  children: React.ReactNode
  onRemove: () => void
  title?: string
}) {
  return (
    <span
      className="bg-foreground/5 ring-foreground/10 inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-xs ring-1"
      title={title}
    >
      <span className="truncate">{children}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove"
        className="text-muted-foreground hover:text-foreground -mr-0.5 inline-flex size-3.5 shrink-0 items-center justify-center rounded-sm"
      >
        <X className="size-3" />
      </button>
    </span>
  )
}

function ChipInput({
  ref,
  value,
  onChange,
  onCommit,
  onBackspace,
  placeholder,
  disabled
}: {
  ref?: React.Ref<HTMLInputElement>
  value: string
  onChange: (next: string) => void
  onCommit: () => void
  onBackspace: () => void
  placeholder: string
  disabled?: boolean
}) {
  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault()
          onCommit()
        } else if (e.key === 'Backspace' && !value) {
          onBackspace()
        }
      }}
      onBlur={onCommit}
      disabled={disabled}
      placeholder={placeholder}
      className="placeholder:text-muted-foreground min-w-35 flex-1 bg-transparent px-1 text-xs outline-none disabled:cursor-not-allowed disabled:opacity-50"
    />
  )
}

function guessTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  } catch {
    return ''
  }
}
