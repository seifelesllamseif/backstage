import 'server-only'

import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/supabase/admin'
import { getCurrentTeamMember } from '@/lib/dal'
import {
  deleteDriveFile,
  driveFullUrl,
  driveThumbnailUrl,
  ensureBackstageFolder,
  getDriveAccess,
  uploadImageToDrive
} from '@/lib/google/drive'
import { logActivity } from './mutations'

const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif'
])

export interface TaskAttachment {
  id: string
  taskId: string
  fileName: string
  mimeType: string
  sizeBytes: number
  width: number | null
  height: number | null
  createdAt: string
  uploadedBy: { id: string; fullName: string } | null
  // Resolved URLs for the browser.
  thumbnailUrl: string
  fullUrl: string
}

export function toThumbnail(driveFileId: string, widthPx = 480) {
  return driveThumbnailUrl(driveFileId, widthPx)
}

export function toFullUrl(driveFileId: string) {
  return driveFullUrl(driveFileId)
}

export async function uploadTaskImage(
  form: FormData
): Promise<
  | { ok: true; attachment: TaskAttachment }
  | { error: string; needsReconnect?: boolean }
> {
  const taskId = String(form.get('taskId') ?? '')
  const file = form.get('file')
  const width = Number(form.get('width') ?? 0) || null
  const height = Number(form.get('height') ?? 0) || null
  if (!taskId) return { error: 'Missing taskId.' }
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'No file received.' }
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return { error: 'Only PNG, JPEG, WebP, or GIF images are allowed.' }
  }
  if (file.size > MAX_BYTES) {
    return { error: 'Image is over 10 MB after compression.' }
  }

  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }

  const supabase = createAdminClient()
  // Confirm the task belongs to the viewer's company before touching Drive.
  const { data: task } = await supabase
    .from('tasks')
    .select('id, ref, title, company_id')
    .eq('id', taskId)
    .maybeSingle()
  if (!task || task.company_id !== member.companyId) {
    return { error: 'Task not found.' }
  }

  const access = await getDriveAccess(member.companyId)
  if ('error' in access) {
    return { error: access.error, needsReconnect: access.needsReconnect }
  }

  const folder = await ensureBackstageFolder(access.accessToken)
  if ('error' in folder) return { error: folder.error }

  const safeRef = (task.ref ?? 'task').replace(/[^a-z0-9-]/gi, '_')
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const driveName = `${safeRef}_${ts}_${file.name}`.slice(0, 200)
  const uploaded = await uploadImageToDrive(
    access.accessToken,
    folder.folderId,
    file,
    driveName,
    file.type
  )
  if ('error' in uploaded) return { error: uploaded.error }

  const { data: row, error: dbErr } = await supabase
    .from('task_attachments')
    .insert({
      task_id: taskId,
      company_id: member.companyId,
      uploaded_by: member.id,
      drive_file_id: uploaded.fileId,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      width,
      height
    })
    .select('id, created_at')
    .single()
  if (dbErr || !row) {
    // Roll back the Drive side so we don't strand orphaned files.
    await deleteDriveFile(access.accessToken, uploaded.fileId).catch(() => {})
    return { error: dbErr?.message ?? 'Insert failed.' }
  }

  await logActivity(
    supabase,
    member.companyId,
    member.id,
    'task.attachment_added',
    'task',
    taskId,
    {
      attachmentId: row.id,
      fileName: file.name,
      sizeBytes: file.size
    }
  )

  revalidatePath('/dashboard')

  return {
    ok: true,
    attachment: {
      id: row.id,
      taskId,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      width,
      height,
      createdAt: row.created_at,
      uploadedBy: { id: member.id, fullName: member.fullName },
      thumbnailUrl: toThumbnail(uploaded.fileId),
      fullUrl: toFullUrl(uploaded.fileId)
    }
  }
}

export async function deleteTaskAttachment(
  attachmentId: string
): Promise<{ ok: true } | { error: string }> {
  const member = await getCurrentTeamMember()
  if (!member) return { error: 'Not signed in.' }
  const supabase = createAdminClient()

  const { data: row } = await supabase
    .from('task_attachments')
    .select('id, task_id, company_id, uploaded_by, drive_file_id')
    .eq('id', attachmentId)
    .maybeSingle()
  if (!row || row.company_id !== member.companyId) {
    return { error: 'Attachment not found.' }
  }

  const isAdmin = member.accessTier === 'admin'
  const isUploader = row.uploaded_by === member.id
  if (!isAdmin && !isUploader) {
    return { error: 'Only the uploader or an admin can remove this image.' }
  }

  const access = await getDriveAccess(member.companyId)
  if (!('error' in access)) {
    // Best-effort drive cleanup. The DB row is the source of truth, so
    // a stale Drive file isn't fatal.
    await deleteDriveFile(access.accessToken, row.drive_file_id).catch(() => {})
  }

  const { error } = await supabase
    .from('task_attachments')
    .delete()
    .eq('id', attachmentId)
  if (error) return { error: error.message }

  await logActivity(
    supabase,
    member.companyId,
    member.id,
    'task.attachment_removed',
    'task',
    row.task_id,
    { attachmentId: row.id }
  )

  revalidatePath('/dashboard')
  return { ok: true }
}
