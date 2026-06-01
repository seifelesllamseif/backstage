import { Suspense } from "react";
import { redirect } from "next/navigation";

import { getCurrentTeamMember } from "@/lib/dal";
import { DEFAULT_LOGIN_ROUTE } from "@/routes";
import { LoginWordmark } from "@/components/login-wordmark";
import { OnboardingWizard } from "./_components/OnboardingWizard";

export default function OnboardingPage() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden p-6">
      <LoginWordmark />
      <Suspense fallback={null}>
        <OnboardingContent />
      </Suspense>
    </div>
  );
}

async function OnboardingContent() {
  const member = await getCurrentTeamMember();
  if (!member) {
    redirect(DEFAULT_LOGIN_ROUTE);
  }

  return (
    <div className="relative z-10 w-full max-w-xl">
      <OnboardingWizard
        initial={{
          userId: member.id,
          startStep: member.onboardingStep,
          fullName: member.fullName,
          contactEmail: member.contactEmail ?? "",
          bio: member.bio ?? "",
          avatarUrl: member.avatarUrl ?? null,
          socialLinkedin: member.socialLinkedin ?? "",
          socialInstagram: member.socialInstagram ?? "",
          socialWhatsapp: member.socialWhatsapp ?? "",
          roleFocus: member.roleFocus ?? "",
          timezone: member.timezone ?? "",
          workStyle: member.workStyle ?? "",
          languages: member.languages ?? [],
          headline: member.headline ?? "",
          workLinks: Array.isArray(member.workLinks)
            ? (member.workLinks as { label: string; url: string }[])
            : [],
          skills: Array.isArray(member.skills)
            ? (member.skills as { label: string; level: number }[])
            : [],
        }}
      />
    </div>
  );
}
