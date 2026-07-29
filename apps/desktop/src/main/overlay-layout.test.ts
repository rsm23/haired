import { describe, expect, it } from 'vitest'
import {
  boundsForOverlayColumns,
  createOverlayLayout,
  overlayBoundsChanged,
  parseOverlayColumnCount
} from './overlay-layout'

describe('answer overlay layout', () => {
  const display = { x: 100, y: 50, width: 1_440, height: 900 }
  const workArea = { x: 100, y: 74, width: 1_440, height: 850 }

  it('uses the full usable height and starts beside the selected region', () => {
    const layout = createOverlayLayout(display, workArea, {
      x: 100,
      y: 200,
      width: 300,
      height: 200
    })

    expect(layout.bounds).toMatchObject({
      x: 516,
      y: 86,
      height: 826
    })
    expect(layout.columnWidth).toBeGreaterThanOrEqual(420)
    expect(layout.columnWidth).toBeLessThanOrEqual(540)
  })

  it('shifts left when rightward growth reaches the work-area edge', () => {
    const layout = createOverlayLayout(display, workArea, {
      x: 100,
      y: 200,
      width: 300,
      height: 200
    })
    const grown = boundsForOverlayColumns(layout, 2)

    expect(grown.width).toBe(layout.columnWidth * 2)
    expect(grown.x + grown.width).toBeLessThanOrEqual(workArea.x + workArea.width - 12)
    expect(grown.x).toBeLessThan(layout.originX)
  })

  it('caps hostile or excessive column counts to the usable display width', () => {
    const layout = createOverlayLayout(display, workArea, {
      x: 600,
      y: 100,
      width: 400,
      height: 300
    })
    const grown = boundsForOverlayColumns(layout, Number.MAX_SAFE_INTEGER)

    expect(grown.x).toBe(workArea.x + 12)
    expect(grown.width).toBe(workArea.width - 24)
    expect(boundsForOverlayColumns(layout, -20).width).toBe(layout.columnWidth)
  })

  it('keeps negative-coordinate secondary displays inside their work area', () => {
    const secondary = { x: -1_920, y: 0, width: 1_920, height: 1_080 }
    const work = { x: -1_920, y: 25, width: 1_920, height: 1_055 }
    const layout = createOverlayLayout(secondary, work, {
      x: 1_400,
      y: 200,
      width: 400,
      height: 300
    })
    const grown = boundsForOverlayColumns(layout, 4)

    expect(grown.x).toBeGreaterThanOrEqual(work.x + 12)
    expect(grown.x + grown.width).toBeLessThanOrEqual(work.x + work.width - 12)
  })

  it.each([0, 101, 1.5, '2', null])(
    'rejects hostile renderer column count %j',
    (value) => {
      expect(() => parseOverlayColumnCount(value)).toThrow(
        'Invalid answer column count'
      )
    }
  )

  it('does not request a native resize when capped bounds are unchanged', () => {
    const current = { x: 112, y: 86, width: 1_416, height: 826 }

    expect(overlayBoundsChanged(current, { ...current })).toBe(false)
    expect(overlayBoundsChanged(current, { ...current, width: 540 })).toBe(true)
  })
})
