'use server'

// Server-action surface for the dashboard. Implementations live in
// supabase/dashboard/* (Supabase JS). This file wraps each one in a
// `'use server'` async export so client components can call them.
//
// Next.js rule: 'use server' files may only export async functions, no
// type exports and no `export { … } from …` re-exports. Types live in
// ./types.

import { fetchDashboardData as fetchDashboardDataImpl } from '@/supabase/dashboard/fetch'
import { fetchInitial as fetchInitialImpl } from './_components/fetchInitial'
import {
  addChecklistItem as addChecklistItemImpl,
  addComment as addCommentImpl,
  addProjectExternalRef as addProjectExternalRefImpl,
  addTaskDependency as addTaskDependencyImpl,
  addTaskExternalRef as addTaskExternalRefImpl,
  addTaskToSprint as addTaskToSprintImpl,
  archiveProjectInPlace as archiveProjectInPlaceImpl,
  createBulkDashboardTasks as createBulkDashboardTasksImpl,
  createDashboardTask as createDashboardTaskImpl,
  createProjectInPlace as createProjectInPlaceImpl,
  createSprint as createSprintImpl,
  deleteComment as deleteCommentImpl,
  deleteDashboardTask as deleteDashboardTaskImpl,
  deleteSprint as deleteSprintImpl,
  duplicateDashboardTask as duplicateDashboardTaskImpl,
  editComment as editCommentImpl,
  fetchTaskHandoff as fetchTaskHandoffImpl,
  moveDashboardTask as moveDashboardTaskImpl,
  removeProjectExternalRef as removeProjectExternalRefImpl,
  removeTaskDependency as removeTaskDependencyImpl,
  removeTaskExternalRef as removeTaskExternalRefImpl,
  removeTaskFromSprint as removeTaskFromSprintImpl,
  renameProject as renameProjectImpl,
  saveHandoffDraft as saveHandoffDraftImpl,
  setProjectGithubRepo as setProjectGithubRepoImpl,
  submitHandoffForReview as submitHandoffForReviewImpl,
  toggleChecklistItem as toggleChecklistItemImpl,
  unarchiveProject as unarchiveProjectImpl,
  addTaskWatcher as addTaskWatcherImpl,
  fetchMemberPortfolio as fetchMemberPortfolioImpl,
  listTaskWatchers as listTaskWatchersImpl,
  removeTaskWatcher as removeTaskWatcherImpl,
  updateMemberActivityStatus as updateMemberActivityStatusImpl,
  savePushSubscription as savePushSubscriptionImpl,
  deletePushSubscription as deletePushSubscriptionImpl,
  fetchPushPublicKey as fetchPushPublicKeyImpl,
  updateDashboardTaskAssignee as updateDashboardTaskAssigneeImpl,
  updateDashboardTaskDetails as updateDashboardTaskDetailsImpl,
  updateDashboardTaskLead as updateDashboardTaskLeadImpl,
  updateDashboardTaskPriority as updateDashboardTaskPriorityImpl,
  updateDashboardTaskDueDate as updateDashboardTaskDueDateImpl,
  updateDashboardTaskStatus as updateDashboardTaskStatusImpl,
  updateProjectExternalRefLabel as updateProjectExternalRefLabelImpl,
  updateSprint as updateSprintImpl,
  updateTaskExternalRefLabel as updateTaskExternalRefLabelImpl,
} from '@/supabase/dashboard/mutations'

export async function fetchDashboardData(
  ...args: Parameters<typeof fetchDashboardDataImpl>
) {
  return fetchDashboardDataImpl(...args)
}

// Client-callable wrapper around fetchInitial. The shell mounts client-side
// and uses React Query to fetch + cache this, so tab navigation hits the
// cache (no skeleton flash) and only project switches refetch.
export async function fetchInitial(
  ...args: Parameters<typeof fetchInitialImpl>
) {
  return fetchInitialImpl(...args)
}

export async function createDashboardTask(
  ...args: Parameters<typeof createDashboardTaskImpl>
) {
  return createDashboardTaskImpl(...args)
}

export async function addTaskDependency(
  ...args: Parameters<typeof addTaskDependencyImpl>
) {
  return addTaskDependencyImpl(...args)
}

export async function removeTaskDependency(
  ...args: Parameters<typeof removeTaskDependencyImpl>
) {
  return removeTaskDependencyImpl(...args)
}

export async function createBulkDashboardTasks(
  ...args: Parameters<typeof createBulkDashboardTasksImpl>
) {
  return createBulkDashboardTasksImpl(...args)
}

export async function updateDashboardTaskStatus(
  ...args: Parameters<typeof updateDashboardTaskStatusImpl>
) {
  return updateDashboardTaskStatusImpl(...args)
}

export async function updateDashboardTaskPriority(
  ...args: Parameters<typeof updateDashboardTaskPriorityImpl>
) {
  return updateDashboardTaskPriorityImpl(...args)
}

export async function updateDashboardTaskAssignee(
  ...args: Parameters<typeof updateDashboardTaskAssigneeImpl>
) {
  return updateDashboardTaskAssigneeImpl(...args)
}

export async function updateDashboardTaskLead(
  ...args: Parameters<typeof updateDashboardTaskLeadImpl>
) {
  return updateDashboardTaskLeadImpl(...args)
}

export async function updateDashboardTaskDetails(
  ...args: Parameters<typeof updateDashboardTaskDetailsImpl>
) {
  return updateDashboardTaskDetailsImpl(...args)
}

export async function updateDashboardTaskDueDate(
  ...args: Parameters<typeof updateDashboardTaskDueDateImpl>
) {
  return updateDashboardTaskDueDateImpl(...args)
}

