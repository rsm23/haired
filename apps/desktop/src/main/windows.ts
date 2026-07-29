import path from 'node:path'
import {
  BrowserWindow,
  shell,
  type BrowserWindowConstructorOptions,
  type Rectangle
} from 'electron'

export type HairedWindowKind = 'settings' | 'selector' | 'overlay'

function safeExternalUrl(value: string): boolean {
  try {
    const url = new URL(value)
    const configuredHost = (() => {
      try {
        return import.meta.env.VITE_PUBLIC_APP_URL
          ? new URL(import.meta.env.VITE_PUBLIC_APP_URL).host
          : ''
      } catch {
        return ''
      }
    })()
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      Boolean(configuredHost) &&
      url.host === configuredHost
    )
  } catch {
    return false
  }
}

export function createProtectedWindow(input: {
  kind: HairedWindowKind
  query?: Record<string, string>
  bounds?: Rectangle
  preload: string
}): BrowserWindow {
  const common: BrowserWindowConstructorOptions = {
    show: false,
    skipTaskbar: true,
    frame: input.kind === 'settings',
    transparent: input.kind !== 'settings',
    backgroundColor: input.kind === 'settings' ? '#ffffff' : '#00000000',
    resizable: input.kind === 'settings',
    minimizable: false,
    maximizable: input.kind === 'settings',
    fullscreenable: false,
    hasShadow: input.kind !== 'selector',
    ...(input.bounds ?? {}),
    webPreferences: {
      preload: input.preload,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: !process.env.NODE_ENV || process.env.NODE_ENV !== 'production'
    }
  }
  const window = new BrowserWindow(common)
  window.setContentProtection(true)
  window.setSkipTaskbar(true)
  if (input.kind !== 'settings') {
    window.setAlwaysOnTop(true, process.platform === 'darwin' ? 'screen-saver' : 'pop-up-menu')
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (safeExternalUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  return window
}

export async function loadRenderer(
  window: BrowserWindow,
  query: Record<string, string>
): Promise<void> {
  if (process.env.ELECTRON_RENDERER_URL) {
    const url = new URL(process.env.ELECTRON_RENDERER_URL)
    Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value))
    try {
      await window.loadURL(url.toString())
      return
    } catch (error) {
      if (process.env.NODE_ENV_ELECTRON_VITE !== 'development') throw error
      delete process.env.ELECTRON_RENDERER_URL
      console.warn('Development renderer unavailable; loading the local renderer bundle.')
    }
  }
  await window.loadFile(path.join(__dirname, '../renderer/index.html'), { query })
}
