import type { BrowserWindow } from 'electron'

type OutputError = Error & { code?: string }

export function isClosedOutputError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const code = (error as OutputError).code
  return code === 'EIO' || code === 'EPIPE'
}

export function installClosedOutputGuards(): void {
  const handleOutputError = (error: Error): void => {
    if (!isClosedOutputError(error)) throw error
  }

  process.stdout.on('error', handleOutputError)
  process.stderr.on('error', handleOutputError)
}

export function sendToRenderer(
  window: BrowserWindow,
  channel: string,
  ...args: unknown[]
): boolean {
  try {
    if (window.isDestroyed()) return false
    const contents = window.webContents
    if (contents.isDestroyed() || contents.mainFrame.detached) return false
    contents.send(channel, ...args)
    return true
  } catch {
    // Destruction can race every check above. A closed renderer is expected
    // during overlay replacement and application shutdown.
    return false
  }
}
