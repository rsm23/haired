import { describe, expect, it } from 'vitest'
import { answerMagnifierGeometry } from './answer-magnifier'

describe('answer magnifier geometry', () => {
  it('centers the lens and enlarged content on the pointer', () => {
    expect(
      answerMagnifierGeometry({
        pointerX: 240,
        pointerY: 120,
        scrollLeft: 520,
        scrollTop: 40,
        size: 176,
        zoom: 2
      })
    ).toEqual({
      lensLeft: 152,
      lensTop: 32,
      contentTranslateX: -1_432,
      contentTranslateY: -232
    })
  })

  it('uses viewport coordinates when the answer has not scrolled', () => {
    expect(
      answerMagnifierGeometry({
        pointerX: 100,
        pointerY: 80,
        scrollLeft: 0,
        scrollTop: 0,
        size: 160,
        zoom: 1.5
      })
    ).toEqual({
      lensLeft: 20,
      lensTop: 0,
      contentTranslateX: -70,
      contentTranslateY: -40
    })
  })
})
