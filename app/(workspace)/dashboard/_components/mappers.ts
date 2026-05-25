// Mappers from Supabase/Prisma DB shapes → the dashboard's frontend types.
// The frontend types live in `boardData.ts` and `status.ts`. We keep them
// stable so the hundreds of lines of UI code don't need to know that the
// data now comes from a database.

import type {
  DashboardTask,
  DashboardMember,
  DashboardProject,
} from "../actions";
import type {
  BoardAssignee,
  BoardTask,
  Cycle,
  TaskRelation,
  ChecklistItem,
} from "./boardData";
import type { TaskStatus, TaskPriority, RelationKind } from "./status";
import type { TaskComment, TaskActivity } from "./TaskDetail";

// Stable color rotation for assignees keyed by index.
const COLOR_RING = [
  "bg-red-500/80",
  "bg-sky-500/80",
  "bg-emerald-500/80",
  "bg-amber-500/80",
  "bg-violet-500/80",
  "bg-pink-500/80",
  "bg-cyan-500/80",
  "bg-indigo-500/80",
];

export function memberColor(index: number) {
  return COLOR_RING[index % COLOR_RING.length];
}

export function initialsFromName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function mapMember(
  member: DashboardMember,
  index: number,
): BoardAssignee {
  return {
    id: member.id,
    initials: member.avatarInitials ?? initialsFromName(member.fullName),
    name: member.fullName,
    color: memberColor(index),
    photo: member.avatarUrl ?? undefined,
    role: member.accessTier,
  };
}

export function mapMembers(members: DashboardMember[]): BoardAssignee[] {
  return members.map((m, i) => mapMember(m, i));
}

