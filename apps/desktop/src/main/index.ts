import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import {
  app,
  clipboard,
  desktopCapturer,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  shell,
  systemPreferences,
  type BrowserWindow,
  type Rectangle
} from 'electron'
import {
  appSettingsSchema,
  captureRegionSchema,
  providerIdSchema,
  type AnalysisMetadata,
  type AnalysisMode,
  type AppSettings,
  type CaptureRegion,
  type StreamEvent
} from '@haired/contracts'
import {
  captureDisplayAtPointer,
  cropCapture,
  type CapturedDisplay
} from './capture'
import { HistoryVault } from './history'
import { isTrustedRendererUrl } from './ipc-trust'
import { ProviderManager } from './provider-manager'
import { prepareRelaunchEnvironment } from './relaunch'
import { ProtectedFile } from './secure-storage'
import { SettingsStore } from './settings-store'
import { configureUpdates, setUpdateBusy } from './updater'
import { createProtectedWindow, loadRenderer } from './windows'

type CaptureMode = 'instant' | 'ask'

interface CaptureSession {
  capture: CapturedDisplay
  mode: CaptureMode
  window: BrowserWindow
}

interface OverlaySession {
  id: string
  window: BrowserWindow
  image: Buffer
  mode: AnalysisMode
  question: string
  answer: string
  pinned: boolean
  conversation: Array<{ role: 'user' | 'assistant'; content: string }>
  controller: AbortController | null
  provider?: string
  model?: string
  interaction: CaptureMode
}

const singleInstance = app.requestSingleInstanceLock()
if (!singleInstance) {
  app.quit()
}

let quitting = false
let settingsWindow: BrowserWindow | null = null
let captureSession: CaptureSession | null = null
let captureStarting = false
let captureFailureDialogOpen = false
let activeOverlayId: string | null = null
let busyOperations = 0
let settingsStore: SettingsStore
let historyVault: HistoryVault
let providerManager: ProviderManager
const overlays = new Map<string, OverlaySession>()
let shortcutState: Record<'instant' | 'ask' | 'settings', boolean> = {
  instant: false,
  ask: false,
  settings: false
}

function preloadPath(): string {
  return path.join(__dirname, '../preload/index.cjs')
}

function applyLaunchAtLogin(openAtLogin: boolean): void {
  if (!app.isPackaged) return
  app.setLoginItemSettings({ openAtLogin })
}

function rendererFilePath(): string {
  return path.join(__dirname, '../renderer/index.html')
}

function assertTrustedSender(event: Electron.IpcMainInvokeEvent): void {
  let webContentsUrl = ''
  try {
    webContentsUrl = event.sender.getURL()
  } catch {
    // A destroyed sender cannot be trusted.
  }
  const senderUrls = [event.senderFrame?.url, webContentsUrl].filter(
    (value): value is string => Boolean(value)
  )
  const trusted = senderUrls.some((senderUrl) =>
    isTrustedRendererUrl(
      senderUrl,
      rendererFilePath(),
      process.env.ELECTRON_RENDERER_URL
    )
  )
  if (!trusted) {
    throw new Error('Untrusted renderer request')
  }
}

function handle(
  channel: string,
  listener: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => Promise<unknown> | unknown
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    assertTrustedSender(event)
    try {
      return { ok: true, data: await listener(event, ...args) }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message.slice(0, 500) : 'Unexpected error'
      }
    }
  })
}

function markBusy(): () => void {
  busyOperations += 1
  setUpdateBusy(true)
  return () => {
    busyOperations = Math.max(0, busyOperations - 1)
    setUpdateBusy(busyOperations > 0)
  }
}

