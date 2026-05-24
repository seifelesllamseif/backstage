import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentCrewMember } from "@/lib/dal";
import { EditProfileForm } from "./edit-profile-form";

// /people/[id]/edit — gated to self OR admin. Non-authorized visitors get
// bounced to the profile view. See decision 0018 + the follow-on commit.

export default async function EditProfilePage({
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

  const isSelf = member.id === me.id;
  const isAdmin = me.accessTier === "admin";
  if (!isSelf && !isAdmin) {
    redirect(`/people/${member.id}`);
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <header className="space-y-1">
        <h1 className="text-xl font-medium">Edit profile</h1>
        <p className="text-sm text-muted-foreground">
          {isSelf
            ? "Your bio, photo, socials, and languages."
            : `Editing ${member.fullName} (admin override).`}
        </p>
      </header>

      <EditProfileForm member={member} />
    </main>
  );
}
