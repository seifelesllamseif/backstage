import 'server-only'

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/server'
import { getCurrentTeamMember } from '@/lib/dal'
import { createAdminClient } from '@/supabase/admin'
import { fetchDashboardData } from '@/supabase/dashboard/fetch'
import type { DashboardTaskRow } from '@/supabase/dashboard/fetch'
import * as m from '@/supabase/dashboard/mutations'
import { listTeamRoster, updateMyTimezone } from '@/supabase/dashboard/team'
import {
  getMyEmailPrefs,
  updateMyEmailPrefs
} from '@/supabase/dashboard/emailPrefs'

// Tools deliberately add no new data access. Each resolves the caller through
// getCurrentTeamMember(), which the route boundary has already pinned to a
// verified (user, workspace) pair — so every existing tier check and
// company_id filter applies unchanged, and an agent can never exceed what its
// member can do in the UI.
//
// Tools are consolidated by entity + verb rather than mirroring all 111
// dashboard functions one-to-one: large tool counts measurably degrade a
// model's tool selection and cost context on every single request.

const Status = z.enum([
  'backlog',
  'unscoped',
  'todo',
  'in_progress',
  'in_review',
  'done',
  'canceled',
  'duplicate'
])
const Priority = z.enum(['urgent', 'high', 'medium', 'low', 'none'])
const RelationKind = z.enum([
  'blocked_by',
  'blocks',
  'parent',
  'sub_issue',
  'triage'
])
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')
const Uuid = z.string().uuid()

async function requireMember() {
  const member = await getCurrentTeamMember()
  // Unreachable via the route (the boundary checks membership first), but a
  // tool must never run unscoped if that ever changes.
  if (!member) throw new Error('Not a member of this workspace.')
  return member
}

// The mutations enforce their own tier, but they do it with requireAccessTier,
// which redirect()s - a Next control-flow throw that reaches an MCP client as
// an opaque NEXT_REDIRECT digest rather than a reason. Check first so the
// model is told what it lacks and stops retrying.
function requireTier(
  member: { accessTier: string },
  allowed: readonly string[]
) {
  if (!allowed.includes(member.accessTier)) {
    throw new Error(
      `Requires ${allowed.join(' or ')} access; this connection is ${member.accessTier}.`
    )
  }
}
const STAFF = ['admin', 'lead'] as const

// MCP returns text content; JSON is what models parse most reliably.
function json(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value) }]
  }
}

// Mutations return { error } | { ok } rather than throwing. Surface the error
// as a tool error so the model sees the reason instead of a silent no-op.
function unwrap<T>(result: T): T {
  if (result && typeof result === 'object' && 'error' in result) {
    throw new Error(String((result as { error: unknown }).error))
  }
  return result
}

// Tasks carry a lot of joined data. Trim to what a model needs to reason,
// otherwise a 40-task result blows the context window.
function slim(t: DashboardTaskRow) {
  return {
    id: t.id,
    ref: t.ref,
    title: t.title,
    status: t.status,
    priority: t.priority,
    projectId: t.projectId,
    project: t.project?.name ?? null,
    assignee: t.assignee
      ? { id: t.assignee.id, name: t.assignee.fullName }
      : null,
    dueDate: t.dueDate,
    updatedAt: t.updatedAt
  }
}

