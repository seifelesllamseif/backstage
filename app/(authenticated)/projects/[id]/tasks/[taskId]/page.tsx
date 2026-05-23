import { redirect } from "next/navigation";

// Direct-URL access to a task now redirects to the board with the task panel
// pre-opened. See decision 0017 — the standalone /tasks/[taskId] page is
// retired; everything happens in the slide-over.

export default async function TaskRedirectPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  const { id: projectId, taskId } = await params;
  redirect(`/projects/${projectId}?task=${taskId}`);
}
