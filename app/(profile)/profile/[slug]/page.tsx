import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentCrewMember } from "@/lib/dal";
import { ProfileBento } from "./profile-bento";

// /profile/[slug] — bento profile page for any crew_member in the current
// company, addressed by url-safe slug instead of UUID. See decision 0018.

export default async function PersonProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const me = await getCurrentCrewMember();
  if (!me) {
    throw new Error("No crew_member row for the current auth user.");
  }

  const member = await prisma.crewMember.findFirst({
    where: { slug, companyId: me.companyId },
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

  const isSelf = member.id === me.id;
  const canEdit = isSelf || me.accessTier === "admin";

  return (
    <ProfileBento
      member={member}
      tasks={tasks}
      upcoming={upcoming}
      isSelf={isSelf}
      canEdit={canEdit}
    />
  );
}
