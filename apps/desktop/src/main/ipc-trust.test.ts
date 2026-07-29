import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isTrustedRendererUrl } from './ipc-trust'

const rendererPath = path.join('/Applications', 'Haired.app', 'renderer', 'index.html')

describe('IPC renderer trust', () => {
  it('trusts only the exact bundled renderer file, including its query routes', () => {
    const rendererUrl = pathToFileURL(rendererPath)
    rendererUrl.search = '?kind=settings&page=privacy'

    expect(isTrustedRendererUrl(rendererUrl.toString(), rendererPath)).toBe(true)
    expect(
      isTrustedRendererUrl('file:///Applications/Other.app/renderer/index.html', rendererPath)
    ).toBe(false)
  })

  it('trusts the configured development origin without accepting lookalike hosts', () => {
    expect(
      isTrustedRendererUrl(
        'http://localhost:5173/?kind=settings',
        rendererPath,
        'http://localhost:5173'
      )
    ).toBe(true)
    expect(
      isTrustedRendererUrl(
        'http://localhost:5173.evil.example/?kind=settings',
        rendererPath,
        'http://localhost:5173'
      )
    ).toBe(false)
  })

  it('rejects malformed and unrelated senders', () => {
    expect(isTrustedRendererUrl('', rendererPath)).toBe(false)
    expect(isTrustedRendererUrl('https://example.com', rendererPath)).toBe(false)
  })
})
