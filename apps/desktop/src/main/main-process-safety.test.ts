import type { BrowserWindow } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { isClosedOutputError, sendToRenderer } from './main-process-safety'

function createWindow(input?: {
  windowDestroyed?: boolean
  contentsDestroyed?: boolean
  frameDetached?: boolean
  sendError?: Error
}): { window: BrowserWindow; send: ReturnType<typeof vi.fn> } {
  const send = input?.sendError
    ? vi.fn(() => {
        throw input.sendError
      })
    : vi.fn()
  const window = {
    isDestroyed: vi.fn(() => input?.windowDestroyed ?? false),
    webContents: {
      isDestroyed: vi.fn(() => input?.contentsDestroyed ?? false),
      mainFrame: { detached: input?.frameDetached ?? false },
      send
    }
  } as unknown as BrowserWindow
  return { window, send }
}

describe('main-process renderer transport', () => {
  it('sends to a live renderer', () => {
    const { window, send } = createWindow()

    expect(sendToRenderer(window, 'overlay:event', { type: 'completed' })).toBe(true)
    expect(send).toHaveBeenCalledWith('overlay:event', { type: 'completed' })
  })

  it.each([
    ['destroyed window', { windowDestroyed: true }],
    ['destroyed web contents', { contentsDestroyed: true }],
    ['detached main frame', { frameDetached: true }]
  ])('does not send to a %s', (_label, state) => {
    const { window, send } = createWindow(state)

    expect(sendToRenderer(window, 'overlay:event', {})).toBe(false)
    expect(send).not.toHaveBeenCalled()
  })

  it('contains a renderer destruction race that throws during send', () => {
    const { window } = createWindow({
      sendError: Object.assign(new Error('write EIO'), { code: 'EIO' })
    })

    expect(sendToRenderer(window, 'overlay:event', {})).toBe(false)
  })
})

describe('closed process output errors', () => {
  it.each(['EIO', 'EPIPE'])('recognizes %s as a closed output stream', (code) => {
    expect(isClosedOutputError(Object.assign(new Error(code), { code }))).toBe(true)
  })

  it('does not hide unrelated output errors', () => {
    expect(isClosedOutputError(Object.assign(new Error('permission denied'), { code: 'EACCES' }))).toBe(
      false
    )
    expect(isClosedOutputError('EIO')).toBe(false)
  })
})
