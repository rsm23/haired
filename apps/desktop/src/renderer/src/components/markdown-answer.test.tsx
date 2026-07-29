import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MarkdownAnswer } from './markdown-answer'

describe('MarkdownAnswer', () => {
  it('syntax-highlights language-tagged fenced code blocks', () => {
    const html = renderToStaticMarkup(
      <MarkdownAnswer>
        {'```typescript\nconst answer: number = 42\nconsole.log(answer)\n```'}
      </MarkdownAnswer>
    )

    expect(html).toContain('class="hljs language-typescript"')
    expect(html).toContain('hljs-keyword')
    expect(html).toContain('hljs-number')
  })

  it('renders unknown language fences safely without interpreting raw HTML', () => {
    const html = renderToStaticMarkup(
      <MarkdownAnswer>{'```unknown-language\n<script>alert(1)</script>\n```'}</MarkdownAnswer>
    )

    expect(html).toContain('language-unknown-language')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script>')
  })
})