export function registerTools(server: McpServer) {
  const read = { readOnlyHint: true }
  const destructive = { destructiveHint: true }

  // ─── Identity & workspace ───────────────────────────────────────────────

  server.registerTool(
    'whoami',
    {
      title: 'Who am I',
      description:
        'The member this connection acts as, including which workspace and access tier. Call first to confirm the right workspace.',
      inputSchema: z.object({}),
      annotations: read
    },
    async () => {
      const me = await requireMember()
      return json({
        memberId: me.id,
        fullName: me.fullName,
        email: me.email,
        accessTier: me.accessTier,
        workspaceId: me.companyId,
        activityStatus: me.activityStatus,
        timezone: me.timezone
      })
    }
  )

  server.registerTool(
    'get_workspace',
    {
      title: 'Get workspace',
      description:
        'Name, enabled features, projects, sprints and labels of the workspace this connection is ' +
        'scoped to. This is where every id you need comes from - project ids for create_task, sprint ' +
        'ids, label ids. Call it before your first write instead of guessing an id or inventing a ' +
        'project name; ids are UUIDs and cannot be derived from a name.',
      inputSchema: z.object({}),
      annotations: read
    },
    async () => {
      const me = await requireMember()
      const [{ data: company }, d] = await Promise.all([
        createAdminClient()
          .from('companies')
          .select('id, name, enabled_features')
          .eq('id', me.companyId)
          .maybeSingle(),
        fetchDashboardData()
      ])
      return json({
        id: me.companyId,
        name: company?.name ?? null,
        enabledFeatures: company?.enabled_features ?? [],
        // d.projects, not d.allActiveProjects: the latter is fetch.ts's
        // deliberately unscoped list, so returning it here handed every
        // member every project name in the workspace while the dashboard's
        // own list stayed scoped. Same active-only shape as before.
        projects: d.projects
          .filter((p) => !p.isArchived)
          .map((p) => ({ id: p.id, name: p.name })),
        sprints: d.sprints,
        labels: d.labels
      })
    }
  )

  // ─── Reading tasks ──────────────────────────────────────────────────────

  server.registerTool(
    'search_tasks',
    {
      title: 'Search tasks',
      description:
        'Find tasks by text, status, priority, assignee, project, or due date. Omit every filter to ' +
        'list all open work. Search before creating: the task you are about to file often already ' +
        'exists, and duplicates are expensive for the team to untangle. Returns a trimmed row - call ' +
        'get_task for description, checklist, comments and links.',
      inputSchema: z.object({
        query: z.string().optional().describe('Matches title and ref'),
        status: z.array(Status).optional(),
        priority: z.array(Priority).optional(),
        assigneeId: Uuid.optional(),
        projectId: Uuid.optional(),
        mine: z.boolean().optional().describe('Only tasks assigned to me'),
        dueBefore: IsoDate.optional(),
        limit: z.number().int().min(1).max(200).optional()
      }),
      annotations: read
    },
    async (args) => {
      const me = await requireMember()
      // Filtering in memory rather than adding a query path: fetchDashboardData
      // is the same read the UI uses, so results can never diverge from what
      // the member sees on the board.
      const d = await fetchDashboardData(args.projectId)
      const q = args.query?.trim().toLowerCase()
      const rows = d.tasks.filter((t) => {
        if (q && !`${t.title} ${t.ref ?? ''}`.toLowerCase().includes(q)) {
          return false
        }
        if (args.status?.length && !args.status.includes(t.status)) return false
        if (args.priority?.length && !args.priority.includes(t.priority)) {
          return false
        }
        if (args.assigneeId && t.assigneeId !== args.assigneeId) return false
        if (args.mine && t.assigneeId !== me.id) return false
        if (args.dueBefore && !(t.dueDate && t.dueDate <= args.dueBefore)) {
          return false
        }
        return true
      })
      return json({
        total: rows.length,
        tasks: rows.slice(0, args.limit ?? 50).map(slim)
      })
    }
  )

  server.registerTool(
    'get_task',
    {
      title: 'Get task',
      description:
        'Full detail for one task: description, checklist, labels, dependencies, sprint membership, ' +
        'comments, and the links attached to it. Read this before you answer anything specific about ' +
        'a task or edit it - the trimmed row from search_tasks is not enough to judge what is already ' +
        'done or already linked. Takes the UUID or the human ref (WEB-12).',
      inputSchema: z.object({
        taskId: Uuid.optional(),
        ref: z.string().optional().describe('Human ref such as WEB-12')
      }),
      annotations: read
    },
    async (args) => {
      await requireMember()
      if (!args.taskId && !args.ref) {
        throw new Error('Provide taskId or ref.')
      }
      const d = await fetchDashboardData()
      const task = d.tasks.find((t) =>
        args.taskId ? t.id === args.taskId : t.ref === args.ref
      )
      if (!task) throw new Error('Task not found.')
      return json({
        ...task,
        comments: d.comments.filter((c) => c.taskId === task.id),
        // Links were the one thing on the card a model could not see: it
        // would answer "no design attached" while a Figma chip sat on the
        // task. Same shape manage_links returns.
        links: d.externalRefs.filter((r) => r.taskId === task.id)
      })
    }
  )

  server.registerTool(
    'list_trash',
    {
      title: 'List trashed tasks',
      description:
        'Soft-deleted tasks that can still be restored. Leads and admins only.',
      inputSchema: z.object({}),
      annotations: read
    },
    async () => {
      requireTier(await requireMember(), STAFF)
      return json(unwrap(await m.listTrashedTasks()))
    }
  )

  // ─── Writing tasks ──────────────────────────────────────────────────────

  server.registerTool(
    'create_task',
    {
      title: 'Create task',
      description:
        'Create a single task in a project. Fill in every field the request actually implies - ' +
        'assigneeId, priority and dueDate especially. A title-only task lands on the board with no ' +
        'owner and no date, and a human has to chase down what you already knew. If the request does ' +
        'not say who or when, leave those out rather than inventing them, but do not skip a detail ' +
        'that was stated. Put the one-line summary in title and the context, links and acceptance ' +
        'criteria in description. Creating more than one task? Use create_tasks_bulk instead.',
      inputSchema: z.object({
        title: z
          .string()
          .min(1)
          .max(280)
          .describe('One line, imperative: "Fix the checkout redirect"'),
        projectId: Uuid.describe('From get_workspace'),
        description: z
          .string()
          .nullish()
          .describe('Markdown. Context, acceptance criteria, links.'),
        status: Status.optional().describe('Defaults to the backlog'),
        priority: Priority.optional(),
        assigneeId: Uuid.nullish().describe('Member id from list_team'),
        leadId: Uuid.nullish().describe('Reviewer / owner, from list_team'),
        dueDate: IsoDate.nullish(),
        labelIds: z.array(Uuid).optional().describe('From get_workspace')
      })
    },
    async (args) => {
      await requireMember()
      return json(unwrap(await m.createDashboardTask(args)))
    }
  )

  server.registerTool(
    'create_tasks_bulk',
    {
      title: 'Create several tasks',
      description:
        'Create many tasks in one project at once - always prefer this over repeated create_task, ' +
        'it is one write and one activity entry instead of N. The same rule applies per task: set ' +
        'priority, assignee and dueDate where the request implies them rather than filing a wall of ' +
        'bare titles. newLabelNames creates labels that do not exist yet, so you do not need label ' +
        'ids up front.',
      inputSchema: z.object({
        projectId: Uuid,
        tasks: z
          .array(
            z.object({
              title: z.string().min(1).max(500),
              description: z.string().nullish(),
              status: Status.optional(),
              priority: Priority.optional(),
              assigneeId: Uuid.nullish(),
              dueDate: IsoDate.nullish(),
              newLabelNames: z.array(z.string().min(1).max(64)).optional()
            })
          )
          .min(1)
          .max(100)
      })
    },
    async (args) => {
      await requireMember()
      return json(
        unwrap(await m.createBulkDashboardTasks(args.projectId, args.tasks))
      )
    }
  )

  server.registerTool(
    'update_task',
    {
      title: 'Update task',
      description:
        "Change any combination of a task's fields. Only the fields you pass are touched, so send " +
        'just what changes - never re-send the whole task. Pass null to clear assignee, lead or due ' +
        'date. Read the task first if you are editing description or status off the back of a ' +
        'conversation; overwriting a description someone else wrote is not recoverable from here.',
      inputSchema: z.object({
        taskId: Uuid,
        title: z.string().min(1).max(500).optional(),
        description: z.string().max(5000).nullish(),
        status: Status.optional(),
        priority: Priority.optional(),
        assigneeId: Uuid.nullish(),
        leadId: Uuid.nullish(),
        projectId: Uuid.optional(),
        dueDate: IsoDate.nullish(),
        tags: z.array(z.string()).optional()
      })
    },
    async (args) => {
      await requireMember()
      const { taskId } = args
      const applied: string[] = []
      // Sequential, not parallel: each mutation logs activity and several
      // read the row they are about to change.
      if (args.title !== undefined || args.description !== undefined) {
        unwrap(
          await m.updateDashboardTaskDetails({
            taskId,
            title: args.title,
            description: args.description
          })
        )
        applied.push('details')
      }
      if (args.status !== undefined) {
        unwrap(await m.updateDashboardTaskStatus(taskId, args.status))
        applied.push('status')
      }
      if (args.priority !== undefined) {
        unwrap(await m.updateDashboardTaskPriority(taskId, args.priority))
        applied.push('priority')
      }
      if (args.assigneeId !== undefined) {
        unwrap(
          await m.updateDashboardTaskAssignee(taskId, args.assigneeId ?? null)
        )
        applied.push('assignee')
      }
      if (args.leadId !== undefined) {
        unwrap(await m.updateDashboardTaskLead(taskId, args.leadId ?? null))
        applied.push('lead')
      }
      if (args.projectId !== undefined) {
        unwrap(await m.updateDashboardTaskProject(taskId, args.projectId))
        applied.push('project')
      }
      if (args.dueDate !== undefined) {
        unwrap(await m.updateDashboardTaskDueDate(taskId, args.dueDate ?? null))
        applied.push('dueDate')
      }
      if (args.tags !== undefined) {
        unwrap(await m.updateTaskTags(taskId, args.tags))
        applied.push('tags')
      }
      if (applied.length === 0) throw new Error('Nothing to update.')
      return json({ ok: true, updated: applied })
    }
  )

  server.registerTool(
    'move_task',
    {
      title: 'Move task on the board',
      description: "Set a task's status and its position within that column.",
      inputSchema: z.object({
        taskId: Uuid,
        status: Status,
        index: z.number().int().min(0)
      })
    },
    async (args) => {
      await requireMember()
      return json(
        unwrap(await m.moveDashboardTask(args.taskId, args.status, args.index))
      )
    }
  )

  server.registerTool(
    'delete_task',
    {
      title: 'Delete task',
      description:
        'Soft-delete a task. It moves to trash and can be restored with restore_task. Leads and admins only.',
      inputSchema: z.object({ taskId: Uuid }),
      annotations: destructive
    },
    async (args) => {
      requireTier(await requireMember(), STAFF)
      return json(unwrap(await m.deleteDashboardTask(args.taskId)))
    }
  )

  server.registerTool(
    'restore_task',
    {
      title: 'Restore task',
      description: 'Bring a soft-deleted task back from trash.',
      inputSchema: z.object({ taskId: Uuid })
    },
    async (args) => {
      await requireMember()
      return json(unwrap(await m.restoreDashboardTask(args.taskId)))
    }
  )

  server.registerTool(
    'duplicate_task',
    {
      title: 'Duplicate task',
      description: 'Copy a task, including its labels and checklist.',
      inputSchema: z.object({ taskId: Uuid })
    },
    async (args) => {
      await requireMember()
      return json(unwrap(await m.duplicateDashboardTask(args.taskId)))
    }
  )

  // ─── Relations, checklist, comments, watchers, reactions ────────────────

  server.registerTool(
    'manage_dependency',
    {
      title: 'Add or remove a task dependency',
      description:
        'Link tasks by ref. Kinds: blocked_by, blocks, parent, sub_issue, triage.',
      inputSchema: z.object({
        action: z.enum(['add', 'remove']),
        taskId: Uuid,
        dependsOnRef: z.string().min(1).max(64),
        kind: RelationKind
      })
    },
    async ({ action, ...rest }) => {
      await requireMember()
      return json(
        unwrap(
          action === 'add'
            ? await m.addTaskDependency(rest)
            : await m.removeTaskDependency(rest)
        )
      )
    }
  )

  server.registerTool(
    'manage_checklist',
    {
      title: 'Manage a task checklist',
      description: 'Add a checklist item, or tick/untick an existing one.',
      inputSchema: z.object({
        action: z.enum(['add', 'set']),
        taskId: Uuid.optional().describe('Required for add'),
        text: z.string().min(1).optional().describe('Required for add'),
        itemId: Uuid.optional().describe('Required for set'),
        isDone: z.boolean().optional().describe('Required for set')
      })
    },
    async (args) => {
      await requireMember()
      if (args.action === 'add') {
        if (!args.taskId || !args.text) {
          throw new Error('add requires taskId and text.')
        }
        return json(unwrap(await m.addChecklistItem(args.taskId, args.text)))
      }
      if (!args.itemId || args.isDone === undefined) {
        throw new Error('set requires itemId and isDone.')
      }
      return json(unwrap(await m.toggleChecklistItem(args.itemId, args.isDone)))
    }
  )

  server.registerTool(
    'comment_on_task',
    {
      title: 'Comment on a task',
      description:
        'Post a comment. Mention teammates by passing their member ids in `mentions` - a mention is ' +
        'what actually notifies them, writing "@sara" in the body does nothing. Comments are visible ' +
        'to the whole team and attributed to the member this connection acts as, so write as them.',
      inputSchema: z.object({
        taskId: Uuid,
        body: z.string().min(1).describe('Markdown'),
        mentions: z
          .array(Uuid)
          .optional()
          .describe('Member ids to notify, from list_team')
      })
    },
    async (args) => {
      await requireMember()
      return json(
        unwrap(await m.addComment(args.taskId, args.body, args.mentions))
      )
    }
  )

  server.registerTool(
    'manage_comment',
    {
      title: 'Edit or delete a comment',
      description: 'You can always act on your own comments; admins on any.',
      inputSchema: z.object({
        action: z.enum(['edit', 'delete']),
        commentId: Uuid,
        body: z.string().min(1).optional().describe('Required for edit')
      }),
      annotations: destructive
    },
    async (args) => {
      await requireMember()
      if (args.action === 'edit') {
        if (!args.body) throw new Error('edit requires body.')
        return json(unwrap(await m.editComment(args.commentId, args.body)))
      }
      return json(unwrap(await m.deleteComment(args.commentId)))
    }
  )

  server.registerTool(
    'manage_project_members',
    {
      title: 'Manage project members',
      description:
        'List, add, or remove the members on a project. Being on a project is what lets a member see it and its tasks; admins and leads see every project regardless. Adding and removing require admin or lead. Removing only drops the explicit grant — someone still holding a task in the project keeps the narrower access that gives them.',
      inputSchema: z.object({
        action: z.enum(['list', 'add', 'remove']),
        projectId: Uuid,
        memberId: Uuid.optional().describe('Required for add and remove')
      })
    },
    async (args) => {
      const me = await requireMember()
      if (args.action === 'list') {
        return json(unwrap(await m.listProjectMembers(args.projectId)))
      }
      requireTier(me, STAFF)
      if (!args.memberId) throw new Error(`${args.action} requires memberId.`)
      const input = { projectId: args.projectId, memberId: args.memberId }
      return json(
        unwrap(
          args.action === 'add'
            ? await m.addProjectMember(input)
            : await m.removeProjectMember(input)
        )
      )
    }
  )

  server.registerTool(
    'manage_project',
    {
      title: 'Manage projects',
      description:
        'Create, rename, archive, unarchive a project, or point it at a GitHub repo. ' +
        'Projects are the containers every task and sprint lives in, so create one here ' +
        'before creating tasks for work that has no home yet - do not stuff unrelated work ' +
        'into an existing project. Create returns the new project id, ready to pass to ' +
        'create_task. Archiving hides a project and its tasks from the board without ' +
        'deleting anything; there is deliberately no hard delete. Admin or lead only. ' +
        'Use manage_project_members to control who can see a project.',
      inputSchema: z.object({
        action: z.enum([
          'create',
          'rename',
          'archive',
          'unarchive',
          'set_github_repo'
        ]),
        projectId: Uuid.optional().describe(
          'Required for everything except create. Get it from get_workspace.'
        ),
        name: z
          .string()
          .trim()
          .min(2)
          .max(80)
          .optional()
          .describe('Required for create and rename'),
        kind: z
          .enum(['standard', 'operations'])
          .optional()
          .describe(
            "For create. 'operations' is for continuous ops work rather than a delivery project; defaults to standard."
          ),
        githubRepo: z
          .string()
          .trim()
          .nullish()
          .describe('owner/repo, for set_github_repo. Pass null to unlink.')
      })
    },
    async (args) => {
      const me = await requireMember()
      requireTier(me, STAFF)

      if (args.action === 'create') {
        if (!args.name) throw new Error('create requires name.')
        const form = new FormData()
        form.set('name', args.name)
        form.set('kind', args.kind ?? 'standard')
        unwrap(await m.createProjectInPlace(form))
        // createProjectInPlace returns nothing on success, and a model that
        // just made a project immediately needs its id to file tasks into it.
        // Name is unique per company (that is what the 23505 branch above is
        // about), so this reads back exactly the row we inserted.
        const { data: project } = await createAdminClient()
          .from('projects')
          .select('id, name, kind, is_archived')
          .eq('company_id', me.companyId)
          .eq('name', args.name)
          .maybeSingle()
        return json({ ok: true, project })
      }

      if (!args.projectId) {
        throw new Error(`${args.action} requires projectId.`)
      }

      if (args.action === 'rename') {
        if (!args.name) throw new Error('rename requires name.')
        const form = new FormData()
        form.set('projectId', args.projectId)
        form.set('name', args.name)
        return json(unwrap(await m.renameProject(form)) ?? { ok: true })
      }

      if (args.action === 'set_github_repo') {
        return json(
          unwrap(
            await m.setProjectGithubRepo({
              projectId: args.projectId,
              githubRepo: args.githubRepo ?? ''
            })
          )
        )
      }

      const form = new FormData()
      form.set('projectId', args.projectId)
      return json(
        unwrap(
          args.action === 'archive'
            ? await m.archiveProjectInPlace(form)
            : await m.unarchiveProject(form)
        ) ?? { ok: true }
      )
    }
  )

  server.registerTool(
    'manage_links',
    {
      title: 'Manage links',
      description:
        'The links attached to a task or a project - the same "+ Link" chips a member sees in the UI: ' +
        'a Figma file, a PR, a Google Doc, a spec. Read them with list (or get_task, which returns ' +
        'them inline) BEFORE answering a question about where something lives, and attach one with ' +
        'add whenever the conversation produces a URL worth keeping: a link left only in chat is lost ' +
        'to everyone else. Pass a label when the URL is not self-describing; without one the title is ' +
        'fetched from the page. remove and relabel take the refId from list - you do not need to say ' +
        'whether it is a task or project link, it is resolved from the id.',
      inputSchema: z.object({
        action: z.enum(['list', 'add', 'remove', 'relabel']),
        taskId: Uuid.optional().describe('For task links, on list and add'),
        projectId: Uuid.optional().describe(
          'For project links, on list and add'
        ),
        url: z.string().url().max(2048).optional().describe('Required for add'),
        label: z
          .string()
          .trim()
          .max(120)
          .nullish()
          .describe('Display text. Pass null on relabel to clear it.'),
        refId: Uuid.optional().describe('Required for remove and relabel')
      })
    },
    async (args) => {
      await requireMember()

      if (args.action === 'list') {
        const d = await fetchDashboardData()
        if (args.taskId) {
          return json(d.externalRefs.filter((r) => r.taskId === args.taskId))
        }
        if (args.projectId) {
          return json(
            d.projectExternalRefs.filter((r) => r.projectId === args.projectId)
          )
        }
        return json({
          taskLinks: d.externalRefs,
          projectLinks: d.projectExternalRefs
        })
      }

      if (args.action === 'add') {
        if (!args.url) throw new Error('add requires url.')
        if (args.taskId) {
          return json(
            unwrap(
              await m.addTaskExternalRef({
                taskId: args.taskId,
                url: args.url,
                label: args.label ?? null
              })
            )
          )
        }
        if (args.projectId) {
          return json(
            unwrap(
              await m.addProjectExternalRef({
                projectId: args.projectId,
                url: args.url,
                label: args.label ?? null
              })
            )
          )
        }
        throw new Error('add requires taskId or projectId.')
      }

      if (!args.refId) throw new Error(`${args.action} requires refId.`)
      // Which table the ref lives in is knowable, so don't make the model
      // declare it - and don't let it guess wrong and get "Ref not found".
      const d = await fetchDashboardData()
      const onTask = d.externalRefs.some((r) => r.id === args.refId)
      const onProject = d.projectExternalRefs.some((r) => r.id === args.refId)
      if (!onTask && !onProject) throw new Error('Link not found.')

      if (args.action === 'remove') {
        return json(
          unwrap(
            onTask
              ? await m.removeTaskExternalRef(args.refId)
              : await m.removeProjectExternalRef(args.refId)
          )
        )
      }
      const input = { refId: args.refId, label: args.label ?? null }
      return json(
        unwrap(
          onTask
            ? await m.updateTaskExternalRefLabel(input)
            : await m.updateProjectExternalRefLabel(input)
        )
      )
    }
  )

  server.registerTool(
    'manage_watchers',
    {
      title: 'Manage task watchers',
      description: 'List, add, or remove the members watching a task.',
      inputSchema: z.object({
        action: z.enum(['list', 'add', 'remove']),
        taskId: Uuid,
        memberId: Uuid.optional().describe('Required for add and remove')
      })
    },
    async (args) => {
      await requireMember()
      if (args.action === 'list') {
        return json(unwrap(await m.listTaskWatchers(args.taskId)))
      }
      if (!args.memberId) throw new Error(`${args.action} requires memberId.`)
      const input = { taskId: args.taskId, memberId: args.memberId }
      return json(
        unwrap(
          args.action === 'add'
            ? await m.addTaskWatcher(input)
            : await m.removeTaskWatcher(input)
        )
      )
    }
  )

  server.registerTool(
    'toggle_reaction',
    {
      title: 'React to a task or comment',
      description: 'Toggle an emoji reaction. Reacting again removes it.',
      inputSchema: z.object({
        emoji: z.string().min(1).max(32),
        taskId: Uuid.optional(),
        commentId: Uuid.optional()
      })
    },
    async (args) => {
      await requireMember()
      if (args.commentId) {
        return json(
          unwrap(
            await m.toggleCommentReaction({
              commentId: args.commentId,
              emoji: args.emoji
            })
          )
        )
      }
      if (!args.taskId) throw new Error('Provide taskId or commentId.')
      return json(
        unwrap(
          await m.toggleTaskReaction({ taskId: args.taskId, emoji: args.emoji })
        )
      )
    }
  )

  // ─── Sprints ────────────────────────────────────────────────────────────

  server.registerTool(
    'create_sprint',
    {
      title: 'Create sprint',
      description: 'Create a sprint in a project. Leads and admins only.',
      inputSchema: z.object({
        projectId: Uuid,
        name: z.string().min(2).max(80),
        fromDate: IsoDate,
        toDate: IsoDate,
        goal: z.string().max(200).nullish(),
        description: z.string().max(1000).nullish(),
        docUrl: z.string().url().max(500).nullish()
      })
    },
    async (args) => {
      requireTier(await requireMember(), STAFF)
      return json(unwrap(await m.createSprint(args)))
    }
  )

  server.registerTool(
    'update_sprint',
    {
      title: 'Update sprint',
      description: "Change a sprint's name, goal, description, or dates.",
      inputSchema: z.object({
        sprintId: Uuid,
        name: z.string().min(2).max(80).optional(),
        goal: z.string().max(200).nullish(),
        description: z.string().max(1000).nullish(),
        docUrl: z.string().url().max(500).nullish(),
        fromDate: IsoDate.optional(),
        toDate: IsoDate.optional()
      })
    },
    async (args) => {
      await requireMember()
      return json(unwrap(await m.updateSprint(args)))
    }
  )

  server.registerTool(
    'manage_sprint',
    {
      title: 'Start, end, or delete a sprint',
      description:
        'Sprint lifecycle. Starting a sprint moves any current sprint in that project back to upcoming. Leads and admins only.',
      inputSchema: z.object({
        action: z.enum(['start', 'end', 'delete']),
        sprintId: Uuid,
        goalMet: z.boolean().optional().describe('Optional, for end')
      }),
      annotations: destructive
    },
    async (args) => {
      requireTier(await requireMember(), STAFF)
      if (args.action === 'start') {
        return json(unwrap(await m.startSprint(args.sprintId)))
      }
      if (args.action === 'end') {
        return json(
          unwrap(
            await m.endSprint({
              sprintId: args.sprintId,
              goalMet: args.goalMet
            })
          )
        )
      }
      return json(unwrap(await m.deleteSprint(args.sprintId)))
    }
  )

  server.registerTool(
    'manage_sprint_tasks',
    {
      title: 'Add or remove tasks from a sprint',
      description:
        'Move tasks in or out of a sprint. Use bulk with targetSprintId null to pull tasks out of every sprint.',
      inputSchema: z.object({
        action: z.enum(['add', 'remove', 'bulk']),
        sprintId: Uuid.optional().describe('Required for add and remove'),
        taskId: Uuid.optional().describe('Required for add and remove'),
        taskIds: z.array(Uuid).min(1).max(100).optional(),
        targetProjectId: Uuid.optional(),
        targetSprintId: Uuid.nullish()
      })
    },
    async (args) => {
      await requireMember()
      if (args.action === 'bulk') {
        if (!args.taskIds || !args.targetProjectId) {
          throw new Error('bulk requires taskIds and targetProjectId.')
        }
        return json(
          unwrap(
            await m.bulkMoveTasksToSprint({
              taskIds: args.taskIds,
              targetProjectId: args.targetProjectId,
              targetSprintId: args.targetSprintId ?? null
            })
          )
        )
      }
      if (!args.sprintId || !args.taskId) {
        throw new Error(`${args.action} requires sprintId and taskId.`)
      }
      const input = { sprintId: args.sprintId, taskId: args.taskId }
      return json(
        unwrap(
          args.action === 'add'
            ? await m.addTaskToSprint(input)
            : await m.removeTaskFromSprint(input)
        )
      )
    }
  )

  // ─── Team & self ────────────────────────────────────────────────────────

  server.registerTool(
    'list_team',
    {
      title: 'List team',
      description:
        'Everyone in this workspace with their access tier and presence.',
      inputSchema: z.object({}),
      annotations: read
    },
    async () => {
      await requireMember()
      return json(unwrap(await listTeamRoster()))
    }
  )

  server.registerTool(
    'get_member_portfolio',
    {
      title: 'Get member profile',
      description: 'Profile, skills, and links for one teammate.',
      inputSchema: z.object({ memberId: Uuid }),
      annotations: read
    },
    async (args) => {
      await requireMember()
      return json(unwrap(await m.fetchMemberPortfolio(args.memberId)))
    }
  )

  server.registerTool(
    'update_member_status',
    {
      title: "Set a member's presence",
      description:
        'Mark someone active, away, on vacation, or left. Leads and admins only.',
      inputSchema: z.object({
        memberId: Uuid,
        status: z.enum(['active', 'away', 'on_vacation', 'left'])
      }),
      annotations: destructive
    },
    async (args) => {
      await requireMember()
      return json(unwrap(await m.updateMemberActivityStatus(args)))
    }
  )

  server.registerTool(
    'update_my_timezone',
    {
      title: 'Set my timezone',
      description: 'Update your own IANA timezone, e.g. Europe/Malta.',
      inputSchema: z.object({ timezone: z.string().min(1) })
    },
    async (args) => {
      await requireMember()
      return json(unwrap(await updateMyTimezone(args.timezone)))
    }
  )

  server.registerTool(
    'email_prefs',
    {
      title: 'Read or change my email preferences',
      description: 'Get your notification preferences, or update them.',
      inputSchema: z.object({
        action: z.enum(['get', 'set']),
        prefs: z.record(z.string(), z.boolean()).optional()
      })
    },
    async (args) => {
      await requireMember()
      if (args.action === 'get') return json(await getMyEmailPrefs())
      if (!args.prefs) throw new Error('set requires prefs.')
      return json(unwrap(await updateMyEmailPrefs(args.prefs)))
    }
  )

  // ─── Handoff ────────────────────────────────────────────────────────────

  server.registerTool(
    'get_handoff',
    {
      title: 'Get task handoff',
      description: 'The handoff notes recorded when a task moves to done.',
      inputSchema: z.object({ taskId: Uuid }),
      annotations: read
    },
    async (args) => {
      await requireMember()
      return json(unwrap(await m.fetchTaskHandoff(args.taskId)))
    }
  )

  server.registerTool(
    'save_handoff',
    {
      title: 'Save or submit a task handoff',
      description:
        'Record handoff notes. Use submit to send for review, which requires every field.',
      inputSchema: z.object({
        taskId: Uuid,
        submit: z.boolean().optional(),
        fields: z.object({
          whatItIs: z.string().max(2000).nullish(),
          currentStatus: z.string().max(2000).nullish(),
          doneSoFar: z.string().max(2000).nullish(),
          stillLeft: z.string().max(2000).nullish(),
          fileLinks: z.string().max(2000).nullish(),
          gotchas: z.string().max(2000).nullish(),
          whoToAsk: z.string().max(2000).nullish()
        })
      })
    },
    async (args) => {
      await requireMember()
      const input = { taskId: args.taskId, fields: args.fields }
      return json(
        unwrap(
          args.submit
            ? await m.submitHandoffForReview(input)
            : await m.saveHandoffDraft(input)
        )
      )
    }
  )
}
