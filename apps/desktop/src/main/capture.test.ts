import { describe, expect, it } from 'vitest'
import {
  calculatePixelCrop,
  constrainedSize,
  screenCaptureFailureMessage
} from './capture'

describe('capture geometry', () => {
  it('maps DIP selections to Retina pixels', () => {
    expect(
      calculatePixelCrop(
        { x: 100, y: 50, width: 500, height: 250 },
        { x: -1_440, y: 0, width: 1_440, height: 900 },
        { width: 2_880, height: 1_800 }
      )
    ).toEqual({ x: 200, y: 100, width: 1_000, height: 500 })
  })

  it('clamps crops at the display edge', () => {
    expect(
      calculatePixelCrop(
        { x: 1_900, y: 1_000, width: 100, height: 100 },
        { x: 0, y: 0, width: 1_920, height: 1_080 },
        { width: 1_920, height: 1_080 }
      )
    ).toEqual({ x: 1_900, y: 1_000, width: 20, height: 80 })
  })

  it('limits both edge length and total pixel count', () => {
    const size = constrainedSize(8_000, 6_000)
    expect(size.width).toBeLessThanOrEqual(4_096)
    expect(size.width * size.height).toBeLessThanOrEqual(8_000_000)
  })

  it('explains that a newly granted macOS capture permission needs a restart', () => {
    expect(screenCaptureFailureMessage('granted')).toContain('Restart Haired')
  })

  it('directs blocked macOS capture access to System Settings', () => {
    expect(screenCaptureFailureMessage('denied')).toContain('Screen & System Audio Recording')
  })
})
