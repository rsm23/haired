export const ANSWER_MAGNIFIER_SIZE = 176
export const ANSWER_MAGNIFIER_ZOOM = 1.85

type MagnifierGeometryInput = {
  pointerX: number
  pointerY: number
  scrollLeft: number
  scrollTop: number
  size?: number
  zoom?: number
}

export type MagnifierGeometry = {
  lensLeft: number
  lensTop: number
  contentTranslateX: number
  contentTranslateY: number
}

export function answerMagnifierGeometry({
  pointerX,
  pointerY,
  scrollLeft,
  scrollTop,
  size = ANSWER_MAGNIFIER_SIZE,
  zoom = ANSWER_MAGNIFIER_ZOOM
}: MagnifierGeometryInput): MagnifierGeometry {
  const radius = size / 2
  const contentX = scrollLeft + pointerX
  const contentY = scrollTop + pointerY

  return {
    lensLeft: pointerX - radius,
    lensTop: pointerY - radius,
    contentTranslateX: radius - contentX * zoom,
    contentTranslateY: radius - contentY * zoom
  }
}
