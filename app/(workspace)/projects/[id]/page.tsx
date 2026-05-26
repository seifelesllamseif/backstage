import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentCrewMember } from "@/lib/dal";
import { fetchDashboardData } from "../../dashboard/actions";
import DashboardShell from "../../dashboard/_components/DashboardShell";
import {
  groupActivityByTask,
  groupCommentsByTask,
  groupExternalRefsByProject,
  groupExternalRefsByTask,
  mapCycles,
  mapMembers,
  mapTasks,
} from "../../dashboard/_components/mappers";

// Per-project deep link. Renders the same DashboardShell as /dashboard
// with the project filter pre-pinned. See decision 0022 — /dashboard is
// the primary surface, /projects/[id] is kept so existing bookmarks keep
// working and per-project links route to a focused view.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const member = await getCurrentCrewMember();
  if (!member) {
    return { title: "Task Handoff · Verbivore" };
  }
  const project = await prisma.project.findFirst({
    where: { id, companyId: member.companyId },
    select: { name: true },
  });
  return {
    title: project ? `${project.name} · Verbivore` : "Task Handoff · Verbivore",
    description:
      "Hand off, receive and track tasks across the Verbivore team.",
  };
}

export default async function ProjectBoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = await params;

  const member = await getCurrentCrewMember();
  if (!member) {
    throw new Error("No crew_member row for the current auth user.");
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: member.companyId },
    select: { id: true },
  });
  if (!project) {
    notFound();
  }

  const data = await fetchDashboardData(project.id);

  const members = mapMembers(data.members);
  const tasks = mapTasks(data.tasks, members, data.members);
  const cycles = mapCycles(data.cycles, tasks);
  const commentsByTask = groupCommentsByTask(data.comments);
  const activityByTask = groupActivityByTask(data.activity);
  const externalRefsByTask = groupExternalRefsByTask(data.externalRefs);
  const externalRefsByProject = groupExternalRefsByProject(
    data.projectExternalRefs,
  );

  return (
    <DashboardShell
      initial={{
        tasks,
        members,
        cycles,
        projects: data.projects.map((p) => ({
          id: p.id,
          name: p.name,
          kind: p.kind,
          isArchived: p.isArchived,
          githubRepo: p.githubRepo,
        })),
        allActiveProjects: data.allActiveProjects,
        labels: data.labels.map((l) => ({ id: l.id, name: l.name })),
        commentsByTask,
        activityByTask,
        externalRefsByTask,
        externalRefsByProject,
        currentMember: {
          id: data.currentMember.id,
          fullName: data.currentMember.fullName,
          accessTier: data.currentMember.accessTier,
        },
        currentProjectId: project.id,
        defaultProjectId: project.id,
      }}
    />
  );
}