function formatDueDate(d: Date | null | undefined): string | undefined {
  if (!d) return undefined;
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function mapTask(
  task: DashboardTask,
  membersByDbId: Map<string, BoardAssignee>,
): BoardTask {
  const assignee = task.assigneeId
    ? membersByDbId.get(task.assigneeId)
    : undefined;

  const tags = task.labels
    .map((tl) => tl.label?.name)
    .filter((n): n is string => Boolean(n));

  const checklist: ChecklistItem[] = task.checklist.map((c) => ({
    id: c.id,
    text: c.text,
    done: c.isDone,
  }));

  // depsOut: this task → dependsOn target (e.g. "this blocks X" or "this is sub_issue of X")
  // depsIn: someone else → this task (the inverse direction)
  const relationsOut: TaskRelation[] = task.depsOut
    .filter((d) => d.dependsOn?.ref)
    .map((d) => ({ kind: d.kind as RelationKind, ref: d.dependsOn!.ref! }));
  const relationsIn: TaskRelation[] = task.depsIn
    .filter((d) => d.task?.ref)
    .map((d) => ({
      kind: invertRelation(d.kind as RelationKind),
      ref: d.task!.ref!,
    }));
  const relations = [...relationsOut, ...relationsIn];

  return {
    id: task.id,
    ref: task.ref ?? task.id.slice(0, 8).toUpperCase(),
    title: task.title,
    status: task.status as TaskStatus,
    priority: task.priority as TaskPriority,
    assignee,
    projectId: task.projectId ?? undefined,
    tags: tags.length ? tags : undefined,
    due: formatDueDate(task.dueDate),
    dueAt: task.dueDate
      ? (task.dueDate instanceof Date
          ? task.dueDate
          : new Date(task.dueDate as unknown as string)
        ).toISOString()
      : undefined,
    sortOrder: task.sortOrder ?? undefined,
    createdAt:
      task.createdAt instanceof Date
        ? task.createdAt.toISOString().slice(0, 10)
        : String(task.createdAt).slice(0, 10),
    updatedAt:
      task.updatedAt instanceof Date
        ? task.updatedAt.toISOString()
        : String(task.updatedAt),
    relations: relations.length ? relations : undefined,
    checklist: checklist.length ? checklist : undefined,
  };
}

function invertRelation(kind: RelationKind): RelationKind {
  switch (kind) {
    case "blocked_by":
      return "blocks";
    case "blocks":
      return "blocked_by";
    case "parent":
      return "sub_issue";
    case "sub_issue":
      return "parent";
    default:
      return kind;
  }
}

export function mapTasks(
  tasks: DashboardTask[],
  members: BoardAssignee[],
  dbMembers: DashboardMember[],
): BoardTask[] {
  // Build a lookup of DB-id → BoardAssignee using the same index used to color.
  const byDbId = new Map<string, BoardAssignee>();
  dbMembers.forEach((m, i) => {
    byDbId.set(m.id, members[i]);
  });
  return tasks.map((t) => mapTask(t, byDbId));
}

// ─── Cycles ───────────────────────────────────────────────────────────────

type DashCycle = {
  id: string;
  number: number;
  name: string;
  status: "completed" | "current" | "upcoming";
  fromDate: Date | string;
  toDate: Date | string;
  tasks: { taskId: string }[];
};

export function mapCycle(cycle: DashCycle, allTasks: BoardTask[]): Cycle {
  const taskIds = cycle.tasks.map((t) => t.taskId);
  const cycleTasks = allTasks.filter((t) => taskIds.includes(t.id));
  const scope = cycleTasks.length;
  const startedCount = cycleTasks.filter(
    (t) => t.status !== "backlog" && t.status !== "unscoped",
  ).length;
  const completedCount = cycleTasks.filter((t) => t.status === "done").length;

  return {
    id: cycle.id,
    number: cycle.number,
    name: cycle.name,
    status: cycle.status,
    from: formatDueDate(cycle.fromDate as Date) ?? "",
    to: formatDueDate(cycle.toDate as Date) ?? "",
    scope,
    startedCount,
    startedPct: scope ? Math.round((startedCount / scope) * 100) : 0,
    completedCount,
    completedPct: scope ? Math.round((completedCount / scope) * 100) : 0,
    percent: scope ? Math.round((completedCount / scope) * 100) : 0,
    taskIds,
  };
}

export function mapCycles(cycles: DashCycle[], allTasks: BoardTask[]): Cycle[] {
  return cycles.map((c) => mapCycle(c, allTasks));
}

// ─── Comments + Activity ─────────────────────────────────────────────────

type DbComment = {
  id: string;
  taskId: string;
  body: string;
  createdAt: Date | string;
  editedAt: Date | string | null;
  mentions: string[];
  author: { id: string; fullName: string; avatarInitials: string | null } | null;
};

type DbActivity = {
  id: string;
  entityId: string | null;
  action: string;
  createdAt: Date | string;
  metadata: unknown;
  actor: { id: string; fullName: string; avatarInitials: string | null } | null;
};

function formatTimestamp(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function groupCommentsByTask(
  comments: DbComment[],
): Record<string, TaskComment[]> {
  const out: Record<string, TaskComment[]> = {};
  for (const c of comments) {
    const list = out[c.taskId] ?? [];
    const authorName = c.author?.fullName ?? "Someone";
    list.push({
      id: c.id,
      author: authorName,
      authorId: c.author?.id ?? null,
      authorInitials:
        c.author?.avatarInitials ?? initialsFromName(authorName),
      body: c.body,
      at: formatTimestamp(c.createdAt),
      editedAt: c.editedAt
        ? (c.editedAt instanceof Date
            ? c.editedAt
            : new Date(c.editedAt)
          ).toISOString()
        : undefined,
      mentions: c.mentions,
    });
    out[c.taskId] = list;
  }
  return out;
}

// Maps a DB activity row to the dashboard's TaskActivity. The frontend
// only renders a small set of kinds; anything else is bucketed as 'status'
// so the timeline renders without losing the event.
function activityKindFor(action: string): TaskActivity["kind"] {
  if (action.startsWith("comment.")) return "comment";
  if (action === "task.created") return "created";
  if (action === "task.priority_changed") return "priority";
  if (action === "task.assignee_changed") return "assignee";
  if (action === "task.attachment_added") return "attachment";
  return "status";
}

function formatStatus(v: unknown): string {
  return String(v).replace(/_/g, " ");
}

function activityTextFor(row: DbActivity): string {
  const who = row.actor?.fullName ?? "Someone";
  const meta = (row.metadata as Record<string, unknown> | null) ?? null;
  const from = meta?.from;
  const to = meta?.to;
  switch (row.action) {
    case "task.created":
      return `${who} created the task`;
    case "task.status_changed":
      if (from != null && to != null) {
        return `${who} moved this from ${formatStatus(from)} to ${formatStatus(to)}`;
      }
      // Old-format rows from before the from/to migration.
      if (meta?.status) return `${who} set status to ${formatStatus(meta.status)}`;
      return `${who} changed status`;
    case "task.priority_changed":
      if (from != null && to != null) {
        return `${who} changed priority from ${from} to ${to}`;
      }
      if (meta?.priority) return `${who} set priority to ${meta.priority}`;
      return `${who} changed priority`;
    case "task.assignee_changed": {
      const fromName = meta?.fromName ?? null;
      const toName = meta?.toName ?? null;
      if (toName && fromName) return `${who} reassigned from ${fromName} to ${toName}`;
      if (toName) return `${who} assigned this to ${toName}`;
      if (fromName) return `${who} unassigned ${fromName}`;
      return `${who} reassigned the task`;
    }
    case "task.duplicated":
      return `${who} duplicated this task`;
    case "task.deleted":
      return `${who} deleted the task`;
    case "comment.added":
      return `${who} left a comment`;
    case "comment.edited":
      return `${who} edited a comment`;
    case "comment.deleted":
      return `${who} deleted a comment`;
    default:
      return `${who} · ${row.action}`;
  }
}

export function groupActivityByTask(
  activity: DbActivity[],
): Record<string, TaskActivity[]> {
  const out: Record<string, TaskActivity[]> = {};
  for (const a of activity) {
    if (!a.entityId) continue;
    const list = out[a.entityId] ?? [];
    list.push({
      id: a.id,
      kind: activityKindFor(a.action),
      text: activityTextFor(a),
      at: formatTimestamp(a.createdAt),
    });
    out[a.entityId] = list;
  }
  return out;
}
