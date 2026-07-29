import { contextBridge, ipcRenderer } from 'electron'

type Result<T> = Promise<{ ok: true; data: T } | { ok: false; error: string }>
type Unsubscribe = () => void

function subscribe(channel: string, listener: (payload: unknown) => void): Unsubscribe {
  const wrapped = (_event: Electron.IpcRendererEvent, payload: unknown): void => listener(payload)
  ipcRenderer.on(channel, wrapped)
  return () => ipcRenderer.removeListener(channel, wrapped)
}

const api = {
  getBootstrap: (): Result<unknown> => ipcRenderer.invoke('app:bootstrap'),
  quit: (): Result<unknown> => ipcRenderer.invoke('app:quit'),
  updateSettings: (patch: unknown): Result<unknown> =>
    ipcRenderer.invoke('settings:update', patch),
  startCapture: (mode: 'instant' | 'ask'): Result<unknown> =>
    ipcRenderer.invoke('capture:start', mode),
  completeSelection: (input: unknown): Result<unknown> =>
    ipcRenderer.invoke('capture:complete', input),
  cancelSelection: (): Result<unknown> => ipcRenderer.invoke('capture:cancel'),
  refreshProviders: (): Result<unknown> => ipcRenderer.invoke('providers:refresh'),
  updateProvider: (provider: string, patch: unknown): Result<unknown> =>
    ipcRenderer.invoke('providers:update', provider, patch),
  selectProvider: (provider: string): Result<unknown> =>
    ipcRenderer.invoke('providers:select', provider),
  setProviderKey: (provider: string, key: string): Result<unknown> =>
    ipcRenderer.invoke('providers:set-key', provider, key),
  clearProviderKey: (provider: string): Result<unknown> =>
    ipcRenderer.invoke('providers:clear-key', provider),
  listHistory: (search: string): Result<unknown> =>
    ipcRenderer.invoke('history:list', search),
  getHistory: (id: string): Result<unknown> => ipcRenderer.invoke('history:get', id),
  deleteHistory: (id: string): Result<unknown> =>
    ipcRenderer.invoke('history:delete', id),
  clearHistory: (): Result<unknown> => ipcRenderer.invoke('history:clear'),
  exportHistory: (id: string): Result<unknown> =>
    ipcRenderer.invoke('history:export', id),
  setHistoryCodeResponseStyle: (id: string, style: string): Result<unknown> =>
    ipcRenderer.invoke('history:set-code-response-style', id, style),
  rerunHistory: (id: string): Result<unknown> => ipcRenderer.invoke('history:rerun', id),
  copyOverlay: (id: string): Result<unknown> => ipcRenderer.invoke('overlay:copy', id),
  exportOverlay: (id: string): Result<unknown> => ipcRenderer.invoke('overlay:export', id),
  pinOverlay: (id: string, pinned: boolean): Result<unknown> =>
    ipcRenderer.invoke('overlay:pin', id, pinned),
  setOverlayCodeResponseStyle: (id: string, style: string): Result<unknown> =>
    ipcRenderer.invoke('overlay:set-code-response-style', id, style),
  setOverlayColumnCount: (id: string, columnCount: number): Result<unknown> =>
    ipcRenderer.invoke('overlay:set-column-count', id, columnCount),
  closeOverlay: (id: string): Result<unknown> => ipcRenderer.invoke('overlay:close', id),
  followUp: (id: string, prompt: string): Result<unknown> =>
    ipcRenderer.invoke('overlay:follow-up', id, prompt),
  runPrivacyDiagnostic: (): Result<unknown> => ipcRenderer.invoke('privacy:diagnostic'),
  openScreenPermission: (): Result<unknown> =>
    ipcRenderer.invoke('privacy:open-permission'),
  onSettingsNavigate: (listener: (payload: unknown) => void): Unsubscribe =>
    subscribe('settings:navigate', listener),
  onThemeChanged: (listener: (payload: unknown) => void): Unsubscribe =>
    subscribe('theme:changed', listener),
  onOverlayInit: (listener: (payload: unknown) => void): Unsubscribe =>
    subscribe('overlay:init', listener),
  onOverlayEvent: (listener: (payload: unknown) => void): Unsubscribe =>
    subscribe('overlay:event', listener),
  onOverlayReset: (listener: (payload: unknown) => void): Unsubscribe =>
    subscribe('overlay:reset', listener),
  onMagnifyingGlassCursorChanged: (listener: (payload: unknown) => void): Unsubscribe =>
    subscribe('overlay:magnifying-glass-cursor-changed', listener)
}

contextBridge.exposeInMainWorld('haired', Object.freeze(api))
