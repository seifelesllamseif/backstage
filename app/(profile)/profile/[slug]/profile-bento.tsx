"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowUpRight,
  Briefcase,
  Camera,
  Check,
  MessageCircle,
  Pencil,
  X,
} from "lucide-react";
import { format, isBefore, startOfDay } from "date-fns";
import { StatusPill } from "@/components/ui/status-pill";
import { isHandoffComplete } from "@/lib/handoff";
import type { TaskStatus } from "@/lib/business-logic";
import {
  PROFILE_THEMES,
  PROFILE_THEME_LABELS,
  PROFILE_THEME_PREVIEW,
  resolveProfileTheme,
} from "@/lib/profile-themes";
import { updateProfile, type UpdateProfileState } from "./actions";

// Bento profile, visual pass per docs/decisions/0019-profile-portfolio-skin.md.
// Adopts the portfolio idioms (italic typography on the name card, cursor-
// tracking bio tooltip on the avatar, hero+rows treatment on tasks/today
// cards, hover-icon-behind-text on socials) while preserving the 0018 data
// binding, server action, and self/admin edit flow.

const card = "rounded-2xl border border-border bg-card";

const fade = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.05 * i, duration: 0.45, ease: "easeOut" as const },
  }),
};

type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate: Date | null;
  projectId: string;
  project: { name: string };
  handoff: {
    whatItIs: string | null;
    currentStatus: string | null;
    doneSoFar: string | null;
    stillLeft: string | null;
    fileLinks: string | null;
    gotchas: string | null;
    whoToAsk: string | null;
  } | null;
};

type Member = {
  id: string;
  fullName: string;
  avatarInitials: string | null;
  avatarUrl: string | null;
  accessTier: string;
  bio: string | null;
  socialInstagram: string | null;
  socialLinkedin: string | null;
  socialWhatsapp: string | null;
  languages: string[];
  profileTheme: string | null;
};

// Lucide 1.16 (vendored) doesn't ship brand glyphs, so each social uses a
// semantic stand-in: Camera → Instagram (photos), Briefcase → LinkedIn
// (work), MessageCircle → WhatsApp (chat). The icon is a faint hover
// decoration behind the label text — brand recognition isn't the point.
const SOCIAL_DEFS = [
  { key: "instagram", label: "Instagram", icon: Camera },
  { key: "linkedin", label: "LinkedIn", icon: Briefcase },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
] as const;

