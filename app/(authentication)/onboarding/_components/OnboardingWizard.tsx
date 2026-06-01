'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Eye, EyeOff, Link2, Plus, Trash2, Upload, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  setAvatarUrl,
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

// Curated suggestion lists. Static by design (decision 0029 follow-up):
// fast, predictable, no server calls; easy to extend by editing this
// array. The chip pickers below render the first 8 by default with a
// 'Show more' toggle so the form stays compact.
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

const TIMEZONE_SUGGESTIONS = [
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Istanbul',
  'Africa/Cairo',
  'Asia/Karachi',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Sao_Paulo',
  'Australia/Sydney'
] as const

const LANGUAGE_SUGGESTIONS = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Dutch',
  'Polish',
  'Russian',
  'Turkish',
  'Arabic',
  'Persian',
  'Hebrew',
  'Hindi',
  'Urdu',
  'Bengali',
  'Tamil',
  'Mandarin',
  'Cantonese',
  'Japanese',
  'Korean',
  'Vietnamese',
  'Thai',
  'Indonesian',
  'Swahili',
  'Maltese'
] as const

const SKILL_SUGGESTIONS = [
  'React',
  'Next.js',
  'TypeScript',
  'Node.js',
  'Python',
  'Go',
  'Rust',
  'Swift',
  'Kotlin',
  'Java',
  'C#',
  'PHP',
  'Tailwind CSS',
  'CSS',
  'HTML',
  'Figma',
  'Photoshop',
  'Illustrator',
  'After Effects',
  'Webflow',
  'WordPress',
  'Supabase',
  'Stripe',
  'PostgreSQL',
  'Redis',
  'Docker',
  'AWS',
  'Vercel',
  'Copywriting',
  'SEO',
  'Translation',
  'Transcription',
  'Video editing',
  'Photography',
  'Public speaking',
  'Project management'
] as const

const WORK_LINK_LABEL_SUGGESTIONS = [
  'GitHub',
  'LinkedIn',
  'Twitter/X',
  'Personal site',
  'Portfolio',
  'Dribbble',
  'Behance',
  'Medium',
  'Substack',
  'YouTube',
  'Twitch',
  'Read.cv'
] as const