async function showSettings(page = 'providers'): Promise<void> {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show()
    settingsWindow.focus()
    settingsWindow.webContents.send('settings:navigate', page)
    return
  }
  const window = createProtectedWindow({
    kind: 'settings',
    preload: preloadPath(),
    bounds: { x: 0, y: 0, width: 1120, height: 760 }
  })
  settingsWindow = window
  window.setTitle('Haired Settings')
  window.setMinimumSize(880, 620)
  window.center()
  window.on('close', (event) => {
    if (!quitting) {
      event.preventDefault()
      window.hide()
    }
  })
  window.on('closed', () => {
    if (settingsWindow === window) settingsWindow = null
  })
  window.once('ready-to-show', () => window.show())
  await loadRenderer(window, { kind: 'settings', page })
}

function closeCaptureSession(): void {
  const session = captureSession
  captureSession = null
  if (session?.window && !session.window.isDestroyed()) session.window.destroy()
}

async function startCapture(mode: CaptureMode): Promise<void> {
  if (captureStarting) return
  captureStarting = true
  closeCaptureSession()
  try {
    const capture = await captureDisplayAtPointer()
    const window = createProtectedWindow({
      kind: 'selector',
      preload: preloadPath(),
      bounds: capture.display.bounds
    })
    captureSession = { capture, mode, window }
    window.setTitle('Haired Selection')
    window.setResizable(false)
    window.setMovable(false)
    window.on('closed', () => {
      if (captureSession?.window === window) captureSession = null
    })
    await loadRenderer(window, { kind: 'selector', mode })
    window.showInactive()
  } finally {
    captureStarting = false
  }
}

async function openScreenRecordingSettings(): Promise<void> {
  if (process.platform !== 'darwin') return
  await shell.openExternal(
    'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
  )
}

async function reportShortcutCaptureFailure(error: unknown): Promise<void> {
  if (captureFailureDialogOpen) return
  captureFailureDialogOpen = true
  try {
    closeCaptureSession()
    const isMac = process.platform === 'darwin'
    const permission = isMac ? systemPreferences.getMediaAccessStatus('screen') : 'unknown'
    try {
      await showSettings(isMac ? 'privacy' : 'shortcuts')
    } catch {
      // The native dialog below still gives the user a recovery path.
    }

    const permissionBlocked =
      isMac &&
      (permission === 'denied' ||
        permission === 'restricted' ||
        permission === 'not-determined')
    const buttons = !isMac
      ? ['OK']
      : permissionBlocked
        ? ['Open Screen Recording Settings', 'Restart Haired', 'Cancel']
        : ['Restart Haired', 'Open Screen Recording Settings', 'Cancel']
    const options = {
      type: 'warning' as const,
      title: 'Screen capture unavailable',
      message: !isMac
        ? 'Haired could not start screen capture.'
        : permissionBlocked
          ? 'Allow Haired to capture the screen, then restart it.'
          : 'Restart Haired to finish enabling screen capture.',
      detail: !isMac
        ? error instanceof Error
          ? error.message
          : 'The operating system did not provide a display source.'
        : permissionBlocked
          ? 'Open macOS System Settings and enable Haired—or Electron while running the development build—under Privacy & Security → Screen & System Audio Recording.'
          : `${error instanceof Error ? error.message : 'Screen capture could not start'} macOS applies screen-capture permission changes only after the app restarts. If it still fails after restarting, reopen Screen Recording Settings and toggle access off and on.`,
      buttons,
      defaultId: 0,
      cancelId: isMac ? 2 : 0,
      noLink: true
    }
    const result =
      settingsWindow && !settingsWindow.isDestroyed()
        ? await dialog.showMessageBox(settingsWindow, options)
        : await dialog.showMessageBox(options)
    if (isMac) {
      const restartResponse = permissionBlocked ? 1 : 0
      const settingsResponse = permissionBlocked ? 0 : 1
      if (result.response === settingsResponse) {
        await openScreenRecordingSettings()
      } else if (result.response === restartResponse) {
        quitting = true
        prepareRelaunchEnvironment(app.isPackaged)
        app.relaunch()
        app.quit()
      }
    }
  } finally {
    captureFailureDialogOpen = false
  }
}

