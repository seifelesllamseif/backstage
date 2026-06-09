'use client'

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from 'react'
import { ImagePlus, Loader2, Trash2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'

import { compressImage } from '@/lib/imageCompress'
import {
  deleteTaskAttachment as deleteTaskAttachmentAction,
  uploadTaskImage as uploadTaskImageAction
} from '../actions'
import { useDashTheme } from './theme'

export interface TaskAttachmentView {
  id: string
  taskId: string
  fileName: string
  mimeType: string
  sizeBytes: number
  width: number | null
  height: number | null
  createdAt: string
  uploadedBy: { id: string; fullName: string } | null
  thumbnailUrl: string
  fullUrl: string
}

interface Pending {
  localId: string
  name: string
  state: 'compressing' | 'uploading' | 'error'
  error?: string
}

interface Props {
  taskId: string
  attachments: TaskAttachmentView[]
  currentUserId: string
  isAdmin: boolean
  // Append + remove callbacks so DashboardShell can keep its local
  // attachments-by-task store in sync without a refetch.
  onAttachmentAdded: (a: TaskAttachmentView) => void
  onAttachmentRemoved: (attachmentId: string) => void
  // Settings opener for the reconnect-Google nudge.
  onOpenSettings: () => void
}

const IMG_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

export default function TaskImageDropZone({
  taskId,
  attachments,
  currentUserId,
  isAdmin,
  onAttachmentAdded,
  onAttachmentRemoved,
  onOpenSettings
}: Props) {
  const { t } = useDashTheme()
  const inputId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [pending, setPending] = useState<Pending[]>([])
  const [lightboxId, setLightboxId] = useState<string | null>(null)
  const [needsReconnect, setNeedsReconnect] = useState(false)

  const handleFiles = useCallback(
    async (files: File[]) => {
      const images = files.filter((f) => IMG_MIMES.includes(f.type))
      if (images.length === 0) {
        if (files.length > 0) {
          toast.error('Only PNG, JPEG, WebP, or GIF images are accepted.')
        }
        return
      }
      for (const file of images) {
        const localId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
        setPending((cur) => [
          ...cur,
          { localId, name: file.name, state: 'compressing' }
        ])
        try {
          const compressed = await compressImage(file)
          setPending((cur) =>
            cur.map((p) =>
              p.localId === localId ? { ...p, state: 'uploading' } : p
            )
          )
          const form = new FormData()
          form.set('taskId', taskId)
          form.set(
            'file',
            new File([compressed.blob], compressed.fileName, {
              type: compressed.mimeType
            })
          )
          if (compressed.width) form.set('width', String(compressed.width))
          if (compressed.height) form.set('height', String(compressed.height))
          const res = await uploadTaskImageAction(form)
          if ('error' in res) {
            if (res.needsReconnect) setNeedsReconnect(true)
            toast.error(res.error)
            setPending((cur) =>
              cur.map((p) =>
                p.localId === localId
                  ? { ...p, state: 'error', error: res.error }
                  : p
              )
            )
            continue
          }
          onAttachmentAdded(res.attachment)
          setPending((cur) => cur.filter((p) => p.localId !== localId))
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Upload failed.'
          toast.error(msg)
          setPending((cur) =>
            cur.map((p) =>
              p.localId === localId
                ? { ...p, state: 'error', error: msg }
                : p
            )
          )
        }
      }
    },
    [taskId, onAttachmentAdded]
  )

  // Drag-and-drop on the dashed zone.
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const files = Array.from(e.dataTransfer.files ?? [])
      if (files.length > 0) handleFiles(files)
    },
    [handleFiles]
  )

  // Clipboard paste anywhere in the document while this component is
  // mounted. Skipped when the paste target is an input/textarea/contenteditable
  // so text paste into the description, comment box, etc. stays intact.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          return
        }
      }
      const items = e.clipboardData?.items
      if (!items) return
      const files: File[] = []
      for (const item of items) {
        if (item.kind === 'file') {
          const f = item.getAsFile()
          if (f) files.push(f)
        }
      }
      if (files.length === 0) return
      e.preventDefault()
      handleFiles(files)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [handleFiles])

  const lightboxAttachment = useMemo(
    () => attachments.find((a) => a.id === lightboxId) ?? null,
    [attachments, lightboxId]
  )

  const handleDelete = async (id: string) => {
    const snapshot = attachments
    onAttachmentRemoved(id)
    const res = await deleteTaskAttachmentAction(id)
    if ('error' in res) {
      toast.error(res.error)
      // Rollback: re-append the row at the same spot.
      const removed = snapshot.find((a) => a.id === id)
      if (removed) onAttachmentAdded(removed)
    }
  }

  return (
    <div ref={wrapRef} className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span
          className={`text-[10px] tracking-[0.22em] uppercase ${t.textSubtle}`}
        >
          Images
        </span>
        <label
          htmlFor={inputId}
          className={`inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-[11px] transition ${t.border} ${t.tab}`}
        >
          <ImagePlus className="size-3.5" />
          Add
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={IMG_MIMES.join(',')}
            multiple
            className="sr-only"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? [])
              if (files.length > 0) handleFiles(files)
              e.target.value = ''
            }}
          />
        </label>
      </div>

      {needsReconnect && (
        <div
          className={`flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] ${t.text}`}
        >
          <span className="flex-1">
            Image uploads need Drive access. Reconnect Google in Settings to
            grant it.
          </span>
          <button
            type="button"
            onClick={onOpenSettings}
            className="rounded border border-amber-500/60 bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium"
          >
            Open
          </button>
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragOver(false)
        }}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-3 py-4 text-center transition ${
          dragOver
            ? 'border-teal-500/60 bg-teal-500/10'
            : `${t.borderSoft} ${t.surfaceMuted}`
        }`}
      >
        <Upload
          className={`size-4 ${dragOver ? 'text-teal-500' : t.textSubtle}`}
        />
        <span className={`text-[11px] ${t.textMuted}`}>
          Drop, paste, or click to upload. Max 10 MB after compression.
        </span>
      </div>

      {(attachments.length > 0 || pending.length > 0) && (
        <div className="grid grid-cols-3 gap-2">
          {attachments.map((a) => {
            const canDelete = isAdmin || a.uploadedBy?.id === currentUserId
            return (
              <div
                key={a.id}
                className={`group relative aspect-square overflow-hidden rounded-md border ${t.borderSoft}`}
              >
                <button
                  type="button"
                  onClick={() => setLightboxId(a.id)}
                  className="block size-full"
                  title={a.fileName}
                >
                  <img
                    src={a.thumbnailUrl}
                    alt={a.fileName}
                    loading="lazy"
                    className="size-full object-cover transition group-hover:scale-105"
                  />
                </button>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleDelete(a.id)}
                    aria-label={`Remove ${a.fileName}`}
                    className="absolute top-1 right-1 hidden size-6 items-center justify-center rounded-md border border-white/20 bg-black/60 text-white transition hover:bg-black/80 group-hover:flex"
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}
              </div>
            )
          })}
          {pending.map((p) => (
            <div
              key={p.localId}
              className={`flex aspect-square flex-col items-center justify-center gap-1.5 rounded-md border border-dashed ${t.borderSoft} ${t.surfaceMuted}`}
            >
              {p.state === 'error' ? (
                <>
                  <span className="text-[10px] text-rose-500">Failed</span>
                  <span
                    className={`px-1 text-center text-[9px] ${t.textSubtle}`}
                  >
                    {p.name}
                  </span>
                </>
              ) : (
                <>
                  <Loader2
                    className={`size-4 animate-spin ${t.textSubtle}`}
                  />
                  <span className={`text-[10px] ${t.textSubtle}`}>
                    {p.state === 'compressing' ? 'Compressing' : 'Uploading'}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {lightboxAttachment && (
        <Lightbox
          attachment={lightboxAttachment}
          onClose={() => setLightboxId(null)}
        />
      )}
    </div>
  )
}

function Lightbox({
  attachment,
  onClose
}: {
  attachment: TaskAttachmentView
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close image preview"
        className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white"
      >
        <X className="size-4" />
      </button>
      <img
        src={attachment.fullUrl}
        alt={attachment.fileName}
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full object-contain"
      />
    </div>
  )
}
