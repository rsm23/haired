import type { CodeResponseStyle } from '@haired/contracts'

interface Fence {
  marker: '`' | '~'
  length: number
  lines: string[]
}

function sourceLines(markdown: string): string[] {
  return markdown.match(/[^\n]*(?:\n|$)/g)?.filter(Boolean) ?? []
}

function openingFence(line: string): Fence | null {
  const normalized = line.replace(/\r?\n$/, '')
  const match = normalized.match(/^ {0,3}(`{3,}|~{3,})(.*)$/)
  if (!match) return null
  const token = match[1]
  const info = match[2] ?? ''
  if (!token || (token[0] === '`' && info.includes('`'))) return null
  return {
    marker: token[0] as Fence['marker'],
    length: token.length,
    lines: [line]
  }
}

function closesFence(line: string, fence: Fence): boolean {
  const normalized = line.replace(/\r?\n$/, '')
  const match = normalized.match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/)
  return Boolean(
    match?.[1] &&
      match[1][0] === fence.marker &&
      match[1].length >= fence.length
  )
}

export function extractFencedCodeMarkdown(markdown: string): {
  found: boolean
  markdown: string
} {
  const blocks: string[] = []
  let active: Fence | null = null

  for (const line of sourceLines(markdown)) {
    if (!active) {
      active = openingFence(line)
      continue
    }

    active.lines.push(line)
    if (closesFence(line, active)) {
      blocks.push(active.lines.join('').trimEnd())
      active = null
    }
  }

  if (active) {
    const unfinished = active.lines.join('').trimEnd()
    blocks.push(`${unfinished}\n${active.marker.repeat(active.length)}`)
  }

  return {
    found: blocks.length > 0,
    markdown: blocks.join('\n\n')
  }
}

export function visibleAnswerMarkdown(
  rawAnswer: string,
  style: CodeResponseStyle,
  completed = true
): string {
  if (style === 'full-reply') return rawAnswer
  const code = extractFencedCodeMarkdown(rawAnswer)
  if (code.found) return code.markdown
  return completed ? rawAnswer : ''
}
