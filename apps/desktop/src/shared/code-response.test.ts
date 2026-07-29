import { describe, expect, it } from 'vitest'
import {
  extractFencedCodeMarkdown,
  visibleAnswerMarkdown
} from './code-response'

describe('code response view', () => {
  it('keeps every fenced block in order and removes surrounding prose', () => {
    const raw = [
      'Start here.',
      '',
      '```typescript',
      'const value = `three backticks: \\`\\`\\``',
      '```',
      '',
      'More explanation.',
      '',
      '~~~~python',
      'print("done")',
      '~~~~',
      '',
      'Finished.'
    ].join('\n')

    expect(extractFencedCodeMarkdown(raw)).toEqual({
      found: true,
      markdown: [
        '```typescript',
        'const value = `three backticks: \\`\\`\\``',
        '```',
        '',
        '~~~~python',
        'print("done")',
        '~~~~'
      ].join('\n')
    })
  })

  it('does not close a longer fence with a shorter marker', () => {
    const raw = ['````typescript', 'const fence = "```"', '```', '````'].join('\n')
    expect(extractFencedCodeMarkdown(raw).markdown).toBe(raw)
  })

  it('temporarily closes an unfinished streaming fence for safe rendering', () => {
    expect(extractFencedCodeMarkdown('```tsx\nexport function App() {').markdown).toBe(
      '```tsx\nexport function App() {\n```'
    )
  })

  it('suppresses prose while streaming and falls back after completion', () => {
    expect(visibleAnswerMarkdown('Let me inspect that.', 'code-only', false)).toBe('')
    expect(visibleAnswerMarkdown('This is not a code question.', 'code-only', true)).toBe(
      'This is not a code question.'
    )
  })

  it('returns the raw answer in full-reply mode', () => {
    const raw = 'Explanation\n\n```unknown\n<unsafe />\n```'
    expect(visibleAnswerMarkdown(raw, 'full-reply', false)).toBe(raw)
  })
})