function startCaptureFromShortcut(mode: CaptureMode): void {
  void startCapture(mode).catch((error) => {
    void reportShortcutCaptureFailure(error).catch((reportError) => {
      console.error('Unable to report screen capture failure', reportError)
    })
  })
}

function overlayBounds(displayBounds: Rectangle, region: CaptureRegion): Rectangle {
  const width = Math.min(580, Math.max(440, displayBounds.width * 0.38))
  const height = Math.min(610, Math.max(390, displayBounds.height * 0.58))
  const preferredRight = displayBounds.x + region.x + region.width + 16
  const preferredBelow = displayBounds.y + region.y + region.height + 16
  const x =
    preferredRight + width <= displayBounds.x + displayBounds.width
      ? preferredRight
      : Math.max(displayBounds.x + 16, displayBounds.x + region.x - width - 16)
  const y =
    displayBounds.y + region.y + height <= displayBounds.y + displayBounds.height
      ? displayBounds.y + region.y
      : Math.max(
          displayBounds.y + 16,
          Math.min(preferredBelow, displayBounds.y + displayBounds.height - height - 16)
        )
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) }
}

function closeUnpinnedOverlays(): void {
  for (const [id, overlay] of overlays) {
    if (!overlay.pinned) closeOverlay(id)
  }
}

function closeOverlay(id: string): void {
  const overlay = overlays.get(id)
  if (!overlay) return
  overlay.controller?.abort()
  if (!overlay.window.isDestroyed()) overlay.window.destroy()
  overlays.delete(id)
  if (activeOverlayId === id) activeOverlayId = null
}

async function createOverlay(input: {
  capture: CapturedDisplay
  region: CaptureRegion
  image: Buffer
  question: string
  mode: AnalysisMode
  interaction?: CaptureMode
  conversation?: OverlaySession['conversation']
}): Promise<OverlaySession> {
  closeUnpinnedOverlays()
  if (activeOverlayId) {
    const active = overlays.get(activeOverlayId)
    if (active?.pinned) {
      active.controller?.abort()
      active.controller = null
      activeOverlayId = null
    }
  }
  const id = randomUUID()
  const window = createProtectedWindow({
    kind: 'overlay',
    preload: preloadPath(),
    bounds: overlayBounds(input.capture.display.bounds, input.region),
    query: {}
  })
  const overlay: OverlaySession = {
    id,
    window,
    image: input.image,
    mode: input.mode,
    question: input.question,
    answer: '',
    pinned: false,
    interaction: input.interaction ?? 'ask',
    conversation: input.conversation ?? [],
    controller: null
  }
  overlays.set(id, overlay)
  activeOverlayId = id
  window.setTitle('Haired Answer')
  window.on('closed', () => {
    overlay.controller?.abort()
    overlays.delete(id)
    if (activeOverlayId === id) activeOverlayId = null
  })
  window.once('ready-to-show', () => {
    window.showInactive()
    window.webContents.send('overlay:init', {
      id,
      question: input.question,
      mode: input.mode
    })
  })
  const opacity = (await settingsStore.load()).overlayOpacity
  await loadRenderer(window, { kind: 'overlay', id, opacity: String(opacity) })
  return overlay
}

