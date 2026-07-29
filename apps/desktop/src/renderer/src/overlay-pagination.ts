export function stableAnswerColumnCount(
  measuredCount: number,
  reportedCount: number,
  pendingCount: number,
  stackRight: boolean
): number {
  if (!stackRight) return 1
  return Math.max(
    1,
    Math.min(100, Math.ceil(measuredCount)),
    reportedCount,
    pendingCount
  )
}

export function clampAnswerScrollLeft(
  desiredLeft: number,
  scrollWidth: number,
  clientWidth: number
): number {
  return Math.min(
    Math.max(0, scrollWidth - clientWidth),
    Math.max(0, desiredLeft)
  )
}

export function answerColumnAt(
  scrollLeft: number,
  columnWidth: number,
  columnCount: number
): number {
  if (columnWidth <= 0) return 1
  return Math.min(
    Math.max(1, columnCount),
    Math.max(1, Math.round(scrollLeft / columnWidth) + 1)
  )
}
