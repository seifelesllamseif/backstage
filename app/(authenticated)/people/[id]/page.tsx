import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentCrewMember } from "@/lib/dal";
import { ProfileBento } from "./profile-bento";

// /people/[id] — bento profile page for any crew_member in the current
// company. See docs/decisions/0018-profile-pages.md.

export default async function PersonProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await getCurrentCrewMember();
  if (!me) {
    throw new Error("No crew_member row for the current auth user.");
  }

  const member = await prisma.crewMember.findFirst({
    where: { id, companyId: me.companyId },
  });
  if (!member) {
    notFound();
  }

  const tasks = await prisma.task.findMany({
    where: {
      companyId: me.companyId,
      assigneeId: member.id,
      status: { notIn: ["done", "canceled"] },
    },
    include: {
      project: { select: { name: true } },
      handoff: {
        select: {
          whatItIs: true,
          currentStatus: true,
          doneSoFar: true,
          stillLeft: true,
          fileLinks: true,
          gotchas: true,
          whoToAsk: true,
        },
      },
    },
    orderBy: [
      { dueDate: { sort: "asc", nulls: "last" } },
      { createdAt: "desc" },
    ],
  });

  const upcoming = tasks
    .filter((t) => t.dueDate !== null)
    .slice(0, 5)
    .map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate as Date,
      projectId: t.projectId,
    }));

  return (
    <ProfileBento
      member={member}
      tasks={tasks}
      upcoming={upcoming}
      isSelf={member.id === me.id}
    />
  );
}
