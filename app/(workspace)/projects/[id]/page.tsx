import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentCrewMember } from "@/lib/dal";
import { fetchDashboardData } from "../../dashboard/actions";
import DashboardShell from "../../dashboard/_components/DashboardShell";
import {
  mapCycles,
  mapMembers,
  mapTasks,
} from "../../dashboard/_components/mappers";

// Per-project deep link. Renders the same DashboardShell as /dashboard
// with the project filter pre-pinned. See decision 0022 — /dashboard is
// the primary surface, /projects/[id] is kept so existing bookmarks keep
// working and per-project links route to a focused view.

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

  return (
    <DashboardShell
      initial={{
        tasks,
        members,
        cycles,
        projects: data.projects.map((p) => ({ id: p.id, name: p.name })),
        labels: data.labels.map((l) => ({ id: l.id, name: l.name })),
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
