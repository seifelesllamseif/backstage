import { redirect } from "next/navigation";
import { getCurrentCrewMember } from "@/lib/dal";

// /profile — bounces to the current user's /people/[id] page.
// See docs/decisions/0018-profile-pages.md.

export default async function ProfileRedirectPage() {
  const member = await getCurrentCrewMember();
  if (!member) {
    throw new Error("No crew_member row for the current auth user.");
  }
  redirect(`/people/${member.id}`);
}
