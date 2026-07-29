import type {
  AnalysisMode,
  AppSettings,
  CodeResponseStyle,
  HistorySummary,
  LocalHistoryRecord,
  ProviderId,
  ProviderStatus,
  StreamEvent,
  ThemeColor
} from '@haired/contracts'

export interface BootstrapData {
  appVersion: string
  platform: 'darwin' | 'win32'
  settings: AppSettings
  shortcuts: Record<'instant' | 'ask' | 'settings', boolean>
  providers: ProviderStatus[]
  historyBytes: number
  privacy: {
    label: string
    tone: 'protected' | 'best-effort'
    screenPermission: string
  }
}

type IpcResult<T> = Promise<{ ok: true; data: T } | { ok: false; error: string }>
type Unsubscribe = () => void

export interface HairedApi {
  getBootstrap(): IpcResult<BootstrapData>
  quit(): IpcResult<unknown>
  updateSettings(patch: Partial<AppSettings>): IpcResult<{
    settings: AppSettings
    shortcuts: Record<'instant' | 'ask' | 'settings', boolean>
  }>
  startCapture(mode: 'instant' | 'ask'): IpcResult<unknown>
  completeSelection(input: {
    region: { x: number; y: number; width: number; height: number }
    prompt?: string
  }): IpcResult<{ id: string }>
  cancelSelection(): IpcResult<unknown>
  refreshProviders(): IpcResult<ProviderStatus[]>
  updateProvider(
    provider: ProviderId,
    patch: Record<string, string | boolean>
  ): IpcResult<{ settings: AppSettings; providers: ProviderStatus[] }>
  selectProvider(
    provider: ProviderId
  ): IpcResult<{ settings: AppSettings; providers: ProviderStatus[] }>
  setProviderKey(provider: ProviderId, key: string): IpcResult<ProviderStatus[]>
  clearProviderKey(provider: ProviderId): IpcResult<ProviderStatus[]>
  listHistory(search: string): IpcResult<HistorySummary[]>
  getHistory(id: string): IpcResult<LocalHistoryRecord | null>
  deleteHistory(id: string): IpcResult<boolean>
  clearHistory(): IpcResult<boolean>
  exportHistory(id: string): IpcResult<boolean>
  setHistoryCodeResponseStyle(
    id: string,
    style: CodeResponseStyle
  ): IpcResult<CodeResponseStyle>
  rerunHistory(id: string): IpcResult<{ id: string }>
  copyOverlay(id: string): IpcResult<unknown>
  exportOverlay(id: string): IpcResult<unknown>
  pinOverlay(id: string, pinned: boolean): IpcResult<boolean>
  setOverlayCodeResponseStyle(
    id: string,
    style: CodeResponseStyle
  ): IpcResult<CodeResponseStyle>
  setOverlayColumnCount(
    id: string,
    columnCount: number
  ): IpcResult<{ x: number; y: number; width: number; height: number }>
  closeOverlay(id: string): IpcResult<unknown>
  followUp(id: string, prompt: string): IpcResult<unknown>
  runPrivacyDiagnostic(): IpcResult<{
    verdict: 'passed' | 'best-effort' | 'failed'
    detail: string
  }>
  openScreenPermission(): IpcResult<unknown>
  onSettingsNavigate(listener: (page: string) => void): Unsubscribe
  onThemeChanged(listener: (theme: ThemeColor) => void): Unsubscribe
  onOverlayInit(listener: (payload: {
    id: string
    question: string
    mode: AnalysisMode
    codeResponseStyle: CodeResponseStyle
    columnWidth: number
    magnifyingGlassCursor: boolean
  }) => void): Unsubscribe
  onOverlayEvent(listener: (payload: StreamEvent) => void): Unsubscribe
  onOverlayReset(listener: (payload: {
    question: string
    codeResponseStyle: CodeResponseStyle
  }) => void): Unsubscribe
  onMagnifyingGlassCursorChanged(listener: (enabled: boolean) => void): Unsubscribe
}

declare global {
  interface Window {
    haired?: HairedApi
  }
}
