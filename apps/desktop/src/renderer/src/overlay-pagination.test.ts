import { describe, expect, it } from 'vitest'
import {
  answerColumnAt,
  clampAnswerScrollLeft,
  stableAnswerColumnCount
} from './overlay-pagination'

describe('answer overlay pagination', () => {
  it('keeps column growth monotonic while streamed content is remeasured', () => {
    expect(stableAnswerColumnCount(2, 3, 4, true)).toBe(4)
    expect(stableAnswerColumnCount(5, 3, 4, true)).toBe(5)
  })

  it('returns to one column when right stacking is disabled', () => {
    expect(stableAnswerColumnCount(8, 8, 8, false)).toBe(1)
  })

  it('preserves a requested horizontal position within the current overflow', () => {
    expect(clampAnswerScrollLeft(520, 1_560, 1_040)).toBe(520)
    expect(clampAnswerScrollLeft(1_040, 1_560, 1_040)).toBe(520)
    expect(clampAnswerScrollLeft(520, 1_040, 1_040)).toBe(0)
  })

  it('derives the visible answer column from the preserved scroll position', () => {
    expect(answerColumnAt(0, 520, 4)).toBe(1)
    expect(answerColumnAt(520, 520, 4)).toBe(2)
    expect(answerColumnAt(1_560, 520, 4)).toBe(4)
  })
})
