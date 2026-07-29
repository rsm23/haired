import { pathToFileURL } from 'node:url'

export function isTrustedRendererUrl(
  senderUrl: string,
  rendererFilePath: string,
  developmentRendererUrl?: string
): boolean {
  try {
    const sender = new URL(senderUrl)
    if (sender.protocol === 'file:') {
      const renderer = new URL(pathToFileURL(rendererFilePath))
      return sender.host === renderer.host && sender.pathname === renderer.pathname
    }
    if (!developmentRendererUrl) return false
    return sender.origin === new URL(developmentRendererUrl).origin
  } catch {
    return false
  }
}
