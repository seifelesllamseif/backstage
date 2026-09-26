import { describe, expect, it } from 'vitest'
import { isTrackpadWheel } from '@/app/(workspace)/dashboard/_components/WheelScrollX'

// timeStamp defaults far past the 150ms gap, i.e. a fresh gesture.
const ev = (deltaY: number, deltaX = 0, timeStamp = 1000, deltaMode = 0) => ({
  deltaX,
  deltaY,
  deltaMode,
  timeStamp
})

describe('isTrackpadWheel', () => {
  it('treats a big quantized deltaY as a mouse notch', () => {
    expect(isTrackpadWheel(ev(100), false, 0)).toBe(false)
  })

  it('treats a line-mode wheel (Firefox) as a mouse', () => {
    expect(isTrackpadWheel(ev(3, 0, 1000, 1), false, 0)).toBe(false)
  })

  it('treats small pixel deltas as a trackpad', () => {
    expect(isTrackpadWheel(ev(4), false, 0)).toBe(true)
  })

  it('treats any horizontal delta as a trackpad', () => {
    expect(isTrackpadWheel(ev(80, -12), false, 0)).toBe(true)
  })

  // The flick: gesture starts small (trackpad) then ramps past the notch
  // threshold. Same gesture, so the verdict must stick.
  it('keeps the trackpad verdict through a fast flick', () => {
    expect(isTrackpadWheel(ev(160, 0, 50), true, 0)).toBe(true)
  })

  // ...but a wheel notch arriving after a pause is re-classified.
  it('re-classifies after the gesture gap', () => {
    expect(isTrackpadWheel(ev(160, 0, 500), true, 0)).toBe(false)
  })
})
