import { redirect } from "next/navigation";
import { getCurrentCrewMember } from "@/lib/dal";

// /profile (no slug) — bounces to the current user's /profile/[slug] page.
// See decision 0018.

export default async function ProfileRedirectPage() {
  const member = await getCurrentCrewMember();
  if (!member) {
    throw new Error("No crew_member row for the current auth user.");
  }
  if (!member.slug) {
    // Defensive — slug should always be set, but fall back to cockpit
    // rather than redirect to a 404.
    redirect("/cockpit");
  }
  redirect(`/profile/${member.slug}`);
}