async function streamOverlay(overlay: OverlaySession): Promise<void> {
  overlay.controller?.abort()
  const controller = new AbortController()
  overlay.controller = controller
  overlay.answer = ''
  const metadata: AnalysisMetadata = {
    requestId: randomUUID(),
    mode: overlay.mode,
    interaction: overlay.interaction,
    prompt: overlay.question,
    conversation: overlay.conversation
  }
  const finishBusy = markBusy()
  let completed = false
  const send = (event: StreamEvent): void => {
    if (overlay.window.isDestroyed()) return
    if (event.type === 'delta') overlay.answer += event.text
    if (event.type === 'usage') {
      overlay.provider = event.provider
      overlay.model = event.model
    }
    if (event.type === 'completed') completed = true
    overlay.window.webContents.send('overlay:event', event)
  }
  try {
    await providerManager.analyze({
      image: overlay.image,
      metadata,
      onEvent: send,
      signal: controller.signal
    })
    if (completed && overlay.answer.trim()) {
      await historyVault.add({
        mode: overlay.mode,
        title: overlay.question.trim().slice(0, 72) || 'Screen analysis',
        question: overlay.question,
        answer: overlay.answer,
        screenshot: overlay.image,
        ...(overlay.provider ? { provider: overlay.provider } : {}),
        ...(overlay.model ? { model: overlay.model } : {})
      })
    }
  } catch (error) {
    if (!controller.signal.aborted) {
      send({
        type: 'error',
        code: 'provider_unavailable',
        message: error instanceof Error ? error.message : 'Analysis failed',
        retryable: true
      })
    }
  } finally {
    if (overlay.controller === controller) overlay.controller = null
    finishBusy()
  }
}

async function completeSelection(raw: unknown): Promise<{ id: string }> {
  if (!captureSession) throw new Error('Selection session is no longer active')
  const input = raw as { region?: unknown; prompt?: unknown }
  const region = captureRegionSchema.parse(input.region)
  const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : ''
  const { capture, mode } = captureSession
  closeCaptureSession()
  const settings = await settingsStore.load()
  const image = cropCapture(capture, region)
  const question =
    mode === 'instant'
      ? settings.defaultInstruction
      : prompt || 'Explain and answer what is shown in this selected screen region.'
  const overlay = await createOverlay({
    capture,
    region,
    image,
    question,
    mode: settings.defaultMode,
    interaction: mode
  })
  void streamOverlay(overlay)
  return { id: overlay.id }
}

function registerShortcuts(settings: AppSettings): typeof shortcutState {
  globalShortcut.unregisterAll()
  const entries: Array<[keyof typeof shortcutState, string, () => void]> = [
    ['instant', settings.shortcuts.instant, () => startCaptureFromShortcut('instant')],
    ['ask', settings.shortcuts.ask, () => startCaptureFromShortcut('ask')],
    ['settings', settings.shortcuts.settings, () => void showSettings()]
  ]
  shortcutState = { instant: false, ask: false, settings: false }
  for (const [name, accelerator, action] of entries) {
    try {
      shortcutState[name] = globalShortcut.register(accelerator, action)
    } catch {
      shortcutState[name] = false
    }
  }
  return shortcutState
}

async function bootstrapData(): Promise<unknown> {
  const settings = await settingsStore.load()
  return {
    appVersion: app.getVersion(),
    platform: process.platform,
    settings,
    shortcuts: shortcutState,
    providers: await providerManager.statuses(),
    historyBytes: historyVault.storageBytes(),
    privacy: {
      label: process.platform === 'win32' ? 'Protected on Windows' : 'Best effort on macOS',
      tone: process.platform === 'win32' ? 'protected' : 'best-effort',
      screenPermission:
        process.platform === 'darwin'
          ? systemPreferences.getMediaAccessStatus('screen')
          : 'granted'
    }
  }
}

async function runPrivacyDiagnostic(): Promise<{
  verdict: 'passed' | 'best-effort' | 'failed'
  detail: string
}> {
  if (process.platform === 'darwin') {
    return {
      verdict: 'best-effort',
      detail:
        'macOS protection is best effort. Confirm the result in the meeting app share preview before presenting.'
    }
  }
  const sources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: { width: 320, height: 180 }
  })
  const exposed = sources.some((source) => source.name.startsWith('Haired'))
  return exposed
    ? {
        verdict: 'failed',
        detail:
          'The OS window-source list exposed a Haired window. Do not share until you verify the supported meeting paths.'
      }
    : {
        verdict: 'passed',
        detail:
          'The Windows capture stack excluded Haired windows in this diagnostic. This is evidence, not a universal guarantee.'
      }
}

