import type { Rectangle } from 'electron'
import type { CaptureRegion } from '@haired/contracts'

const OVERLAY_MARGIN = 12
const REGION_GAP = 16

export interface OverlayLayout {
  workArea: Rectangle
  originX: number
  columnWidth: number
  bounds: Rectangle
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function parseOverlayColumnCount(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 100
  ) {
    throw new Error('Invalid answer column count')
  }
  return value
}

export function createOverlayLayout(
  displayBounds: Rectangle,
  workArea: Rectangle,
  region: CaptureRegion
): OverlayLayout {
  const availableWidth = Math.max(320, workArea.width - OVERLAY_MARGIN * 2)
  const columnWidth = Math.round(
    Math.min(availableWidth, 540, Math.max(420, workArea.width * 0.36))
  )
  const availableHeight = Math.max(280, workArea.height - OVERLAY_MARGIN * 2)
  const leftEdge = workArea.x + OVERLAY_MARGIN
  const rightEdge = workArea.x + workArea.width - OVERLAY_MARGIN
  const regionLeft = displayBounds.x + region.x
  const regionRight = regionLeft + region.width
  const preferredRight = regionRight + REGION_GAP
  const preferredLeft = regionLeft - columnWidth - REGION_GAP
  const originX =
    preferredRight + columnWidth <= rightEdge
      ? preferredRight
      : preferredLeft >= leftEdge
        ? preferredLeft
        : clamp(regionLeft, leftEdge, rightEdge - columnWidth)
  const bounds = {
    x: Math.round(originX),
    y: Math.round(workArea.y + OVERLAY_MARGIN),
    width: columnWidth,
    height: Math.round(availableHeight)
  }
  return {
    workArea,
    originX: bounds.x,
    columnWidth,
    bounds
  }
}

export function boundsForOverlayColumns(
  layout: OverlayLayout,
  rawColumnCount: number
): Rectangle {
  const columnCount = clamp(Math.round(rawColumnCount), 1, 100)
  const leftEdge = layout.workArea.x + OVERLAY_MARGIN
  const rightEdge = layout.workArea.x + layout.workArea.width - OVERLAY_MARGIN
  const maximumWidth = rightEdge - leftEdge
  const width = Math.min(maximumWidth, layout.columnWidth * columnCount)
  const x = clamp(layout.originX, leftEdge, rightEdge - width)
  return {
    x: Math.round(x),
    y: layout.bounds.y,
    width: Math.round(width),
    height: layout.bounds.height
  }
}

export function overlayBoundsChanged(
  current: Rectangle,
  next: Rectangle
): boolean {
  return (
    current.x !== next.x ||
    current.y !== next.y ||
    current.width !== next.width ||
    current.height !== next.height
  )
}
