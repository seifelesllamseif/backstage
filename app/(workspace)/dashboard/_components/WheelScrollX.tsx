'use client'

import { useEffect, useRef, type ReactNode } from 'react'

// Mouse wheels only emit vertical deltas, so a plain wheel can't pan the
// board. Translate vertical wheel into horizontal panning — but only for
// real mouse wheels: doing it for trackpads hijacks the natural two-finger
// vertical scroll and feels broken. Neither device identifies itself, so
// classify per gesture: trackpads emit a non-zero deltaX at some point or
// ramp up from small/fractional pixel deltas, while a wheel notch lands as
// one large quantized deltaY (or deltaMode=line). The verdict sticks for
// the whole gesture (events <150ms apart) so a fast trackpad flick, whose
// mid-gesture deltas look wheel-sized, isn't reclassified halfway.
// Needs a native non-passive listener: React's synthetic onWheel is
// passive and can't preventDefault.
const GESTURE_GAP_MS = 150
const WHEEL_NOTCH_PX = 50

// Exported for the unit test; `wasTrackpad` is the verdict carried over
// from the previous event of the same gesture.
export function isTrackpadWheel(
  e: Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode' | 'timeStamp'>,
  wasTrackpad: boolean,
  lastAt: number
): boolean {
  if (e.timeStamp - lastAt > GESTURE_GAP_MS) {
    return (
      e.deltaX !== 0 ||
      (e.deltaMode === 0 && Math.abs(e.deltaY) < WHEEL_NOTCH_PX)
    )
  }
  return wasTrackpad || e.deltaX !== 0
}

export default function WheelScrollX({
  className,
  children
}: {
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let lastAt = 0
    let isTrackpad = false
    const onWheel = (e: WheelEvent) => {
      isTrackpad = isTrackpadWheel(e, isTrackpad, lastAt)
      lastAt = e.timeStamp

      if (isTrackpad || e.deltaY === 0 || e.shiftKey) return
      if (el.scrollWidth <= el.clientWidth) return
      // Yield to any child that can still scroll vertically in this
      // direction (task columns) so their native behavior is untouched.
      for (
        let n = e.target as HTMLElement | null;
        n && n !== el;
        n = n.parentElement
      ) {
        if (n.scrollHeight > n.clientHeight + 1) {
          const canDown = n.scrollTop + n.clientHeight < n.scrollHeight - 1
          const canUp = n.scrollTop > 0
          if ((e.deltaY > 0 && canDown) || (e.deltaY < 0 && canUp)) return
        }
      }
      el.scrollLeft += e.deltaY
      e.preventDefault()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
