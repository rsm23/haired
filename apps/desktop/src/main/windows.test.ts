import path from 'node:path'
import type { BrowserWindow } from 'electron'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  shell: { openExternal: vi.fn() }
}))

import { loadRenderer } from './windows'

const originalRendererUrl = process.env.ELECTRON_RENDERER_URL
const originalElectronViteEnvironment = process.env.NODE_ENV_ELECTRON_VITE

afterEach(() => {
  vi.restoreAllMocks()
  if (originalRendererUrl === undefined) delete process.env.ELECTRON_RENDERER_URL
  else process.env.ELECTRON_RENDERER_URL = originalRendererUrl
  if (originalElectronViteEnvironment === undefined) {
    delete process.env.NODE_ENV_ELECTRON_VITE
  } else {
    process.env.NODE_ENV_ELECTRON_VITE = originalElectronViteEnvironment
  }
})

describe('renderer loading', () => {
  it('loads the active development renderer with window query parameters', async () => {
    process.env.ELECTRON_RENDERER_URL = 'http://localhost:5173'
    process.env.NODE_ENV_ELECTRON_VITE = 'development'
    const window = {
      loadURL: vi.fn().mockResolvedValue(undefined),
      loadFile: vi.fn()
    } as unknown as BrowserWindow

    await loadRenderer(window, { kind: 'selector', mode: 'instant' })

    expect(window.loadURL).toHaveBeenCalledWith(
      'http://localhost:5173/?kind=selector&mode=instant'
    )
    expect(window.loadFile).not.toHaveBeenCalled()
  })

  it('falls back to the local bundle when a development server has stopped', async () => {
    process.env.ELECTRON_RENDERER_URL = 'http://localhost:5173'
    process.env.NODE_ENV_ELECTRON_VITE = 'development'
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const window = {
      loadURL: vi.fn().mockRejectedValue(new Error('ERR_CONNECTION_REFUSED')),
      loadFile: vi.fn().mockResolvedValue(undefined)
    } as unknown as BrowserWindow

    await loadRenderer(window, { kind: 'selector', mode: 'instant' })

    expect(window.loadFile).toHaveBeenCalledWith(
      expect.stringContaining(path.join('renderer', 'index.html')),
      { query: { kind: 'selector', mode: 'instant' } }
    )
    expect(process.env.ELECTRON_RENDERER_URL).toBeUndefined()
    expect(warning).toHaveBeenCalledWith(
      'Development renderer unavailable; loading the local renderer bundle.'
    )
  })

  it('does not hide renderer failures outside development', async () => {
    process.env.ELECTRON_RENDERER_URL = 'https://renderer.example'
    process.env.NODE_ENV_ELECTRON_VITE = 'production'
    const error = new Error('renderer failed')
    const window = {
      loadURL: vi.fn().mockRejectedValue(error),
      loadFile: vi.fn()
    } as unknown as BrowserWindow

    await expect(loadRenderer(window, { kind: 'settings' })).rejects.toBe(error)
    expect(window.loadFile).not.toHaveBeenCalled()
  })
})