function registerIpc(): void {
  handle('app:bootstrap', () => bootstrapData())
  handle('app:quit', () => {
    quitting = true
    app.quit()
  })
  handle('settings:update', async (_event, raw) => {
    const current = await settingsStore.load()
    const next = appSettingsSchema.parse({
      ...current,
      ...(raw as object),
      shortcuts: { ...current.shortcuts, ...((raw as any)?.shortcuts ?? {}) }
    })
    const settings = await settingsStore.update(next)
    historyVault.pruneOlderThan(settings.historyAutoDeleteDays)
    applyLaunchAtLogin(settings.launchAtLogin)
    return { settings, shortcuts: registerShortcuts(settings) }
  })
  handle('providers:refresh', () => providerManager.statuses())
  handle('providers:update', async (_event, rawProvider, rawPatch) => {
    const provider = providerIdSchema.parse(rawProvider)
    const current = await settingsStore.load()
    const patch =
      rawPatch && typeof rawPatch === 'object'
        ? (rawPatch as Record<string, unknown>)
        : {}
    const providers = {
      ...current.providers,
      [provider]: {
        ...current.providers[provider],
        ...patch
      }
    }
    const settings = await settingsStore.update({ providers })
    return { settings, providers: await providerManager.statuses() }
  })
  handle('providers:select', async (_event, rawProvider) => {
    const provider = providerIdSchema.parse(rawProvider)
    const current = await settingsStore.load()
    const settings = await settingsStore.update({
      providers: { ...current.providers, selected: provider }
    })
    return { settings, providers: await providerManager.statuses() }
  })
  handle('providers:set-key', async (_event, provider, key) => {
    await providerManager.setApiKey(provider, key)
    return providerManager.statuses()
  })
  handle('providers:clear-key', async (_event, provider) => {
    await providerManager.clearApiKey(provider)
    return providerManager.statuses()
  })
  handle('capture:complete', (_event, input) => completeSelection(input))
  handle('capture:cancel', () => closeCaptureSession())
  handle('capture:start', (_event, mode) => startCapture(mode === 'ask' ? 'ask' : 'instant'))
  handle('history:list', (_event, search) =>
    historyVault.list(typeof search === 'string' ? search : '')
  )
  handle('history:get', (_event, id) =>
    typeof id === 'string' ? historyVault.get(id) : null
  )
  handle('history:delete', (_event, id) => {
    if (typeof id !== 'string') throw new Error('Invalid history item')
    return historyVault.delete(id)
  })
  handle('history:clear', async () => {
    const finishBusy = markBusy()
    try {
      await historyVault.clear()
      return true
    } finally {
      finishBusy()
    }
  })
  handle('history:export', async (_event, id) => {
    if (typeof id !== 'string') throw new Error('Invalid history item')
    const result = await dialog.showSaveDialog({
      title: 'Export Haired answer',
      defaultPath: `haired-answer-${id.slice(0, 8)}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })
    if (result.canceled || !result.filePath) return false
    const finishBusy = markBusy()
    try {
      await historyVault.export(id, result.filePath)
      return true
    } finally {
      finishBusy()
    }
  })
  handle('history:rerun', async (_event, id) => {
    if (typeof id !== 'string') throw new Error('Invalid history item')
    const record = historyVault.get(id)
    if (!record) throw new Error('History item was not found')
    const image = Buffer.from(record.screenshotDataUrl.split(',')[1] ?? '', 'base64')
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    const overlay = await createOverlay({
      capture: { display, image: nativeImage.createFromBuffer(image) },
      region: {
        x: Math.round(display.bounds.width * 0.25),
        y: Math.round(display.bounds.height * 0.2),
        width: Math.round(display.bounds.width * 0.5),
        height: Math.round(display.bounds.height * 0.35)
      },
      image,
      question: record.question,
      mode: record.mode
    })
    void streamOverlay(overlay)
    return { id: overlay.id }
  })
  handle('overlay:copy', (_event, id) => {
    const overlay = typeof id === 'string' ? overlays.get(id) : undefined
    if (!overlay) throw new Error('Answer is no longer available')
    clipboard.writeText(overlay.answer)
    return true
  })
  handle('overlay:export', async (_event, id) => {
    const overlay = typeof id === 'string' ? overlays.get(id) : undefined
    if (!overlay) throw new Error('Answer is no longer available')
    const result = await dialog.showSaveDialog({
      title: 'Export Haired answer',
      defaultPath: `haired-answer-${id.slice(0, 8)}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })
    if (result.canceled || !result.filePath) return false
    const finishBusy = markBusy()
    try {
      const markdown = [
        '# Haired answer',
        '',
        '## Question',
        '',
        overlay.question,
        '',
        '## Answer',
        '',
        overlay.answer,
        ''
      ].join('\n')
      await writeFile(result.filePath, markdown, { mode: 0o600 })
      return true
    } finally {
      finishBusy()
    }
  })
  handle('overlay:pin', (_event, id, pinned) => {
    const overlay = typeof id === 'string' ? overlays.get(id) : undefined
    if (!overlay) throw new Error('Answer is no longer available')
    if (Boolean(pinned) && !overlay.pinned) {
      const pinnedCount = [...overlays.values()].filter((item) => item.pinned).length
      if (pinnedCount >= 3) throw new Error('You can pin up to three answers')
    }
    overlay.pinned = Boolean(pinned)
    return overlay.pinned
  })
  handle('overlay:close', (_event, id) => {
    if (typeof id === 'string') closeOverlay(id)
    return true
  })
  handle('overlay:follow-up', async (_event, id, rawPrompt) => {
    const overlay = typeof id === 'string' ? overlays.get(id) : undefined
    const prompt = typeof rawPrompt === 'string' ? rawPrompt.trim() : ''
    if (!overlay || !prompt) throw new Error('Enter a follow-up question')
    const nextConversation: OverlaySession['conversation'] = [
      ...overlay.conversation,
      { role: 'user', content: overlay.question },
      { role: 'assistant', content: overlay.answer }
    ]
    overlay.conversation = nextConversation.slice(-20)
    overlay.question = prompt
    overlay.interaction = 'ask'
    overlay.answer = ''
    overlay.window.webContents.send('overlay:reset', { question: prompt })
    void streamOverlay(overlay)
    return true
  })
  handle('privacy:diagnostic', () => runPrivacyDiagnostic())
  handle('privacy:open-permission', async () => {
    await openScreenRecordingSettings()
    return true
  })
}