export function OnboardingWizard({ initial }: { initial: OnboardingInitial }) {
  const router = useRouter()
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
  const [oldPassword, setOldPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showOldPw, setShowOldPw] = useState(false)

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
  // Drop-zone hover state for the avatar step. Drives the border ring.
  const [avatarDragOver, setAvatarDragOver] = useState(false)
  // 'Paste a URL' affordance: toggled by the link icon, shows an inline
  // input under the upload row. Submitting calls setAvatarUrl which
  // writes the URL directly to team_members without going through
  // Supabase Storage.
  const [avatarUrlMode, setAvatarUrlMode] = useState(false)
  const [avatarUrlDraft, setAvatarUrlDraft] = useState('')

  const [socialLinkedin, setSocialLinkedin] = useState(initial.socialLinkedin)
  const [socialInstagram, setSocialInstagram] = useState(
    initial.socialInstagram
  )
  // WhatsApp is stored as https://wa.me/<digits> server-side but we only
  // ask the member for the phone number (digits, country code first).
  // Derive the initial digits from any existing wa.me URL so editing
  // doesn't lose the previously-entered number.
  const [whatsappPhone, setWhatsappPhone] = useState<string>(() => {
    const m = initial.socialWhatsapp.match(/wa\.me\/(\d+)/i)
    return m?.[1] ?? ''
  })

  const [roleFocus, setRoleFocus] = useState(initial.roleFocus)
  const [timezone, setTimezone] = useState(initial.timezone || guessTimezone())
  const [workStyle, setWorkStyle] = useState(initial.workStyle)
  const [languages, setLanguages] = useState<string[]>(
    initial.languages.length ? initial.languages : ['English']
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

  function finish() {
    router.replace('/dashboard')
    router.refresh()
  }

  // ── Step actions ────────────────────────────────────────────────────────
  function submitPassword() {
    const fd = new FormData()
    fd.set('oldPassword', oldPassword)
    fd.set('password', password)
    fd.set('confirm', confirm)
    startTransition(async () => {
      const r = await updatePassword(fd)
      if (!r.ok) setError(r.error)
      else advance()
    })
  }

  // Strong-password generator. 16 chars from a deliberately-curated
  // alphabet (no look-alike pairs like 0/O or 1/l/I) + guaranteed mix
  // of each character class so any downstream policy is satisfied.
  // crypto.getRandomValues is used over Math.random for entropy.
  function generatePassword(): string {
    const lower = 'abcdefghjkmnpqrstuvwxyz'
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    const digits = '23456789'
    const symbols = '!@#$%^&*-_=+'
    const all = lower + upper + digits + symbols
    const pick = (set: string, n: number) => {
      const out: string[] = []
      const arr = new Uint32Array(n)
      crypto.getRandomValues(arr)
      for (let i = 0; i < n; i++) out.push(set[arr[i] % set.length])
      return out
    }
    const required = [
      ...pick(lower, 2),
      ...pick(upper, 2),
      ...pick(digits, 2),
      ...pick(symbols, 2)
    ]
    const filler = pick(all, 16 - required.length)
    const chars = [...required, ...filler]
    // Fisher-Yates shuffle so the required chars aren't always upfront.
    for (let i = chars.length - 1; i > 0; i--) {
      const buf = new Uint32Array(1)
      crypto.getRandomValues(buf)
      const j = buf[0] % (i + 1)
      ;[chars[i], chars[j]] = [chars[j], chars[i]]
    }
    return chars.join('')
  }

  function fillGeneratedPassword() {
    const next = generatePassword()
    setPassword(next)
    setConfirm(next)
    setShowPw(true)
    setError(null)
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

  // Drop-zone helpers for the avatar step. Validates kind/size client-
  // side before we even open the Object URL; the server still re-checks
  // in uploadAvatar.
  function applyAvatarFile(f: File | null) {
    if (!f) {
      setAvatarFile(null)
      setAvatarPreview(initial.avatarUrl)
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      setError('Image must be JPG, PNG, or WEBP.')
      return
    }
    if (f.size > 5 * 1024 * 1024) {
      setError('Image must be 5 MB or smaller.')
      return
    }
    setError(null)
    setAvatarFile(f)
    setAvatarPreview(URL.createObjectURL(f))
  }

  async function submitAvatarFromUrl() {
    const url = avatarUrlDraft.trim()
    if (!url) {
      setError('Paste a URL first.')
      return
    }
    setUploading(true)
    setError(null)
    const r = await setAvatarUrl(url)
    setUploading(false)
    if (!r.ok) {
      setError(r.error)
      return
    }
    setAvatarPreview(url)
    setAvatarUrlMode(false)
    setAvatarUrlDraft('')
    advance()
  }

  function submitSocials() {
    const digits = whatsappPhone.replace(/\D/g, '')
    const whatsappUrl = digits ? `https://wa.me/${digits}` : ''
    const fd = new FormData()
    fd.set('socialLinkedin', socialLinkedin)
    fd.set('socialInstagram', socialInstagram)
    fd.set('socialWhatsapp', whatsappUrl)
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
      const r = skip
        ? await skipOnboardingFinish()
        : await updateAboutWork({
            workLinks: workLinks.filter((l) => l.label.trim() && l.url.trim()),
            skills: skills.filter((s) => s.label.trim())
          })
      if (!r.ok) setError(r.error)
      else finish()
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
                'Who you are. All optional, but the more you fill in the easier it is for teammates to place you.'}
              {step === 5 &&
                "Links + skills. Skip if you'd rather come back later, your profile still works."}
            </p>
            <div className="mt-5">
              {step === 0 && (
                <FieldGroup className="gap-4">
                  <Field>
                    <FieldLabel htmlFor="oldPassword">
                      Current password
                    </FieldLabel>
                    <div className="relative">
                      <Input
                        id="oldPassword"
                        type={showOldPw ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.currentTarget.value)}
                        className="pr-7"
                      />
                      <button
                        type="button"
                        onClick={() => setShowOldPw((v) => !v)}
                        className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-1 flex items-center"
                        tabIndex={-1}
                        aria-label={
                          showOldPw
                            ? 'Hide current password'
                            : 'Show current password'
                        }
                      >
                        {showOldPw ? (
                          <EyeOff className="size-3.5" />
                        ) : (
                          <Eye className="size-3.5" />
                        )}
                      </button>
                    </div>
                    <p className="text-muted-foreground mt-1 text-[10px]">
                      The one you used to sign in (or the temp one you were
                      sent).
                    </p>
                  </Field>
                  <Field>
                    <div className="flex items-center justify-between gap-2">
                      <FieldLabel htmlFor="password">New password</FieldLabel>
                      <button
                        type="button"
                        onClick={fillGeneratedPassword}
                        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-[10px] underline-offset-2 hover:underline"
                      >
                        Generate a strong one
                      </button>
                    </div>
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
                    <div className="relative">
                      <textarea
                        id="bio"
                        value={bio}
                        onChange={(e) =>
                          setBio(e.currentTarget.value.slice(0, 500))
                        }
                        rows={3}
                        maxLength={500}
                        className="border-input bg-input/20 dark:bg-input/30 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/30 w-full rounded-md border px-2 py-1 pr-14 text-xs/relaxed outline-none focus-visible:ring-2"
                      />
                      <span
                        aria-live="polite"
                        className={`pointer-events-none absolute top-1 right-2 rounded bg-background/80 px-1 text-[10px] tabular-nums backdrop-blur-sm ${
                          bio.length >= 500
                            ? 'text-red-500'
                            : bio.length > 450
                              ? 'text-amber-500'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {bio.length}/500
                      </span>
                    </div>
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
                  <label
                    htmlFor="avatar-input"
                    onDragEnter={(e) => {
                      e.preventDefault()
                      setAvatarDragOver(true)
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setAvatarDragOver(true)
                    }}
                    onDragLeave={() => setAvatarDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault()
                      setAvatarDragOver(false)
                      const f = e.dataTransfer.files?.[0] ?? null
                      applyAvatarFile(f)
                    }}
                    className={cn(
                      'group relative flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-4 py-6 text-center transition',
                      avatarDragOver
                        ? 'border-[#00A89E] bg-[#00A89E]/5'
                        : 'border-input bg-input/10 hover:border-foreground/30 hover:bg-input/20'
                    )}
                  >
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
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-foreground inline-flex items-center gap-1.5 text-xs font-medium">
                        <Upload className="size-3.5" />
                        {avatarFile
                          ? avatarFile.name
                          : avatarDragOver
                            ? 'Drop to upload'
                            : initial.avatarUrl
                              ? 'Click or drop to replace'
                              : 'Click or drop an image'}
                      </span>
                      <span className="text-muted-foreground text-[10px]">
                        {initial.avatarUrl
                          ? "We've kept the one you uploaded. Replace or continue."
                          : 'JPG, PNG, or WEBP up to 5 MB.'}
                      </span>
                    </div>

                    <input
                      id="avatar-input"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(e) =>
                        applyAvatarFile(e.currentTarget.files?.[0] ?? null)
                      }
                    />

                    <button
                      type="button"
                      title={
                        avatarUrlMode ? 'Cancel URL input' : 'Paste image URL'
                      }
                      aria-label={
                        avatarUrlMode ? 'Cancel URL input' : 'Paste image URL'
                      }
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setAvatarUrlMode((v) => !v)
                      }}
                      className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-md border border-input bg-background/80 text-muted-foreground transition hover:text-foreground"
                    >
                      {avatarUrlMode ? (
                        <X className="size-3.5" />
                      ) : (
                        <Link2 className="size-3.5" />
                      )}
                    </button>
                  </label>

                  {avatarUrlMode && (
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="url"
                        autoFocus
                        value={avatarUrlDraft}
                        onChange={(e) =>
                          setAvatarUrlDraft(e.currentTarget.value)
                        }
                        placeholder="https://… (link to an image)"
                        className="text-xs"
                      />
                      <Button
                        type="button"
                        onClick={submitAvatarFromUrl}
                        disabled={uploading || !avatarUrlDraft.trim()}
                      >
                        {uploading ? 'Saving…' : 'Use link'}
                      </Button>
                    </div>
                  )}
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
                    <FieldLabel htmlFor="wa">WhatsApp number</FieldLabel>
                    <div className="border-input bg-input/20 focus-within:border-ring focus-within:ring-ring/30 flex items-center gap-1.5 rounded-md border px-2 focus-within:ring-2">
                      <span className="text-muted-foreground text-xs">+</span>
                      <input
                        id="wa"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel"
                        value={whatsappPhone}
                        onChange={(e) =>
                          setWhatsappPhone(
                            e.currentTarget.value.replace(/\D/g, '').slice(0, 20)
                          )
                        }
                        placeholder="35699123456"
                        className="placeholder:text-muted-foreground w-full bg-transparent py-1 text-xs/relaxed outline-none"
                      />
                    </div>
                    <p className="text-muted-foreground mt-1 text-[10px]">
                      Digits only, country code first (e.g. 356 for Malta).
                      We&apos;ll store it as https://wa.me/<i>{whatsappPhone || '…'}</i>.
                    </p>
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
                    <SuggestionChips
                      items={ROLE_SUGGESTIONS}
                      selected={[roleFocus]}
                      onPick={(s) => setRoleFocus(s)}
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
                    <SuggestionChips
                      items={TIMEZONE_SUGGESTIONS}
                      selected={[timezone]}
                      onPick={(s) => setTimezone(s)}
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
                    <LanguagesPicker
                      value={languages}
                      onChange={setLanguages}
                    />
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
                    <WorkLinksEditor
                      value={workLinks}
                      onChange={setWorkLinks}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Skills</FieldLabel>
                    <p className="text-muted-foreground text-[10px]">
                      Rate yourself Beginner to Expert. Free-form, add whatever
                      applies.
                    </p>
                    <SkillsEditor value={skills} onChange={setSkills} />
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

function WorkLinksEditor({
  value,
  onChange
}: {
  value: WorkLink[]
  onChange: (next: WorkLink[]) => void
}) {
  function update(idx: number, patch: Partial<WorkLink>) {
    onChange(value.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }
  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx))
  }
  function add(label = '') {
    if (value.length >= 10) return
    onChange([...value, { label, url: '' }])
  }
  const existingLabels = new Set(
    value.map((l) => l.label.trim().toLowerCase()).filter(Boolean)
  )
  const available = WORK_LINK_LABEL_SUGGESTIONS.filter(
    (s) => !existingLabels.has(s.toLowerCase())
  )
  return (
    <div className="flex flex-col gap-3">
      {value.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {value.map((link, i) => (
            <div
              key={i}
              className="group border-input bg-input/10 hover:bg-input/20 relative flex flex-col gap-1.5 rounded-md border p-2 transition"
            >
              <Input
                value={link.label}
                onChange={(e) => update(i, { label: e.currentTarget.value })}
                placeholder="Label"
                className="text-[11px]"
              />
              <Input
                value={link.url}
                onChange={(e) => update(i, { url: e.currentTarget.value })}
                placeholder="https://…"
                className="text-[11px]"
              />
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label="Remove link"
                className="text-muted-foreground hover:text-foreground absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {available.length > 0 && (
        <div>
          <p className="text-muted-foreground mb-1.5 text-[10px] tracking-wider uppercase">
            Add a link
          </p>
          <SuggestionChips
            items={available}
            selected={[]}
            onPick={(label) => add(label)}
            collapsedCount={8}
          />
        </div>
      )}
      {value.length < 10 && (
        <button
          type="button"
          onClick={() => add()}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 self-start text-[11px]"
        >
          <Plus className="size-3" /> Custom link
        </button>
      )}
    </div>
  )
}

const LEVEL_LABELS = [
  'Beginner',
  'Novice',
  'Intermediate',
  'Advanced',
  'Expert'
] as const

function SkillsEditor({
  value,
  onChange
}: {
  value: Skill[]
  onChange: (next: Skill[]) => void
}) {
  function update(idx: number, patch: Partial<Skill>) {
    onChange(value.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  }
  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx))
  }
  function add(label = '') {
    if (value.length >= 30) return
    onChange([...value, { label, level: 3 }])
  }
  const existing = new Set(
    value.map((s) => s.label.trim().toLowerCase()).filter(Boolean)
  )
  const available = SKILL_SUGGESTIONS.filter(
    (s) => !existing.has(s.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-3">
      {value.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {value.map((skill, i) => (
            <div
              key={i}
              className="group border-input bg-input/10 hover:bg-input/20 relative flex flex-col gap-2 rounded-md border p-2.5 transition"
            >
              <Input
                value={skill.label}
                onChange={(e) => update(i, { label: e.currentTarget.value })}
                placeholder="Skill"
                className="pr-7 text-[11px]"
              />
              <CompactRatingScale
                name={`skill-${i}`}
                value={skill.level}
                onChange={(level) => update(i, { level })}
              />
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label="Remove skill"
                className="text-muted-foreground hover:text-foreground absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {available.length > 0 && value.length < 30 && (
        <div>
          <p className="text-muted-foreground mb-1.5 text-[10px] tracking-wider uppercase">
            Suggestions
          </p>
          <SuggestionChips
            items={available}
            selected={[]}
            onPick={(label) => add(label)}
            collapsedCount={12}
          />
        </div>
      )}
      {value.length < 30 && (
        <button
          type="button"
          onClick={() => add()}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 self-start text-[11px]"
        >
          <Plus className="size-3" /> Custom skill
        </button>
      )}
    </div>
  )
}

// Compact 5-dot rating used inside skill tiles. No labels (Beginner /
// Expert) so the dots fit on a single line of the tile; the cluster
// stays selectable via the same radio-input pattern as RatingScale.
function CompactRatingScale({
  name,
  value,
  onChange
}: {
  name: string
  value: number
  onChange: (level: number) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      {LEVEL_LABELS.map((label, idx) => {
        const level = idx + 1
        const active = value >= level
        return (
          <label key={level} className="cursor-pointer" title={label}>
            <input
              type="radio"
              name={name}
              value={level}
              checked={value === level}
              onChange={() => onChange(level)}
              className="sr-only"
            />
            <span
              aria-hidden
              className={cn(
                'block size-3 rounded-full transition-colors',
                active ? 'bg-primary' : 'bg-input'
              )}
            />
          </label>
        )
      })}
      <span className="text-muted-foreground ml-1 text-[10px] tabular-nums">
        {LEVEL_LABELS[value - 1] ?? '—'}
      </span>
    </div>
  )
}

// Multi-select pill list with a free-text input for custom values. Used
// by the Languages field on step 4. Selected languages render as
// removable pills; tapping a suggestion adds it; the input adds a
// custom one on Enter / comma.
function LanguagesPicker({
  value,
  onChange
}: {
  value: string[]
  onChange: (next: string[]) => void
}) {
  const [draft, setDraft] = useState('')
  const lower = new Set(value.map((v) => v.toLowerCase()))
  const available = LANGUAGE_SUGGESTIONS.filter(
    (s) => !lower.has(s.toLowerCase())
  )
  const addOne = (raw: string) => {
    const v = raw.trim()
    if (!v || lower.has(v.toLowerCase())) {
      setDraft('')
      return
    }
    onChange([...value, v])
    setDraft('')
  }
  const remove = (v: string) =>
    onChange(value.filter((x) => x.toLowerCase() !== v.toLowerCase()))

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((v) => (
          <span
            key={v}
            className="bg-input/40 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
          >
            {v}
            <button
              type="button"
              onClick={() => remove(v)}
              aria-label={`Remove ${v}`}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              addOne(draft)
            } else if (e.key === 'Backspace' && draft === '' && value.length) {
              remove(value[value.length - 1])
            }
          }}
          onBlur={() => draft.trim() && addOne(draft)}
          placeholder={value.length === 0 ? 'Add a language…' : 'Add another…'}
          className="placeholder:text-muted-foreground flex-1 min-w-32 bg-transparent text-xs outline-none"
        />
      </div>
      {available.length > 0 && (
        <SuggestionChips
          items={available}
          selected={[]}
          onPick={(s) => addOne(s)}
          collapsedCount={10}
        />
      )}
    </div>
  )
}

// Horizontal-wrap suggestion list. Renders the first `collapsedCount`
// chips; if there are more, a 'Show more' chip expands the rest.
// Selected chips are visually muted but still clickable (no-op).
function SuggestionChips({
  items,
  selected,
  onPick,
  collapsedCount = 8
}: {
  items: readonly string[]
  selected: string[]
  onPick: (value: string) => void
  collapsedCount?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const lower = new Set(selected.map((s) => s.toLowerCase()))
  const visible = expanded ? items : items.slice(0, collapsedCount)
  const hasMore = items.length > collapsedCount
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.map((s) => {
        const active = lower.has(s.toLowerCase())
        return (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            disabled={active}
            className={cn(
              'border-input rounded-full border px-2 py-0.5 text-[11px] transition disabled:opacity-50',
              active
                ? 'bg-primary/15 text-foreground'
                : 'bg-input/20 hover:bg-input/40'
            )}
          >
            {s}
          </button>
        )
      })}
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-muted-foreground hover:text-foreground text-[11px] underline-offset-2 hover:underline"
        >
          {expanded ? 'Show fewer' : `Show ${items.length - collapsedCount} more`}
        </button>
      )}
    </div>
  )
}

function RatingScale({
  name,
  value,
  onChange
}: {
  name: string
  value: number
  onChange: (level: number) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground w-16 text-[10px]">Beginner</span>
      <div className="flex flex-1 items-center justify-between gap-1">
        {LEVEL_LABELS.map((label, idx) => {
          const level = idx + 1
          const active = value === level
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
                  'size-4 rounded-full border-2 transition-all',
                  active
                    ? 'border-primary bg-primary'
                    : 'border-input bg-input/30 group-hover:border-foreground/40'
                )}
              />
              <span
                className={cn(
                  'text-[9px] tabular-nums transition-colors',
                  active ? 'text-foreground' : 'text-muted-foreground/60'
                )}
              >
                {level}
              </span>
            </label>
          )
        })}
      </div>
      <span className="text-muted-foreground w-12 text-right text-[10px]">
        Expert
      </span>
    </div>
  )
}

function guessTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  } catch {
    return ''
  }
}