export function ProfileBento({
  member,
  tasks,
  upcoming,
  isSelf,
  canEdit,
}: {
  member: Member;
  tasks: Task[];
  upcoming: { id: string; title: string; dueDate: Date; projectId: string }[];
  isSelf: boolean;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const activeTheme = resolveProfileTheme(member.profileTheme);
  // Local state for the picker so the user gets immediate visual selection
  // feedback before save. The actual theme on the page comes from
  // member.profileTheme until save commits — picker hover/active state is
  // separate from the cascade.
  const [pickedTheme, setPickedTheme] = useState(activeTheme);

  const [state, action, pending] = useActionState<UpdateProfileState, FormData>(
    async (prev, formData) => {
      const result = await updateProfile(prev, formData);
      if (result === undefined) setEditing(false);
      return result;
    },
    undefined,
  );

  // Cursor-tracking bio tooltip on the avatar — ported from the portfolio's
  // ProfileImage, bound to member.bio instead of a separate quote field.
  const [tooltipShown, setTooltipShown] = useState(false);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onAvatarEnter = () => {
    if (editing || !member.bio) return;
    tooltipTimer.current = setTimeout(() => setTooltipShown(true), 350);
  };
  const onAvatarLeave = () => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    setTooltipShown(false);
  };
  const onAvatarMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    setCursor({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
  };

  const today = new Date();
  const todayDate = format(today, "MMM d").toUpperCase();
  const [month, day] = todayDate.split(" ");
  const todayLabel = format(today, "EEE d, yyyy");
  const initials =
    member.avatarInitials ??
    member.fullName
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  const incompleteHandoffs = tasks.filter(
    (t) => t.handoff !== null && !isHandoffComplete(t.handoff),
  ).length;
  const noHandoffYet = tasks.filter((t) => t.handoff === null).length;

  // Pick a "hero" task — overdue first, else earliest due, else first open.
  // Lifts one task into the ProjectList-style featured-card slot at the top
  // of the Tasks bento section.
  const heroTask = (() => {
    if (tasks.length === 0) return null;
    const todayStart = startOfDay(today);
    const sorted = [...tasks].sort((a, b) => {
      const aOver = a.dueDate !== null && a.dueDate < todayStart;
      const bOver = b.dueDate !== null && b.dueDate < todayStart;
      if (aOver !== bOver) return aOver ? -1 : 1;
      if (a.dueDate && b.dueDate)
        return a.dueDate.getTime() - b.dueDate.getTime();
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });
    return sorted[0];
  })();
  const restTasks = heroTask
    ? tasks.filter((t) => t.id !== heroTask.id).slice(0, 4)
    : [];

  const gridClass =
    "mx-auto grid w-full max-w-[1600px] gap-3 sm:gap-4 lg:gap-5 grid-cols-1 md:grid-cols-12 md:grid-rows-[auto_minmax(0,1.1fr)_minmax(0,1fr)]";

  const innerGrid = (
    <>
      {/* Name card — TitleSection idiom: bold uppercase name with italic
          font-normal role line underneath. */}
      <motion.section
        custom={0}
        variants={fade}
        initial="hidden"
        animate="visible"
        className={`${card} md:col-span-5 px-6 py-5 flex items-start justify-between gap-4`}
      >
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold uppercase tracking-wide leading-tight">
            {member.fullName}
          </h1>
          <p className="mt-1 text-base italic font-normal text-accent sm:text-lg">
            {member.accessTier}
            {isSelf ? " · you" : null}
          </p>
        </div>
        {canEdit && (
          <div className="flex shrink-0 items-center gap-2">
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  disabled={pending}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  <X className="size-3" />
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  <Check className="size-3" />
                  {pending ? "Saving…" : "Save"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Pencil className="size-3" />
                {isSelf ? "Edit profile" : "Edit (admin)"}
              </button>
            )}
          </div>
        )}
      </motion.section>

      {/* Photo card — ProfileImage idiom: avatar with cursor-tracking bio
          tooltip on hover. Tooltip suppressed while editing or when bio
          is empty. */}
      <motion.section
        custom={1}
        variants={fade}
        initial="hidden"
        animate="visible"
        className="md:col-span-3 md:row-span-2 group relative overflow-hidden rounded-2xl border border-border"
      >
        <div
          className="relative h-full w-full touch-none"
          onMouseEnter={onAvatarEnter}
          onMouseLeave={onAvatarLeave}
          onMouseMove={onAvatarMove}
        >
          {member.avatarUrl ? (
            <img
              src={member.avatarUrl}
              alt={member.fullName}
              className="absolute inset-0 h-full w-full select-none object-cover transition duration-500 group-hover:scale-[1.03]"
              draggable={false}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-muted transition duration-500 group-hover:scale-[1.03]">
              <span className="text-7xl font-medium tracking-wider text-foreground/70 sm:text-8xl">
                {initials}
              </span>
            </div>
          )}

          {!editing && member.bio && (
            <AnimatePresence>
              {tooltipShown && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="pointer-events-none absolute z-50 max-w-xs rounded-xl border border-border bg-card/85 px-3 py-2 text-xs text-foreground shadow-xl backdrop-blur-sm"
                  style={{ top: cursor.y + 20, left: cursor.x + 20 }}
                >
                  {member.bio.length > 180
                    ? `${member.bio.slice(0, 180)}…`
                    : member.bio}
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {editing && (
            <div className="absolute inset-x-0 bottom-0 bg-background/80 p-3 backdrop-blur-sm">
              <input
                name="avatarUrl"
                type="url"
                defaultValue={member.avatarUrl ?? ""}
                placeholder="Photo URL (https://…)"
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[11px]"
              />
            </div>
          )}
        </div>
      </motion.section>

      {/* About card — BioSection idiom: clean padded box. */}
      <motion.section
        custom={2}
        variants={fade}
        initial="hidden"
        animate="visible"
        className={`${card} md:col-span-4 md:row-span-2 flex flex-col p-6`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-medium">About</h2>
        </div>
        {editing ? (
          <textarea
            name="bio"
            defaultValue={member.bio ?? ""}
            rows={9}
            maxLength={2000}
            placeholder="A few lines on what you do here."
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        ) : member.bio ? (
          <p className="text-sm leading-relaxed text-foreground/85 sm:text-base">
            {member.bio}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No bio yet.</p>
        )}
      </motion.section>

      {/* Tasks card — ProjectList idiom: hero featured task + bordered rows
          with trailing arrow icons. */}
      <motion.section
        custom={3}
        variants={fade}
        initial="hidden"
        animate="visible"
        className={`${card} md:col-span-5 md:row-span-1 flex flex-col p-6`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-medium uppercase tracking-wide">Tasks</h2>
          <ArrowUpRight className="size-4 text-muted-foreground" />
        </div>

        {heroTask ? (
          <>
            <Link
              href={`/projects/${heroTask.projectId}?task=${heroTask.id}`}
              className="mb-3 block rounded-lg border border-border bg-muted/40 p-4 transition hover:bg-muted/70"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <StatusPill status={heroTask.status} />
                    {heroTask.dueDate && (
                      <span
                        className={
                          isBefore(heroTask.dueDate, startOfDay(today))
                            ? "text-xs font-medium text-destructive"
                            : "text-xs text-muted-foreground"
                        }
                      >
                        {format(heroTask.dueDate, "MMM d")}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-base font-medium">
                    {heroTask.title}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {heroTask.project.name}
                  </p>
                </div>
                <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
              </div>
            </Link>

            {restTasks.map((t) => {
              const overdue =
                t.dueDate !== null &&
                isBefore(t.dueDate, startOfDay(today)) &&
                t.status !== "done" &&
                t.status !== "canceled";
              return (
                <Link
                  key={t.id}
                  href={`/projects/${t.projectId}?task=${t.id}`}
                  className="flex items-center gap-3 border-t border-border/60 px-1 py-2.5 text-sm transition hover:bg-muted/30"
                >
                  <StatusPill status={t.status} />
                  <span className="flex-1 truncate" title={t.title}>
                    {t.title}
                  </span>
                  {t.dueDate ? (
                    <span
                      className={
                        overdue
                          ? "text-xs text-destructive"
                          : "text-xs text-muted-foreground"
                      }
                    >
                      {format(t.dueDate, "MMM d")}
                    </span>
                  ) : (
                    <span className="text-xs text-foreground/40">—</span>
                  )}
                  <ArrowUpRight className="size-3.5 text-muted-foreground" />
                </Link>
              );
            })}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {isSelf
              ? "Nothing open on your plate."
              : `${member.fullName.split(" ")[0]} has nothing open right now.`}
          </p>
        )}

        {tasks.length > 5 && (
          <div className="mt-auto flex justify-end pt-4">
            <Link
              href="/cockpit"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              View all <ArrowUpRight className="size-3" />
            </Link>
          </div>
        )}
      </motion.section>

      {/* Today / upcoming card — ProjectList idiom: today date as the hero
          banner, upcoming items as bordered rows. */}
      <motion.section
        custom={4}
        variants={fade}
        initial="hidden"
        animate="visible"
        className={`${card} md:col-span-5 flex flex-col p-6`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-medium uppercase tracking-wide">Today</h2>
          <ArrowUpRight className="size-4 text-muted-foreground" />
        </div>

        <div className="mb-3 flex items-center gap-4 rounded-lg border border-border bg-muted/40 p-4">
          <div className="w-14 shrink-0 overflow-hidden rounded-md border border-border text-center">
            <div className="bg-accent py-0.5 text-[10px] font-semibold text-accent-foreground">
              {month}
            </div>
            <div className="bg-foreground py-1 text-xl font-bold leading-none text-background">
              {day}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-medium">Today</p>
            <p className="text-xs text-muted-foreground">{todayLabel}</p>
          </div>
        </div>

        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No due dates coming up.
          </p>
        ) : (
          upcoming.map((e) => (
            <Link
              key={e.id}
              href={`/projects/${e.projectId}?task=${e.id}`}
              className="flex items-center gap-3 border-t border-border/60 px-1 py-2.5 text-sm transition hover:bg-muted/30"
            >
              <span className="w-7 shrink-0 text-center text-base font-semibold">
                {format(e.dueDate, "d")}
              </span>
              <span className="w-[3px] self-stretch rounded-full bg-accent" />
              <span className="flex-1 truncate" title={e.title}>
                {e.title}
              </span>
              <span className="text-xs text-muted-foreground">
                {format(e.dueDate, "EEE")}
              </span>
              <ArrowUpRight className="size-3.5 text-muted-foreground" />
            </Link>
          ))
        )}
      </motion.section>

      {/* Handoffs card — big to-fill count as the hero number, sub-counts
          underneath in muted type. */}
      <motion.section
        custom={5}
        variants={fade}
        initial="hidden"
        animate="visible"
        className={`${card} md:col-span-3 flex flex-col p-6`}
      >
        <h2 className="mb-4 text-2xl font-medium">Handoffs</h2>
        <dl className="flex flex-col gap-3 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="italic text-muted-foreground">to fill</dt>
            <dd className="text-3xl font-bold">
              {incompleteHandoffs + noHandoffYet}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
            <dt>Incomplete</dt>
            <dd>{incompleteHandoffs}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
            <dt>Not started</dt>
            <dd>{noHandoffYet}</dd>
          </div>
        </dl>
        {isSelf && (
          <div className="mt-auto pt-4">
            <Link
              href="/cockpit"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              View on Cockpit <ArrowUpRight className="size-3" />
            </Link>
          </div>
        )}
      </motion.section>

      {/* Languages + socials card — SocialLinks idiom: hover reveals platform
          icon faintly behind the label. */}
      <motion.section
        custom={6}
        variants={fade}
        initial="hidden"
        animate="visible"
        className="flex flex-col gap-3 md:col-span-4"
      >
        <div className={`${card} flex flex-1 flex-col gap-3 p-4`}>
          <div className="rounded-full border border-border px-4 py-2.5 text-sm italic text-muted-foreground">
            languages
          </div>
          {editing ? (
            <input
              name="languagesRaw"
              type="text"
              defaultValue={member.languages.join(", ")}
              placeholder="English, Arabic, Turkish"
              className="rounded-full border border-border bg-background px-4 py-2 text-sm"
            />
          ) : member.languages.length === 0 ? (
            <div className="rounded-full border border-border px-4 py-3 text-sm text-muted-foreground">
              None set.
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-around gap-2 rounded-full border border-border px-3 py-2 text-xs uppercase tracking-wide">
              {member.languages.map((lang) => (
                <span key={lang} className="px-3 py-1 text-foreground/80">
                  {lang}
                </span>
              ))}
            </div>
          )}
        </div>

        {editing ? (
          <>
            <div className={`${card} flex flex-col gap-2 p-3`}>
              <input
                name="socialInstagram"
                type="url"
                defaultValue={member.socialInstagram ?? ""}
                placeholder="Instagram URL"
                className="rounded-md border border-border bg-background px-3 py-1.5 text-xs"
              />
              <input
                name="socialLinkedin"
                type="url"
                defaultValue={member.socialLinkedin ?? ""}
                placeholder="LinkedIn URL"
                className="rounded-md border border-border bg-background px-3 py-1.5 text-xs"
              />
              <input
                name="socialWhatsapp"
                type="url"
                defaultValue={member.socialWhatsapp ?? ""}
                placeholder="WhatsApp URL"
                className="rounded-md border border-border bg-background px-3 py-1.5 text-xs"
              />
            </div>

            {/* Theme picker — see decision 0020. */}
            <div className={`${card} flex flex-col gap-2 p-3`}>
              <div className="px-1 text-xs italic text-muted-foreground">
                theme
              </div>
              <input type="hidden" name="profileTheme" value={pickedTheme} />
              <div className="flex items-stretch gap-2">
                {PROFILE_THEMES.map((key) => {
                  const preview = PROFILE_THEME_PREVIEW[key];
                  const selected = pickedTheme === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPickedTheme(key)}
                      disabled={pending}
                      aria-pressed={selected}
                      title={PROFILE_THEME_LABELS[key]}
                      className={`group flex flex-1 flex-col items-center gap-1.5 rounded-md border p-1.5 transition disabled:opacity-50 ${
                        selected
                          ? "border-ring ring-2 ring-ring/40"
                          : "border-border hover:border-ring/60"
                      }`}
                    >
                      <span
                        className="flex h-8 w-full overflow-hidden rounded border border-border"
                        aria-hidden
                      >
                        <span
                          className="h-full flex-1"
                          style={{ background: preview.bg }}
                        />
                        <span
                          className="h-full flex-1"
                          style={{ background: preview.card }}
                        />
                        <span
                          className="h-full w-3"
                          style={{ background: preview.accent }}
                        />
                      </span>
                      <span className="text-[10px] font-medium uppercase tracking-wide">
                        {PROFILE_THEME_LABELS[key]}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="px-1 text-[10px] text-muted-foreground">
                Applies on save. Yours alone — others see their own pick.
              </p>
            </div>
          </>
        ) : (
          <div
            className={`${card} flex items-center justify-around gap-2 px-3 py-3`}
          >
            {(() => {
              const socials = SOCIAL_DEFS.map((def) => {
                const url =
                  def.key === "instagram"
                    ? member.socialInstagram
                    : def.key === "linkedin"
                      ? member.socialLinkedin
                      : member.socialWhatsapp;
                return url ? { ...def, url } : null;
              }).filter((s): s is NonNullable<typeof s> => s !== null);

              if (socials.length === 0) {
                return (
                  <span className="px-3 py-1 text-xs italic text-muted-foreground">
                    No socials
                  </span>
                );
              }
              return socials.map(({ key, url, label, icon: Icon }) => (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative overflow-hidden px-3 py-1 text-xs font-medium uppercase tracking-wide"
                >
                  <span className="relative z-10 transition group-hover:opacity-60">
                    {label}
                  </span>
                  <span className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center opacity-0 transition group-hover:opacity-25">
                    <Icon className="size-6 text-foreground" />
                  </span>
                </a>
              ));
            })()}
          </div>
        )}
      </motion.section>

      {state?.error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive md:col-span-12"
        >
          {state.error}
        </p>
      )}
    </>
  );

  return (
    <div
      data-theme={activeTheme}
      className="relative min-h-screen w-full bg-background p-3 sm:p-5 lg:p-6 text-foreground"
    >
      {/* Floating back link — the sole nav affordance for /profile now that
          the sidebar is gone (decision 0021). Themed via the data-theme
          cascade on the parent. */}
      <Link
        href="/cockpit"
        className="absolute left-4 top-4 z-50 inline-flex items-center gap-1.5 rounded-md border border-border bg-card/70 px-2.5 py-1.5 text-xs text-muted-foreground backdrop-blur-sm transition hover:text-foreground"
      >
        <ArrowLeft className="size-3" />
        Cockpit
      </Link>

      {editing ? (
        <form action={action} className={gridClass}>
          <input type="hidden" name="memberId" value={member.id} />
          {innerGrid}
        </form>
      ) : (
        <div className={gridClass}>{innerGrid}</div>
      )}
    </div>
  );
}