export async function moveDashboardTask(
  ...args: Parameters<typeof moveDashboardTaskImpl>
) {
  return moveDashboardTaskImpl(...args)
}

export async function deleteDashboardTask(
  ...args: Parameters<typeof deleteDashboardTaskImpl>
) {
  return deleteDashboardTaskImpl(...args)
}

export async function duplicateDashboardTask(
  ...args: Parameters<typeof duplicateDashboardTaskImpl>
) {
  return duplicateDashboardTaskImpl(...args)
}

export async function addComment(
  ...args: Parameters<typeof addCommentImpl>
) {
  return addCommentImpl(...args)
}

export async function editComment(
  ...args: Parameters<typeof editCommentImpl>
) {
  return editCommentImpl(...args)
}

export async function deleteComment(
  ...args: Parameters<typeof deleteCommentImpl>
) {
  return deleteCommentImpl(...args)
}

export async function toggleChecklistItem(
  ...args: Parameters<typeof toggleChecklistItemImpl>
) {
  return toggleChecklistItemImpl(...args)
}

export async function addChecklistItem(
  ...args: Parameters<typeof addChecklistItemImpl>
) {
  return addChecklistItemImpl(...args)
}

export async function createSprint(
  ...args: Parameters<typeof createSprintImpl>
) {
  return createSprintImpl(...args)
}

export async function updateSprint(
  ...args: Parameters<typeof updateSprintImpl>
) {
  return updateSprintImpl(...args)
}

export async function deleteSprint(
  ...args: Parameters<typeof deleteSprintImpl>
) {
  return deleteSprintImpl(...args)
}

export async function addTaskToSprint(
  ...args: Parameters<typeof addTaskToSprintImpl>
) {
  return addTaskToSprintImpl(...args)
}

export async function removeTaskFromSprint(
  ...args: Parameters<typeof removeTaskFromSprintImpl>
) {
  return removeTaskFromSprintImpl(...args)
}

export async function setProjectGithubRepo(
  ...args: Parameters<typeof setProjectGithubRepoImpl>
) {
  return setProjectGithubRepoImpl(...args)
}

export async function addTaskExternalRef(
  ...args: Parameters<typeof addTaskExternalRefImpl>
) {
  return addTaskExternalRefImpl(...args)
}

export async function removeTaskExternalRef(
  ...args: Parameters<typeof removeTaskExternalRefImpl>
) {
  return removeTaskExternalRefImpl(...args)
}

export async function addProjectExternalRef(
  ...args: Parameters<typeof addProjectExternalRefImpl>
) {
  return addProjectExternalRefImpl(...args)
}

export async function removeProjectExternalRef(
  ...args: Parameters<typeof removeProjectExternalRefImpl>
) {
  return removeProjectExternalRefImpl(...args)
}

export async function updateProjectExternalRefLabel(
  ...args: Parameters<typeof updateProjectExternalRefLabelImpl>
) {
  return updateProjectExternalRefLabelImpl(...args)
}

export async function updateTaskExternalRefLabel(
  ...args: Parameters<typeof updateTaskExternalRefLabelImpl>
) {
  return updateTaskExternalRefLabelImpl(...args)
}

export async function fetchTaskHandoff(
  ...args: Parameters<typeof fetchTaskHandoffImpl>
) {
  return fetchTaskHandoffImpl(...args)
}

export async function submitHandoffForReview(
  ...args: Parameters<typeof submitHandoffForReviewImpl>
) {
  return submitHandoffForReviewImpl(...args)
}

export async function saveHandoffDraft(
  ...args: Parameters<typeof saveHandoffDraftImpl>
) {
  return saveHandoffDraftImpl(...args)
}

export async function createProjectInPlace(
  ...args: Parameters<typeof createProjectInPlaceImpl>
) {
  return createProjectInPlaceImpl(...args)
}

export async function archiveProjectInPlace(
  ...args: Parameters<typeof archiveProjectInPlaceImpl>
) {
  return archiveProjectInPlaceImpl(...args)
}

export async function unarchiveProject(
  ...args: Parameters<typeof unarchiveProjectImpl>
) {
  return unarchiveProjectImpl(...args)
}

export async function renameProject(
  ...args: Parameters<typeof renameProjectImpl>
) {
  return renameProjectImpl(...args)
}

export async function fetchMemberPortfolio(
  ...args: Parameters<typeof fetchMemberPortfolioImpl>
) {
  return fetchMemberPortfolioImpl(...args)
}

export async function addTaskWatcher(
  ...args: Parameters<typeof addTaskWatcherImpl>
) {
  return addTaskWatcherImpl(...args)
}

export async function removeTaskWatcher(
  ...args: Parameters<typeof removeTaskWatcherImpl>
) {
  return removeTaskWatcherImpl(...args)
}

export async function listTaskWatchers(
  ...args: Parameters<typeof listTaskWatchersImpl>
) {
  return listTaskWatchersImpl(...args)
}

export async function updateMemberActivityStatus(
  ...args: Parameters<typeof updateMemberActivityStatusImpl>
) {
  return updateMemberActivityStatusImpl(...args)
}

export async function savePushSubscription(
  ...args: Parameters<typeof savePushSubscriptionImpl>
) {
  return savePushSubscriptionImpl(...args)
}

export async function deletePushSubscription(
  ...args: Parameters<typeof deletePushSubscriptionImpl>
) {
  return deletePushSubscriptionImpl(...args)
}

export async function fetchPushPublicKey(
  ...args: Parameters<typeof fetchPushPublicKeyImpl>
) {
  return fetchPushPublicKeyImpl(...args)
}
