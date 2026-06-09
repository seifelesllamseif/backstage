// Browser-only image compression. Mirrors WhatsApp's behaviour for
// shared images: scale the long edge to 1920px and re-encode as JPEG
// at quality 0.8. PNGs with transparency stay PNG (lossless) since
// alpha would otherwise collapse to black. GIFs and SVGs are returned
// as-is - canvas would either lose animation or rasterize vectors.

const MAX_EDGE_PX = 1920
const JPEG_QUALITY = 0.8

export interface CompressedImage {
  blob: Blob
  mimeType: string
  width: number
  height: number
  fileName: string
}

export async function compressImage(file: File): Promise<CompressedImage> {
  const passthrough = (): CompressedImage => ({
    blob: file,
    mimeType: file.type,
    width: 0,
    height: 0,
    fileName: file.name
  })

  if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return passthrough()
  }

  const bitmap = await loadBitmap(file)
  if (!bitmap) return passthrough()

  const { width: srcW, height: srcH } = bitmap
  const longEdge = Math.max(srcW, srcH)
  const scale = longEdge > MAX_EDGE_PX ? MAX_EDGE_PX / longEdge : 1
  const dstW = Math.max(1, Math.round(srcW * scale))
  const dstH = Math.max(1, Math.round(srcH * scale))

  const canvas = document.createElement('canvas')
  canvas.width = dstW
  canvas.height = dstH
  const ctx = canvas.getContext('2d')
  if (!ctx) return passthrough()
  ctx.drawImage(bitmap, 0, 0, dstW, dstH)

  const keepPng = await pngHasAlpha(file)
  const outType = keepPng ? 'image/png' : 'image/jpeg'

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(
      (b) => resolve(b),
      outType,
      outType === 'image/jpeg' ? JPEG_QUALITY : undefined
    )
  })
  if (!blob) return passthrough()

  const baseName = file.name.replace(/\.[^.]+$/, '')
  const ext = outType === 'image/jpeg' ? 'jpg' : 'png'
  const fileName = `${baseName}.${ext}`

  return { blob, mimeType: outType, width: dstW, height: dstH, fileName }
}

async function loadBitmap(file: File): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(file)
  } catch {
    return null
  }
}

// Decode the first IDAT chunk header to check whether the PNG has an
// alpha channel. Faster than redrawing and reading every pixel, and
// good enough: false-positives just keep a slightly larger PNG.
async function pngHasAlpha(file: File): Promise<boolean> {
  if (file.type !== 'image/png') return false
  try {
    const head = await file.slice(0, 32).arrayBuffer()
    const view = new DataView(head)
    // PNG IHDR starts at byte 8 with length=13. Color type byte is at
    // offset 25 (8 sig + 4 length + 4 type + 13 data - colorType@9).
    // Color types with alpha: 4 (grayscale+alpha), 6 (RGB+alpha).
    const colorType = view.getUint8(25)
    return colorType === 4 || colorType === 6
  } catch {
    return false
  }
}
