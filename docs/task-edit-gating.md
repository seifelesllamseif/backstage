# Task edit gating

## Tiers

Two access tiers for task-detail mutations, enforced server-side and mirrored in the client UI.

- **planner** - admin or lead only. Used for fields that drive planning (priority, who works on it, when it is due, what it relates to).
- **owner** - admin, lead, or the task's own assignee. Used for fields the doer needs to update while the task is in flight (status, comments, links, handoff).

A member who is not the task's assignee has full read access and no edit affordance on that task.

## Server gate

`ensureTaskAccess(taskId, 'planner' | 'owner')` in `supabase/dashboard/mutations.ts`. Returns `{ member }` on success or `{ error }` on denial. The client's optimistic UI rolls back on `{ error }` via the existing toast path.

## Mutation -> tier

| Mutation                      | Tier    |
| ----------------------------- | ------- |
| `updateDashboardTaskStatus`   | owner   |
| `updateDashboardTaskPriority` | planner |
| `updateDashboardTaskAssignee` | planner |
| `updateDashboardTaskLead`     | planner |
| `updateDashboardTaskDueDate`  | planner |
| `addTaskDependency`           | planner |
| `removeTaskDependency`        | planner |
| `addComment`                  | owner   |
| `addTaskExternalRef`          | owner   |
| `removeTaskExternalRef`       | owner   |
| `updateTaskExternalRefLabel`  | owner   |
| `submitHandoffForReview`      | owner   |

Sprint scope changes (`addTaskToSprint`, `removeTaskFromSprint`) are a separate planner gate via `requireAccessTier(['admin', 'lead'])`.

Comment edit and delete stay author-scoped (admins can manage any comment, the author can manage their own). They are not in the table above because the gate lives on the comment row, not the task.

## Client mirror

`TaskDetail` and `TaskDetailContent` derive two booleans from the current member's access tier and the task's assignee id:

- `canEditPlanner = accessTier === 'admin' || accessTier === 'lead'`
- `canEditOwner = canEditPlanner || task.assignee?.id === currentUserId`

The matching control gets `disabled` (Popover, RelationPicker) or `readOnly`/`canEdit` (DueDateField, LinksSection, HandoffReadView). The disabled popovers render as plain spans so members see the value but never see a clickable affordance. The comment composer is replaced by a one-line note for members on tasks they do not own.

Components that thread these props:

- `DashboardShell -> TaskDetail` (the slide-over)
- `DashboardShell -> ArchivePanel -> SprintSection -> SprintTasks -> ArchiveRow -> TaskDetailContent` (the expanded archive row)