app.on('second-instance', () => void showSettings())

app.whenReady().then(async () => {
  if (process.platform === 'darwin') app.dock?.hide()
  app.setName('Haired')
  Menu.setApplicationMenu(null)
  const userData = app.getPath('userData')
  settingsStore = new SettingsStore(path.join(userData, 'settings.json'))
  historyVault = new HistoryVault(
    path.join(userData, 'history.sqlite3'),
    path.join(userData, 'history-key.bin')
  )
  providerManager = new ProviderManager(
    settingsStore,
    new ProtectedFile(path.join(userData, 'provider-secrets.bin'))
  )
  await historyVault.initialize()
  registerIpc()
  const settings = await settingsStore.load()
  historyVault.pruneOlderThan(settings.historyAutoDeleteDays)
  registerShortcuts(settings)
  applyLaunchAtLogin(settings.launchAtLogin)
  configureUpdates()
  const hasReadyProvider = (await providerManager.statuses()).some(
    (provider) => provider.selected && provider.ready
  )
  if (!app.isPackaged || !app.getLoginItemSettings().wasOpenedAtLogin || !hasReadyProvider) {
    await showSettings()
  }
})

app.on('activate', () => void showSettings())
app.on('will-quit', () => {
  quitting = true
  globalShortcut.unregisterAll()
  for (const overlay of overlays.values()) overlay.controller?.abort()
  historyVault?.close()
})
app.on('window-all-closed', () => {
  // Haired intentionally remains available through global shortcuts.
})
