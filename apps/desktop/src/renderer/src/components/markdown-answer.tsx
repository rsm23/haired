import type { ComponentProps } from 'react'
import rehypeHighlight from 'rehype-highlight'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const remarkPlugins: NonNullable<ComponentProps<typeof ReactMarkdown>['remarkPlugins']> = [
  remarkGfm
]
const rehypePlugins: NonNullable<ComponentProps<typeof ReactMarkdown>['rehypePlugins']> = [
  [rehypeHighlight, { detect: false, ignoreMissing: true }]
]

export function MarkdownAnswer({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
      {children}
    </ReactMarkdown>
  )
}
