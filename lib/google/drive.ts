import 'server-only'

import { createAdminClient } from '@/supabase/admin'
import { GOOGLE_DRIVE_SCOPE, getSchedulerAccessToken } from './oauth'

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD_API =
  'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id'
const FOLDER_MIME = 'application/vnd.google-apps.folder'
const ROOT_FOLDER_NAME = 'Backstage Task Attachments'
const FOLDER_SECRET_KEY = 'google_drive_attachments_folder_id'

interface DriveAccess {
  accessToken: string
  memberId: string
}

interface ScopeError {
  error: string
  needsReconnect?: boolean
}

// Resolve a usable Drive access token for the company. Returns
// needsReconnect=true when the admin's connection predates the
// drive.file scope so the UI can prompt for a one-time re-auth.
export async function getDriveAccess(
  companyId: string
): Promise<DriveAccess | ScopeError> {
  const supabase = createAdminClient()
  const { data: row } = await supabase
    .from('google_oauth_tokens')
    .select('scope')
    .eq('company_id', companyId)
    .maybeSingle()
  if (!row) {
    return {
      error: 'Google is not connected for this workspace.',
      needsReconnect: true
    }
  }
  if (!row.scope.split(/\s+/).includes(GOOGLE_DRIVE_SCOPE)) {
    return {
      error:
        'Google connection is missing Drive access. Reconnect in Settings to enable image uploads.',
      needsReconnect: true
    }
  }
  const token = await getSchedulerAccessToken(companyId)
  if ('error' in token) return { error: token.error }
  return { accessToken: token.accessToken, memberId: token.memberId }
}

// Returns the workspace's "Backstage Task Attachments" folder id in the
// connected admin's Drive, creating it on first use. The id is cached
// in app_secrets so we don't re-list Drive every upload.
export async function ensureBackstageFolder(
  accessToken: string
): Promise<{ folderId: string } | { error: string }> {
  const supabase = createAdminClient()
  const { data: cached } = await supabase
    .from('app_secrets')
    .select('value')
    .eq('key', FOLDER_SECRET_KEY)
    .maybeSingle()
  if (cached?.value) {
    const ok = await driveFileExists(accessToken, cached.value)
    if (ok) return { folderId: cached.value }
  }

  // Look for an existing folder with our name before creating a duplicate.
  const q = new URLSearchParams({
    q: `name='${ROOT_FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and trashed=false`,
    fields: 'files(id,name)',
    pageSize: '1'
  })
  const findRes = await fetch(`${DRIVE_FILES_API}?${q}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  if (findRes.ok) {
    const json = (await findRes.json()) as { files?: { id: string }[] }
    const existing = json.files?.[0]
    if (existing?.id) {
      await supabase
        .from('app_secrets')
        .upsert(
          { key: FOLDER_SECRET_KEY, value: existing.id },
          { onConflict: 'key' }
        )
      return { folderId: existing.id }
    }
  }

  const createRes = await fetch(`${DRIVE_FILES_API}?fields=id`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      name: ROOT_FOLDER_NAME,
      mimeType: FOLDER_MIME
    })
  })
  if (!createRes.ok) {
    const text = await createRes.text()
    return {
      error: `Drive folder create failed: ${text.slice(0, 200)}`
    }
  }
  const created = (await createRes.json()) as { id: string }
  await supabase
    .from('app_secrets')
    .upsert(
      { key: FOLDER_SECRET_KEY, value: created.id },
      { onConflict: 'key' }
    )
  return { folderId: created.id }
}

async function driveFileExists(
  accessToken: string,
  fileId: string
): Promise<boolean> {
  const res = await fetch(`${DRIVE_FILES_API}/${fileId}?fields=id,trashed`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  if (!res.ok) return false
  const json = (await res.json()) as { id?: string; trashed?: boolean }
  return Boolean(json.id) && json.trashed !== true
}

// Multipart upload (metadata + media in one request). Sets the parent
// folder, then flips the file to "anyone with link" so we can embed it
// in img tags without per-render auth.
export async function uploadImageToDrive(
  accessToken: string,
  folderId: string,
  blob: Blob,
  fileName: string,
  mimeType: string
): Promise<{ fileId: string } | { error: string }> {
  const boundary = `bsg-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}`
  const metadata = {
    name: fileName,
    mimeType,
    parents: [folderId]
  }
  const buf = await blob.arrayBuffer()
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`,
    'utf8'
  )
  const tail = Buffer.from(`\r\n--${boundary}--`, 'utf8')
  const body = Buffer.concat([head, Buffer.from(buf), tail])

  const upRes = await fetch(DRIVE_UPLOAD_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'content-type': `multipart/related; boundary=${boundary}`,
      'content-length': String(body.length)
    },
    body
  })
  if (!upRes.ok) {
    const text = await upRes.text()
    return { error: `Drive upload failed: ${text.slice(0, 200)}` }
  }
  const { id: fileId } = (await upRes.json()) as { id: string }

  const permRes = await fetch(
    `${DRIVE_FILES_API}/${fileId}/permissions?supportsAllDrives=false`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' })
    }
  )
  if (!permRes.ok) {
    const text = await permRes.text()
    // File exists but isn't public. Try to clean up so we don't strand
    // a half-shared row.
    await deleteDriveFile(accessToken, fileId).catch(() => {})
    return { error: `Drive sharing failed: ${text.slice(0, 200)}` }
  }
  return { fileId }
}

export async function deleteDriveFile(
  accessToken: string,
  fileId: string
): Promise<{ ok: true } | { error: string }> {
  const res = await fetch(`${DRIVE_FILES_API}/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  if (res.status === 404) return { ok: true }
  if (!res.ok) {
    const text = await res.text()
    return { error: `Drive delete failed: ${text.slice(0, 200)}` }
  }
  return { ok: true }
}

// Embed URLs the browser can use directly. lh3 supports a sizing param
// for thumbnails (much faster than the redirecting drive.google.com URL),
// while the canonical drive.google.com URL is used for the lightbox.
export function driveThumbnailUrl(
  fileId: string,
  widthPx: number
): string {
  return `https://lh3.googleusercontent.com/d/${fileId}=w${widthPx}`
}

export function driveFullUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=view&id=${fileId}`
}
