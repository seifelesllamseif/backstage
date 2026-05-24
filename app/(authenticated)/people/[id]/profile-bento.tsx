"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { format, isBefore, startOfDay } from "date-fns";
import { StatusPill } from "@/components/ui/status-pill";
import { isHandoffComplete } from "@/lib/handoff";
import type { TaskStatus } from "@/lib/business-logic";

// Bento profile layout ported from old/portfolio/_components/Portfolio.tsx
// — adapted for the Backstage data model (no quote card, gallery card
// replaced with bio, "quote" slot replaced with handoff/Done summary).
// See docs/decisions/0018-profile-pages.md.

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
  handoff: { whatItIs: string | null; currentStatus: string | null; doneSoFar: string | null; stillLeft: string | null; fileLinks: string | null; gotchas: string | null; whoToAsk: string | null } | null;
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
};

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

  const socials: { key: string; href: string; label: string }[] = [];
  if (member.socialInstagram)
    socials.push({ key: "ig", href: member.socialInstagram, label: "Instagram" });
  if (member.socialLinkedin)
    socials.push({ key: "li", href: member.socialLinkedin, label: "LinkedIn" });
  if (member.socialWhatsapp)
    socials.push({ key: "wa", href: member.socialWhatsapp, label: "WhatsApp" });

  return (
    <div className="min-h-screen w-full bg-background p-3 sm:p-5 lg:p-6">
      <div
        className="mx-auto grid w-full max-w-[1600px] gap-3 sm:gap-4 lg:gap-5
                   grid-cols-1 md:grid-cols-12
                   md:grid-rows-[auto_minmax(0,1.1fr)_minmax(0,1fr)]"
      >
        {/* Name card */}
        <motion.section
          custom={0}
          variants={fade}
          initial="hidden"
          animate="visible"
          className={`${card} md:col-span-5 px-6 py-5 flex items-start justify-between gap-4`}
        >
          <div>
            <h1 className="text-3xl sm:text-4xl font-semibold uppercase tracking-wide">
              {member.fullName}
            </h1>
            <p className="mt-1 text-base text-accent sm:text-lg">
              {member.accessTier}
              {isSelf ? " · you" : null}
            </p>
          </div>
          {canEdit && (
            <Link
              href={`/people/${member.id}/edit`}
              className="shrink-0 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              {isSelf ? "Edit profile" : "Edit (admin)"}
            </Link>
          )}
        </motion.section>

        {/* Photo card */}
        <motion.section
          custom={1}
          variants={fade}
          initial="hidden"
          animate="visible"
          className="md:col-span-3 md:row-span-2 group relative overflow-hidden rounded-2xl border border-border"
        >
          {member.avatarUrl ? (
            <img
              src={member.avatarUrl}
              alt={member.fullName}
              className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <span className="text-7xl font-medium tracking-wider text-foreground/70 sm:text-8xl">
                {initials}
              </span>
            </div>
          )}
        </motion.section>

        {/* Bio card (replaces gallery) */}
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
          {member.bio ? (
            <p className="text-sm leading-relaxed text-foreground/85 sm:text-base">
              {member.bio}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No bio yet.
            </p>
          )}
        </motion.section>

        {/* Tasks card */}
        <motion.section
          custom={3}
          variants={fade}
          initial="hidden"
          animate="visible"
          className={`${card} md:col-span-5 md:row-span-1 flex flex-col p-6`}
        >
          <div className="mb-5 flex items-start justify-between">
            <h2 className="text-4xl font-semibold lowercase tracking-tight sm:text-5xl">
              tasks
            </h2>
            <Sparkles className="size-6 text-accent" />
          </div>

          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {isSelf
                ? "Nothing open on your plate."
                : `${member.fullName.split(" ")[0]} has nothing open right now.`}
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5 overflow-y-auto pr-1">
              {tasks.slice(0, 5).map((t) => {
                const overdue =
                  t.dueDate !== null &&
                  isBefore(t.dueDate, startOfDay(today)) &&
                  t.status !== "done" &&
                  t.status !== "canceled";
                return (
                  <li
                    key={t.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm"
                  >
                    <StatusPill status={t.status} />
                    <Link
                      href={`/projects/${t.projectId}?task=${t.id}`}
                      className="flex-1 truncate hover:underline"
                      title={t.title}
                    >
                      {t.title}
                    </Link>
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
                  </li>
                );
              })}
            </ul>
          )}

          {tasks.length > 5 && (
            <div className="mt-auto flex justify-end pt-4">
              <Link
                href="/cockpit"
                className="rounded-full border border-border bg-card px-4 py-2 text-sm transition hover:bg-muted"
              >
                View all
              </Link>
            </div>
          )}
        </motion.section>

        {/* Today + upcoming card */}
        <motion.section
          custom={4}
          variants={fade}
          initial="hidden"
          animate="visible"
          className={`${card} md:col-span-5 flex flex-col p-6`}
        >
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-3xl font-semibold">Today</h2>
              <p className="mt-1 text-xs text-muted-foreground">{todayLabel}</p>
            </div>
            <div className="w-12 overflow-hidden rounded-md border border-border text-center">
              <div className="bg-accent py-0.5 text-[10px] font-semibold text-accent-foreground">
                {month}
              </div>
              <div className="bg-foreground py-1 text-lg font-bold leading-none text-background">
                {day}
              </div>
            </div>
          </div>

          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No due dates coming up.
            </p>
          ) : (
            <ul className="flex flex-col gap-2 overflow-y-auto pr-1">
              {upcoming.map((e) => {
                const d = format(e.dueDate, "d");
                return (
                  <li
                    key={e.id}
                    className="flex gap-3 rounded-xl border border-border px-3 py-2"
                  >
                    <div className="flex items-stretch gap-2">
                      <span className="w-7 text-center text-lg font-semibold">
                        {d}
                      </span>
                      <span className="w-[3px] rounded-full bg-accent" />
                    </div>
                    <div className="flex flex-col gap-0.5 py-0.5 text-xs">
                      <Link
                        href={`/projects/${e.projectId}?task=${e.id}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {e.title}
                      </Link>
                      <span className="text-muted-foreground">
                        Due {format(e.dueDate, "EEEE, MMM d")}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </motion.section>

        {/* Handoff summary card (replaces quote) */}
        <motion.section
          custom={5}
          variants={fade}
          initial="hidden"
          animate="visible"
          className={`${card} md:col-span-3 flex flex-col p-6`}
        >
          <h2 className="mb-4 text-2xl font-semibold">Handoffs</h2>
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">To fill</dt>
              <dd className="text-2xl font-medium">
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

        {/* Languages + socials card */}
        <motion.section
          custom={6}
          variants={fade}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-3 md:col-span-4"
        >
          <div className={`${card} flex flex-1 flex-col gap-3 p-4`}>
            <div className="rounded-full border border-border px-4 py-3 text-sm text-muted-foreground">
              Languages
            </div>
            {member.languages.length === 0 ? (
              <div className="rounded-full border border-border px-4 py-3 text-sm text-muted-foreground">
                None set.
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-around gap-2 rounded-full border border-border px-3 py-2 text-xs uppercase tracking-wide">
                {member.languages.map((lang) => (
                  <span
                    key={lang}
                    className="px-3 py-1 text-foreground/80"
                  >
                    {lang}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div
            className={`${card} flex items-center justify-around gap-2 px-3 py-3 text-xs uppercase tracking-wide`}
          >
            {socials.length === 0 ? (
              <span className="px-3 py-1 text-muted-foreground">
                No socials
              </span>
            ) : (
              socials.map(({ key, href, label }) => (
                <a
                  key={key}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 text-foreground/80 transition hover:text-accent"
                >
                  {label}
                </a>
              ))
            )}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
