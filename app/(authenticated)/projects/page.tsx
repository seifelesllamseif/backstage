import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentCrewMember } from "@/lib/dal";
import { CreateProjectForm } from "./create-project-form";

// Slice-1 step 3. Lists non-archived projects for the current user's company.
// Create form is admin/lead-only — see decision 0011.

export default async function ProjectsPage() {
  const member = await getCurrentCrewMember();
  if (!member) {
    // verifySession in the layout already redirects on no-claims, but defend
    // against the rare orphan case where claims exist without a crew_member.
    throw new Error("No crew_member row for the current auth user.");
  }

  const canCreate = member.accessTier === "admin" || member.accessTier === "lead";

  const projects = await prisma.project.findMany({
    where: { companyId: member.companyId, isArchived: false },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-medium">Projects</h1>
        <Link
          href="/cockpit"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Cockpit
        </Link>
      </header>

      {canCreate && <CreateProjectForm />}

      {projects.length === 0 ? (
        <p className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
          No projects yet.
          {canCreate ? " Use the form above to create the first one." : null}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/projects/${project.id}`}
                className="flex items-center justify-between rounded-md border border-border bg-card p-3 hover:bg-muted"
              >
                <span className="text-sm font-medium">{project.name}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {project.kind}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
