import {
  useEffect,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react'
import {
  AlertCircle,
  ArrowRight,
  Cable,
  ChevronRight,
  CircleCheck,
  CircleOff,
  CircleHelp,
  Command,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileText,
  HardDrive,
  History,
  LogOut,
  MoreHorizontal,
  Pin,
  Play,
  Plus,
  RotateCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  X,
  Zap
} from 'lucide-react'
import anthropicLogo from '@lobehub/icons-static-svg/icons/anthropic.svg'
import claudeLogo from '@lobehub/icons-static-svg/icons/claudecode-color.svg'
import codexLogo from '@lobehub/icons-static-svg/icons/codex-color.svg'
import geminiLogo from '@lobehub/icons-static-svg/icons/gemini-color.svg'
import mistralLogo from '@lobehub/icons-static-svg/icons/mistral-color.svg'
import openAiLogo from '@lobehub/icons-static-svg/icons/openai.svg'
import openRouterLogo from '@lobehub/icons-static-svg/icons/openrouter-color.svg'
import { toast } from 'sonner'
import type {
  AnalysisMode,
  AppSettings,
  CliReasoningSetting,
  HistorySummary,
  LocalHistoryRecord,
  ProviderId,
  ReasoningEffort,
  StreamEvent
} from '@haired/contracts'
import {
  Alert,
  AlertDescription,
  AlertTitle
} from '@/components/ui/alert'
import { MarkdownAnswer } from '@/components/markdown-answer'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@/components/ui/empty'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from '@/components/ui/input-group'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Toaster } from '@/components/ui/sonner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { BootstrapData, HairedApi } from './global'

type Page = 'providers' | 'shortcuts' | 'appearance' | 'privacy' | 'history'
type ShortcutId = keyof AppSettings['shortcuts']
type Point = { x: number; y: number }
type Selection = { x: number; y: number; width: number; height: number }

const bridgeError =
  'The secure desktop bridge is unavailable. Open this screen from the installed Haired app.'

const unavailableApi: HairedApi = {
  getBootstrap: async () => ({ ok: false, error: bridgeError }),
  quit: async () => ({ ok: false, error: bridgeError }),
  updateSettings: async () => ({ ok: false, error: bridgeError }),
  startCapture: async () => ({ ok: false, error: bridgeError }),
  completeSelection: async () => ({ ok: false, error: bridgeError }),
  cancelSelection: async () => ({ ok: false, error: bridgeError }),
  refreshProviders: async () => ({ ok: false, error: bridgeError }),
  updateProvider: async () => ({ ok: false, error: bridgeError }),
  selectProvider: async () => ({ ok: false, error: bridgeError }),
  setProviderKey: async () => ({ ok: false, error: bridgeError }),
  clearProviderKey: async () => ({ ok: false, error: bridgeError }),
  listHistory: async () => ({ ok: false, error: bridgeError }),
  getHistory: async () => ({ ok: false, error: bridgeError }),
  deleteHistory: async () => ({ ok: false, error: bridgeError }),
  clearHistory: async () => ({ ok: false, error: bridgeError }),
  exportHistory: async () => ({ ok: false, error: bridgeError }),
  rerunHistory: async () => ({ ok: false, error: bridgeError }),
  copyOverlay: async () => ({ ok: false, error: bridgeError }),
  exportOverlay: async () => ({ ok: false, error: bridgeError }),
  pinOverlay: async () => ({ ok: false, error: bridgeError }),
  closeOverlay: async () => ({ ok: false, error: bridgeError }),
  followUp: async () => ({ ok: false, error: bridgeError }),
  runPrivacyDiagnostic: async () => ({ ok: false, error: bridgeError }),
  openScreenPermission: async () => ({ ok: false, error: bridgeError }),
  onSettingsNavigate: () => () => undefined,
  onOverlayInit: () => () => undefined,
  onOverlayEvent: () => () => undefined,
  onOverlayReset: () => () => undefined
}

const api = window.haired ?? unavailableApi

const providerLogos: Record<ProviderId, string> = {
  codex: codexLogo,
  claude: claudeLogo,
  openai: openAiLogo,
  anthropic: anthropicLogo,
  gemini: geminiLogo,
  mistral: mistralLogo,
  'openai-compatible': openRouterLogo
}

function providerStateLabel(provider: BootstrapData['providers'][number]): string {
  if (!provider.enabled) return 'Not activated'
  if (provider.ready) return 'Ready'
  if (provider.kind === 'cli' && !provider.installed) return 'CLI not found'
  return 'Needs setup'
}

const reasoningLabels: Record<CliReasoningSetting, string> = {
  auto: 'Follow answer mode',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
  max: 'Maximum',
  ultra: 'Ultra'
}

function reasoningOptions(
  provider: BootstrapData['providers'][number],
  current: CliReasoningSetting
): CliReasoningSetting[] {
  const supported = provider.reasoningEfforts ?? []
  const options: CliReasoningSetting[] = ['auto', ...supported]
  if (current !== 'auto' && !supported.includes(current as ReasoningEffort)) {
    options.push(current)
  }
  return options
}

function ProviderLogo({ id, name }: { id: ProviderId; name: string }) {
  return (
    <span className={cn('provider-logo', `provider-logo-${id}`)}>
      <img src={providerLogos[id]} alt={`${name} logo`} />
    </span>
  )
}

async function unwrap<T>(
  result: Awaited<ReturnType<() => Promise<{ ok: true; data: T } | { ok: false; error: string }>>>
): Promise<T> {
  if (!result.ok) throw new Error(result.error)
  return result.data
}

export default function App() {
  const params = new URLSearchParams(window.location.search)
  const kind = params.get('kind') ?? 'settings'

  let surface
  if (!window.haired) {
    surface = <BridgeUnavailable />
  } else if (kind === 'selector') {
    surface = <Selector mode={params.get('mode') === 'ask' ? 'ask' : 'instant'} />
  } else if (kind === 'overlay') {
    surface = <AnswerOverlay id={params.get('id') ?? ''} />
  } else {
    surface = <SettingsApp initialPage={(params.get('page') as Page) || 'providers'} />
  }

  return (
    <TooltipProvider>
      {surface}
      <Toaster richColors position="top-right" />
    </TooltipProvider>
  )
}

function BridgeUnavailable() {
  return (
    <main className="state-screen">
      <Card className="state-card">
        <CardHeader>
          <Logo />
          <CardTitle>Desktop connection unavailable</CardTitle>
          <CardDescription>{bridgeError}</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>No sample data is being shown</AlertTitle>
            <AlertDescription>
              Provider credentials, settings, and history are loaded only through Haired’s
              protected desktop process.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </main>
  )
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn('brand', compact && 'brand-compact')}>
      <span className="brand-mark">
        <Sparkles />
      </span>
      <span>HAIRED</span>
    </div>
  )
}

function SettingsApp({ initialPage }: { initialPage: Page }) {
  const [page, setPage] = useState<Page>(initialPage)
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    void api
      .getBootstrap()
      .then(unwrap)
      .then(setBootstrap)
      .catch((cause) => setError(messageOf(cause)))
    return api.onSettingsNavigate((next) => setPage(next as Page))
  }, [])

  if (error) {
    return (
      <main className="state-screen">
        <Card className="state-card">
          <CardHeader>
            <Logo />
            <CardTitle>Haired could not load</CardTitle>
            <CardDescription>Its secure local state is still untouched.</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Startup failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (!bootstrap) return <SettingsSkeleton />

  const navigation: Array<{ id: Page; label: string; icon: typeof Cable }> = [
    { id: 'providers', label: 'AI providers', icon: Cable },
    { id: 'shortcuts', label: 'Shortcuts', icon: Command },
    { id: 'appearance', label: 'Appearance', icon: Sun },
    { id: 'privacy', label: 'Privacy check', icon: ShieldCheck },
    { id: 'history', label: 'History', icon: History }
  ]

  return (
    <main className="settings-shell">
      <aside className="sidebar dark">
        <Logo />
        <nav className="sidebar-nav" aria-label="Settings">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <Button
                key={item.id}
                type="button"
                variant={page === item.id ? 'secondary' : 'ghost'}
                onClick={() => setPage(item.id)}
                aria-current={page === item.id ? 'page' : undefined}
              >
                <Icon data-icon="inline-start" />
                {item.label}
              </Button>
            )
          })}
        </nav>
        <div className="sidebar-bottom">
          <Button type="button" variant="ghost" onClick={() => void api.quit()}>
            <LogOut data-icon="inline-start" />
            Quit Haired
          </Button>
          <Badge variant="outline" className="privacy-status">
            {bootstrap.privacy.tone === 'protected' ? <ShieldCheck /> : <Eye />}
            {bootstrap.privacy.label}
          </Badge>
          <span className="version">Version {bootstrap.appVersion}</span>
        </div>
      </aside>
      <section className="settings-content">
        {page === 'providers' && (
          <ProvidersPage bootstrap={bootstrap} onChange={setBootstrap} />
        )}
        {page === 'shortcuts' && (
          <ShortcutsPage bootstrap={bootstrap} onChange={setBootstrap} />
        )}
        {page === 'appearance' && (
          <AppearancePage bootstrap={bootstrap} onChange={setBootstrap} />
        )}
        {page === 'privacy' && <PrivacyPage bootstrap={bootstrap} />}
        {page === 'history' && <HistoryPage bootstrap={bootstrap} />}
      </section>
    </main>
  )
}

function SettingsSkeleton() {
  return (
    <main className="settings-shell">
      <aside className="sidebar dark">
        <Logo />
        <div className="sidebar-skeleton">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="nav-skeleton" />
          ))}
        </div>
      </aside>
      <section className="settings-content">
        <div className="page">
          <Skeleton className="eyebrow-skeleton" />
          <Skeleton className="title-skeleton" />
          <Skeleton className="description-skeleton" />
          <Skeleton className="content-skeleton" />
          <Skeleton className="content-skeleton short" />
        </div>
      </section>
    </main>
  )
}

function PageHeading({
  eyebrow,
  title,
  description
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <header className="page-heading">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  )
}

function ProvidersPage({
  bootstrap,
  onChange
}: {
  bootstrap: BootstrapData
  onChange: (next: BootstrapData) => void
}) {
  const [busy, setBusy] = useState('')
  const [keys, setKeys] = useState<Partial<Record<ProviderId, string>>>({})
  const [expandedApi, setExpandedApi] = useState<ProviderId | null>(() => {
    return (
      bootstrap.providers.find((provider) => provider.kind === 'byok' && provider.selected)?.id ??
      null
    )
  })

  async function refresh() {
    setBusy('refresh')
    try {
      const providers = await unwrap(await api.refreshProviders())
      onChange({ ...bootstrap, providers })
      toast.success('Provider status refreshed.')
    } catch (cause) {
      toast.error(messageOf(cause))
    } finally {
      setBusy('')
    }
  }

  async function updateProvider(
    provider: ProviderId,
    patch: Record<string, string | boolean>
  ) {
    setBusy(provider)
    try {
      const next = await unwrap(await api.updateProvider(provider, patch))
      onChange({ ...bootstrap, settings: next.settings, providers: next.providers })
    } catch (cause) {
      toast.error(messageOf(cause))
    } finally {
      setBusy('')
    }
  }

  async function selectProvider(provider: ProviderId) {
    setBusy(provider)
    try {
      const next = await unwrap(await api.selectProvider(provider))
      onChange({ ...bootstrap, settings: next.settings, providers: next.providers })
      toast.success('Active provider changed.')
    } catch (cause) {
      toast.error(messageOf(cause))
    } finally {
      setBusy('')
    }
  }

  async function saveKey(provider: ProviderId) {
    const key = keys[provider]?.trim() ?? ''
    if (!key) return
    setBusy(provider)
    try {
      const providers = await unwrap(await api.setProviderKey(provider, key))
      setKeys((current) => ({ ...current, [provider]: '' }))
      onChange({ ...bootstrap, providers })
      toast.success('API key encrypted and saved locally.')
    } catch (cause) {
      toast.error(messageOf(cause))
    } finally {
      setBusy('')
    }
  }

  async function clearKey(provider: ProviderId) {
    setBusy(provider)
    try {
      const providers = await unwrap(await api.clearProviderKey(provider))
      onChange({ ...bootstrap, providers })
      toast.success('API key removed.')
    } catch (cause) {
      toast.error(messageOf(cause))
    } finally {
      setBusy('')
    }
  }

  const cliProviders = bootstrap.providers.filter((provider) => provider.kind === 'cli')
  const apiProviders = bootstrap.providers.filter((provider) => provider.kind === 'byok')

  return (
    <div className="page providers-page">
      <div className="providers-heading">
        <PageHeading
          eyebrow=""
          title="AI providers"
          description="Use an installed CLI or connect your own API key. Requests go straight from this device to the provider."
        />
        <Button
          type="button"
          variant="outline"
          disabled={Boolean(busy)}
          onClick={() => void refresh()}
        >
          {busy === 'refresh' ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <RotateCw data-icon="inline-start" />
          )}
          Refresh
        </Button>
      </div>

      <div className="credential-band">
        <span className="credential-band-icon"><ShieldCheck /></span>
        <div>
          <strong>Credentials stay on this computer</strong>
          <span>CLI logins stay with their tools. API keys use operating-system encryption.</span>
        </div>
      </div>

      <section className="provider-section" aria-labelledby="cli-connections-heading">
        <header className="provider-section-heading">
          <h2 id="cli-connections-heading">CLI connections</h2>
          <p>Use the account already signed in on this computer.</p>
        </header>
        <div className="cli-provider-grid">
          {cliProviders.map((provider) => {
            const config = bootstrap.settings.providers[provider.id] as {
              enabled: boolean
              model: string
              binaryPath: string
              reasoningEffort: CliReasoningSetting
            }
            return (
              <article
                key={provider.id}
                className={cn(
                  'cli-provider',
                  provider.selected && 'provider-selected',
                  !provider.enabled && 'provider-disabled'
                )}
              >
                <header className="provider-compact-header">
                  <ProviderLogo id={provider.id} name={provider.name} />
                  <div className="provider-identity">
                    <h3>{provider.name}</h3>
                    <span className={cn('provider-state', provider.ready && 'provider-state-ready')}>
                      <i />
                      {providerStateLabel(provider)}
                      {provider.selected && <b>· In use</b>}
                    </span>
                  </div>
                  <Switch
                    checked={provider.enabled}
                    disabled={busy === provider.id}
                    aria-label={'Activate ' + provider.name}
                    onCheckedChange={(enabled) =>
                      void updateProvider(provider.id, { enabled })
                    }
                  />
                </header>

                <div className="cli-provider-controls">
                  <Field>
                    <FieldLabel>CLI executable</FieldLabel>
                    <div className="cli-executable">
                      <code title={config.binaryPath}>{config.binaryPath}</code>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className={cn(
                              'cli-executable-status',
                              !provider.installed && 'cli-executable-status-missing'
                            )}
                            role="img"
                            tabIndex={0}
                            aria-label={
                              provider.installed
                                ? `${provider.name} executable found`
                                : `${provider.name} executable not found`
                            }
                          >
                            {provider.installed ? (
                              <CircleCheck aria-hidden="true" />
                            ) : (
                              <CircleOff aria-hidden="true" />
                            )}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          {provider.installed ? 'Executable found' : 'Executable not found'}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={provider.id + '-model'}>Model</FieldLabel>
                    <Select
                      disabled={busy === provider.id}
                      value={config.model || '__provider_default__'}
                      onValueChange={(value) =>
                        void updateProvider(provider.id, {
                          model: value === '__provider_default__' ? '' : value
                        })
                      }
                    >
                      <SelectTrigger id={provider.id + '-model'}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="__provider_default__">Provider default</SelectItem>
                          {provider.models.map((model) => (
                            <SelectItem key={model} value={model}>{model}</SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={provider.id + '-reasoning'}>Reasoning</FieldLabel>
                    <Select
                      disabled={busy === provider.id}
                      value={config.reasoningEffort}
                      onValueChange={(reasoningEffort) =>
                        void updateProvider(provider.id, { reasoningEffort })
                      }
                    >
                      <SelectTrigger
                        id={provider.id + '-reasoning'}
                        title={
                          config.reasoningEffort === 'auto'
                            ? 'Fast uses Low reasoning; Deep uses High reasoning'
                            : `${reasoningLabels[config.reasoningEffort]} reasoning for ${provider.name}`
                        }
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {reasoningOptions(provider, config.reasoningEffort).map((effort) => (
                            <SelectItem key={effort} value={effort}>
                              {reasoningLabels[effort]}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <footer className="provider-compact-footer">
                  <p>{provider.detail}</p>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!provider.ready || provider.selected || busy === provider.id}
                    onClick={() => void selectProvider(provider.id)}
                  >
                    {provider.selected ? 'In use' : 'Use provider'}
                  </Button>
                </footer>
              </article>
            )
          })}
        </div>
      </section>

      <section className="provider-section" aria-labelledby="api-providers-heading">
        <header className="provider-section-heading">
          <h2 id="api-providers-heading">API providers</h2>
          <p>Your key is encrypted locally and never returned to the interface.</p>
        </header>
        <div className="api-provider-list">
          {apiProviders.map((provider) => {
            const config = bootstrap.settings.providers[provider.id] as {
              enabled: boolean
              model: string
              baseUrl: string
            }
            const expanded = expandedApi === provider.id
            return (
              <article
                key={provider.id}
                className={cn(
                  'api-provider',
                  expanded && 'api-provider-expanded',
                  provider.selected && 'provider-selected'
                )}
              >
                <div className="api-provider-row">
                  <button
                    type="button"
                    className="api-provider-summary"
                    aria-expanded={expanded}
                    aria-controls={provider.id + '-configuration'}
                    onClick={() => setExpandedApi(expanded ? null : provider.id)}
                  >
                    <ProviderLogo id={provider.id} name={provider.name} />
                    <span className="provider-identity">
                      <strong>{provider.name}</strong>
                      <span className={cn('provider-state', provider.ready && 'provider-state-ready')}>
                        <i />
                        {provider.hasKey ? 'Key saved' : providerStateLabel(provider)}
                        {provider.selected && <b>· In use</b>}
                      </span>
                    </span>
                  </button>
                  <Switch
                    checked={provider.enabled}
                    disabled={busy === provider.id}
                    aria-label={'Activate ' + provider.name}
                    onCheckedChange={(enabled) =>
                      void updateProvider(provider.id, { enabled })
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={(expanded ? 'Collapse ' : 'Configure ') + provider.name}
                    aria-expanded={expanded}
                    onClick={() => setExpandedApi(expanded ? null : provider.id)}
                  >
                    <ChevronRight className={cn('provider-chevron', expanded && 'expanded')} />
                  </Button>
                </div>

                {expanded && (
                  <div
                    id={provider.id + '-configuration'}
                    className="api-provider-config"
                  >
                    <div className="api-provider-fields">
                      <Field>
                        <FieldLabel htmlFor={provider.id + '-base-url'}>API base URL</FieldLabel>
                        <Input
                          id={provider.id + '-base-url'}
                          defaultValue={config.baseUrl}
                          spellCheck={false}
                          autoComplete="url"
                          onBlur={(event) => {
                            const baseUrl = event.target.value.trim()
                            if (baseUrl && baseUrl !== config.baseUrl) {
                              void updateProvider(provider.id, { baseUrl })
                            }
                          }}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={provider.id + '-model'}>Model</FieldLabel>
                        {provider.models.length > 1 ? (
                          <Select
                            value={config.model}
                            onValueChange={(model) =>
                              void updateProvider(provider.id, { model })
                            }
                          >
                            <SelectTrigger id={provider.id + '-model'}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {provider.models.map((model) => (
                                  <SelectItem key={model} value={model}>{model}</SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            id={provider.id + '-model'}
                            defaultValue={config.model}
                            spellCheck={false}
                            autoComplete="off"
                            onBlur={(event) => {
                              const model = event.target.value.trim()
                              if (model && model !== config.model) {
                                void updateProvider(provider.id, { model })
                              }
                            }}
                          />
                        )}
                      </Field>
                      <Field className="api-key-field">
                        <FieldLabel htmlFor={provider.id + '-key'}>
                          API key
                          {provider.hasKey && <span className="saved-key">Saved securely</span>}
                        </FieldLabel>
                        <Input
                          id={provider.id + '-key'}
                          type="password"
                          value={keys[provider.id] ?? ''}
                          placeholder={
                            provider.hasKey ? 'Enter a replacement key' : 'Paste an API key'
                          }
                          autoComplete="new-password"
                          spellCheck={false}
                          onChange={(event) =>
                            setKeys((current) => ({
                              ...current,
                              [provider.id]: event.target.value
                            }))
                          }
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') void saveKey(provider.id)
                          }}
                        />
                      </Field>
                    </div>

                    <footer className="api-provider-actions">
                      <p>{provider.detail}</p>
                      {provider.hasKey && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busy === provider.id}
                          onClick={() => void clearKey(provider.id)}
                        >
                          Remove key
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy === provider.id || !(keys[provider.id]?.trim())}
                        onClick={() => void saveKey(provider.id)}
                      >
                        {busy === provider.id && <Spinner data-icon="inline-start" />}
                        {provider.hasKey ? 'Replace key' : 'Save key'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!provider.ready || provider.selected || busy === provider.id}
                        onClick={() => void selectProvider(provider.id)}
                      >
                        {provider.selected ? 'In use' : 'Use provider'}
                      </Button>
                    </footer>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function ShortcutsPage({
  bootstrap,
  onChange
}: {
  bootstrap: BootstrapData
  onChange: (next: BootstrapData) => void
}) {
  const [draft, setDraft] = useState(bootstrap.settings.shortcuts)
  const [recording, setRecording] = useState<ShortcutId | null>(null)
  const [saving, setSaving] = useState(false)

  const actions: Array<{
    id: ShortcutId
    title: string
    detail: string
    icon: typeof Zap
  }> = [
    {
      id: 'instant',
      title: 'Select & answer',
      detail: 'Capture a region and use the saved default instruction.',
      icon: Zap
    },
    {
      id: 'ask',
      title: 'Select & ask',
      detail: 'Capture a region, then type a question beside it.',
      icon: CircleHelp
    },
    {
      id: 'settings',
      title: 'Open settings',
      detail: 'Bring this protected window back without a tray icon.',
      icon: Settings2
    }
  ]

  const duplicateIds = useMemo(() => {
    const groups = new Map<string, ShortcutId[]>()
    for (const [id, shortcut] of Object.entries(draft) as Array<[ShortcutId, string]>) {
      const key = shortcut.toLowerCase()
      groups.set(key, [...(groups.get(key) ?? []), id])
    }
    return new Set([...groups.values()].filter((ids) => ids.length > 1).flat())
  }, [draft])

  useEffect(() => {
    if (!recording) return
    const listener = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'Escape') {
        setRecording(null)
        return
      }
      const shortcut = shortcutFromEvent(event)
      if (!shortcut) return
      setDraft((current) => ({ ...current, [recording]: shortcut }))
      setRecording(null)
    }
    window.addEventListener('keydown', listener, true)
    return () => window.removeEventListener('keydown', listener, true)
  }, [recording])

  async function save() {
    if (duplicateIds.size > 0) {
      toast.error('Each action needs a different shortcut.')
      return
    }
    setSaving(true)
    try {
      const next = await unwrap(await api.updateSettings({ shortcuts: draft }))
      onChange({ ...bootstrap, settings: next.settings, shortcuts: next.shortcuts })
      const conflicts = Object.entries(next.shortcuts)
        .filter(([, registered]) => !registered)
        .map(([id]) => actions.find((action) => action.id === id)?.title ?? id)
      if (conflicts.length > 0) {
        toast.error(`Unavailable: ${conflicts.join(', ')}`)
      } else {
        toast.success('Shortcuts saved and registered.')
      }
    } catch (cause) {
      toast.error(messageOf(cause))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <PageHeading
        eyebrow="WORKFLOW"
        title="Keyboard shortcuts"
        description="Click a shortcut, then press the exact key combination you want to use."
      />
      <Card>
        <CardHeader>
          <CardTitle>Global actions</CardTitle>
          <CardDescription>
            Include Command, Control, Option, or Shift plus one letter or action key.
          </CardDescription>
        </CardHeader>
        <CardContent className="shortcut-list">
          {actions.map((action, index) => {
            const Icon = action.icon
            const conflict =
              duplicateIds.has(action.id) || bootstrap.shortcuts[action.id] === false
            return (
              <div key={action.id}>
                {index > 0 && <Separator />}
                <div className="shortcut-row">
                  <span className="row-icon">
                    <Icon />
                  </span>
                  <div className="row-copy">
                    <strong>{action.title}</strong>
                    <span>{action.detail}</span>
                  </div>
                  <div className="shortcut-control">
                    <Button
                      type="button"
                      variant={recording === action.id ? 'secondary' : 'outline'}
                      size="lg"
                      aria-label={`Record shortcut for ${action.title}`}
                      aria-pressed={recording === action.id}
                      onClick={() => setRecording(action.id)}
                    >
                      {recording === action.id ? (
                        'Press keys…'
                      ) : (
                        <ShortcutKeys value={draft[action.id]} />
                      )}
                    </Button>
                    {conflict ? (
                      <Badge variant="destructive">Conflict</Badge>
                    ) : (
                      <Badge variant="outline">Available</Badge>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </CardContent>
        <CardFooter className="save-row">
          <span>
            {recording ? 'Press Esc to cancel recording.' : 'Changes apply after saving.'}
          </span>
          <Button type="button" disabled={saving || recording !== null} onClick={() => void save()}>
            {saving && <Spinner data-icon="inline-start" />}
            {saving ? 'Registering…' : 'Save shortcuts'}
          </Button>
        </CardFooter>
      </Card>
      {[...duplicateIds].length > 0 && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Duplicate shortcut</AlertTitle>
          <AlertDescription>
            Assign a different combination to each highlighted action before saving.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

function ShortcutKeys({ value }: { value: string }) {
  return (
    <KbdGroup>
      {value.split('+').map((token) => (
        <Kbd key={token}>{shortcutToken(token)}</Kbd>
      ))}
    </KbdGroup>
  )
}

function AppearancePage({
  bootstrap,
  onChange
}: {
  bootstrap: BootstrapData
  onChange: (next: BootstrapData) => void
}) {
  const settings = bootstrap.settings
  const [instruction, setInstruction] = useState(settings.defaultInstruction)
  const [savingInstruction, setSavingInstruction] = useState(false)

  async function update(patch: Partial<AppSettings>, message?: string) {
    try {
      const next = await unwrap(await api.updateSettings(patch))
      onChange({ ...bootstrap, settings: next.settings, shortcuts: next.shortcuts })
      if (message) toast.success(message)
    } catch (cause) {
      toast.error(messageOf(cause))
    }
  }

  async function saveInstruction() {
    setSavingInstruction(true)
    await update({ defaultInstruction: instruction }, 'Default instruction saved.')
    setSavingInstruction(false)
  }

  return (
    <div className="page">
      <PageHeading
        eyebrow="DISPLAY"
        title="Appearance & behavior"
        description="Make the overlay legible without losing sight of the screen underneath."
      />
      <Card>
        <CardHeader>
          <CardTitle>Response behavior</CardTitle>
          <CardDescription>These settings apply to the next screen capture.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field orientation="horizontal">
              <div>
                <FieldTitle id="default-mode-label">Default analysis</FieldTitle>
                <FieldDescription>
                  Fast sends low reasoning. Deep sends high reasoning to Codex and Claude.
                </FieldDescription>
              </div>
              <ToggleGroup
                type="single"
                variant="outline"
                size="lg"
                value={settings.defaultMode}
                onValueChange={(value) => {
                  if (value === 'fast' || value === 'deep') void update({ defaultMode: value })
                }}
                aria-labelledby="default-mode-label"
              >
                <ToggleGroupItem value="fast">
                  <Zap />
                  Fast
                </ToggleGroupItem>
                <ToggleGroupItem value="deep">
                  <Sparkles />
                  Deep
                </ToggleGroupItem>
              </ToggleGroup>
            </Field>
            <Separator />
            <Field orientation="horizontal">
              <div>
                <FieldTitle id="overlay-opacity-label">Overlay opacity</FieldTitle>
                <FieldDescription>
                  {Math.round(settings.overlayOpacity * 100)}% opaque
                </FieldDescription>
              </div>
              <Slider
                value={[settings.overlayOpacity]}
                min={0.62}
                max={0.98}
                step={0.01}
                aria-labelledby="overlay-opacity-label"
                onValueCommit={(value) => {
                  const opacity = value[0]
                  if (opacity !== undefined) void update({ overlayOpacity: opacity })
                }}
              />
            </Field>
            <Separator />
            <Field orientation="horizontal">
              <div>
                <FieldTitle id="launch-at-login-label">Launch at login</FieldTitle>
                <FieldDescription>
                  Start quietly in the background after you sign in.
                </FieldDescription>
              </div>
              <Switch
                checked={settings.launchAtLogin}
                aria-labelledby="launch-at-login-label"
                onCheckedChange={(checked) => void update({ launchAtLogin: checked })}
              />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Default instruction</CardTitle>
          <CardDescription>
            Used by Select & answer. Ask mode uses your question with the same code and Markdown
            response rules.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="default-instruction">Instruction</FieldLabel>
              <Textarea
                id="default-instruction"
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                rows={8}
                maxLength={4000}
              />
              <FieldDescription>
                {instruction.length.toLocaleString()} / 4,000 characters
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="save-row">
          <span>The selected image is processed in memory.</span>
          <Button
            type="button"
            disabled={
              savingInstruction ||
              !instruction.trim() ||
              instruction === settings.defaultInstruction
            }
            onClick={() => void saveInstruction()}
          >
            {savingInstruction && <Spinner data-icon="inline-start" />}
            Save instruction
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>History retention</CardTitle>
          <CardDescription>
            Local encrypted history is kept until deleted unless you choose a limit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Field>
            <FieldLabel htmlFor="history-retention">Automatically delete after</FieldLabel>
            <Select
              value={settings.historyAutoDeleteDays?.toString() ?? 'forever'}
              onValueChange={(value) =>
                void update(
                  { historyAutoDeleteDays: value === 'forever' ? null : Number(value) },
                  'Retention updated.'
                )
              }
            >
              <SelectTrigger id="history-retention">
                <SelectValue placeholder="Choose retention" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="forever">Keep until I delete it</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="365">1 year</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>
    </div>
  )
}

function PrivacyPage({ bootstrap }: { bootstrap: BootstrapData }) {
  const [busy, setBusy] = useState(false)
  const [diagnostic, setDiagnostic] = useState<{
    verdict: 'passed' | 'best-effort' | 'failed'
    detail: string
  } | null>(null)

  return (
    <div className="page">
      <PageHeading
        eyebrow="CAPTURE PRIVACY"
        title="Privacy check"
        description="Collect local evidence, then confirm the exact meeting-share path you will use."
      />
      <Alert variant={bootstrap.privacy.tone === 'protected' ? 'default' : 'destructive'}>
        {bootstrap.privacy.tone === 'protected' ? <ShieldCheck /> : <Eye />}
        <AlertTitle>{bootstrap.privacy.label}</AlertTitle>
        <AlertDescription>
          {bootstrap.platform === 'win32'
            ? 'Haired asks Windows to exclude every app window from capture before that window is shown.'
            : 'macOS capture protection has platform limits. Haired never labels it as guaranteed.'}
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Three-part verification</CardTitle>
          <CardDescription>
            The local check is diagnostic evidence, not a universal guarantee.
          </CardDescription>
        </CardHeader>
        <CardContent className="privacy-steps">
          {[
            ['1', 'Run the local diagnostic', 'Check the operating system capture-source list.'],
            ['2', 'Open your meeting preview', 'Use the exact full-display or window share.'],
            ['3', 'Confirm with a second participant', 'Verify what another participant records.']
          ].map(([number, title, detail], index) => (
            <div key={number}>
              {index > 0 && <Separator />}
              <div className="privacy-step">
                <Badge variant="secondary">{number}</Badge>
                <div>
                  <strong>{title}</strong>
                  <span>{detail}</span>
                </div>
              </div>
            </div>
          ))}
          <div className="privacy-result" aria-live="polite">
            {diagnostic && (
              <Alert variant={diagnostic.verdict === 'failed' ? 'destructive' : 'default'}>
                {diagnostic.verdict === 'failed' ? <AlertCircle /> : <ShieldCheck />}
                <AlertTitle>
                  {diagnostic.verdict === 'passed'
                    ? 'Local diagnostic passed'
                    : diagnostic.verdict === 'best-effort'
                      ? 'Best-effort result'
                      : 'Local diagnostic failed'}
                </AlertTitle>
                <AlertDescription>{diagnostic.detail}</AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
        <CardFooter className="privacy-actions">
          <Button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              setDiagnostic(null)
              try {
                const result = await unwrap(await api.runPrivacyDiagnostic())
                setDiagnostic(result)
                toast.success('Diagnostic completed.')
              } catch (cause) {
                toast.error(messageOf(cause))
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? <Spinner data-icon="inline-start" /> : <Play data-icon="inline-start" />}
            {busy ? 'Running…' : 'Run diagnostic'}
          </Button>
          {bootstrap.platform === 'darwin' &&
            bootstrap.privacy.screenPermission !== 'granted' && (
              <Button
                variant="outline"
                type="button"
                onClick={() => void api.openScreenPermission()}
              >
                Open screen permission
              </Button>
            )}
        </CardFooter>
      </Card>
    </div>
  )
}

function HistoryPage({ bootstrap }: { bootstrap: BootstrapData }) {
  const [items, setItems] = useState<HistorySummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [record, setRecord] = useState<LocalHistoryRecord | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [recordLoading, setRecordLoading] = useState(false)
  const historyRequest = useRef(0)
  const recordRequest = useRef(0)
  const deferredSearch = useDeferredValue(search)

  useEffect(() => {
    const request = ++historyRequest.current
    setLoading(true)
    const timer = window.setTimeout(() => {
      void api
        .listHistory(deferredSearch)
        .then(unwrap)
        .then((next) => {
          if (request !== historyRequest.current) return
          setItems(next)
          setSelectedId((current) =>
            current && next.some((item) => item.id === current)
              ? current
              : next[0]?.id ?? null
          )
        })
        .catch((cause) => toast.error(messageOf(cause)))
        .finally(() => {
          if (request === historyRequest.current) setLoading(false)
        })
    }, 160)
    return () => window.clearTimeout(timer)
  }, [deferredSearch])

  useEffect(() => {
    if (!selectedId) {
      setRecord(null)
      return
    }
    const request = ++recordRequest.current
    setRecordLoading(true)
    void api
      .getHistory(selectedId)
      .then(unwrap)
      .then((next) => {
        if (request === recordRequest.current) setRecord(next)
      })
      .catch((cause) => toast.error(messageOf(cause)))
      .finally(() => {
        if (request === recordRequest.current) setRecordLoading(false)
      })
  }, [selectedId])

  async function remove(id: string) {
    try {
      await unwrap(await api.deleteHistory(id))
      const next = items.filter((item) => item.id !== id)
      setItems(next)
      setSelectedId(next[0]?.id ?? null)
      toast.success('History item deleted.')
    } catch (cause) {
      toast.error(messageOf(cause))
    }
  }

  return (
    <div className="page history-page">
      <div className="history-heading">
        <PageHeading
          eyebrow="LOCAL & ENCRYPTED"
          title="History"
          description="Real captures and answers stored on this device."
        />
        <Badge variant={bootstrap.historyBytes >= 5 * 1024 ** 3 ? 'destructive' : 'outline'}>
          <HardDrive />
          {formatBytes(bootstrap.historyBytes)} used
        </Badge>
      </div>
      {bootstrap.historyBytes >= 5 * 1024 ** 3 && (
        <Alert variant="destructive">
          <HardDrive />
          <AlertTitle>History is over the 5 GB soft limit</AlertTitle>
          <AlertDescription>
            Delete old items or choose an automatic retention period in Appearance.
          </AlertDescription>
        </Alert>
      )}
      <div className="history-toolbar">
        <InputGroup>
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search encrypted history"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </InputGroup>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">
              <Trash2 data-icon="inline-start" />
              Clear history
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear all encrypted history?</AlertDialogTitle>
              <AlertDialogDescription>
                Every saved screenshot, question, and answer will be removed. Haired will also
                destroy and regenerate the local history encryption key. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={async () => {
                  try {
                    await unwrap(await api.clearHistory())
                    setItems([])
                    setSelectedId(null)
                    setRecord(null)
                    toast.success('Encrypted history cleared.')
                  } catch (cause) {
                    toast.error(messageOf(cause))
                  }
                }}
              >
                Clear everything
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="history-layout">
        <Card className="history-list-card">
          <CardHeader>
            <CardTitle>Saved answers</CardTitle>
            <CardDescription>
              {loading ? 'Loading…' : `${items.length} item${items.length === 1 ? '' : 's'}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="history-loading">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="history-item-skeleton" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <History />
                  </EmptyMedia>
                  <EmptyTitle>No saved answers</EmptyTitle>
                  <EmptyDescription>
                    Successful analyses will appear here after your first real capture.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ScrollArea className="history-scroll">
                <div className="history-list">
                  {items.map((item) => (
                    <Button
                      type="button"
                      variant={selectedId === item.id ? 'secondary' : 'ghost'}
                      className="history-item"
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <img src={item.thumbnailDataUrl} alt="" />
                      <span className="history-item-copy">
                        <strong>{item.title}</strong>
                        <small>
                          {relativeDate(item.createdAt)} · {titleCase(item.mode)}
                        </small>
                      </span>
                      <ChevronRight />
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card className="history-preview">
          {recordLoading ? (
            <CardContent className="record-skeleton">
              <Skeleton className="capture-skeleton" />
              <Skeleton className="line-skeleton" />
              <Skeleton className="line-skeleton short" />
              <Skeleton className="answer-skeleton" />
            </CardContent>
          ) : record ? (
            <>
              <CardHeader>
                <Badge variant="secondary">
                  {record.mode === 'fast' ? <Zap /> : <Sparkles />}
                  {titleCase(record.mode)}
                </Badge>
                <CardTitle>{record.title}</CardTitle>
                <CardDescription>{formatDateTime(record.createdAt)}</CardDescription>
                <CardAction>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="History actions">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuGroup>
                        <DropdownMenuItem onSelect={() => void api.exportHistory(record.id)}>
                          <Download />
                          Export
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => void remove(record.id)}
                        >
                          <Trash2 />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardAction>
              </CardHeader>
              <CardContent className="preview-content">
                <img
                  className="history-capture"
                  src={record.screenshotDataUrl}
                  alt="Saved screen capture"
                />
                <section className="preview-question">
                  <span>QUESTION</span>
                  <p>{record.question}</p>
                </section>
                <Separator />
                <section className="markdown preview-answer">
                  <MarkdownAnswer>{record.answer}</MarkdownAnswer>
                </section>
              </CardContent>
              <CardFooter className="preview-actions">
                <Button type="button" onClick={() => void api.rerunHistory(record.id)}>
                  <RotateCw data-icon="inline-start" />
                  Run again
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => void api.exportHistory(record.id)}
                >
                  <Download data-icon="inline-start" />
                  Export
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="icon" aria-label="Delete history item">
                      <Trash2 />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this history item?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Its screenshot, question, answer, title, and provider metadata will be
                        removed from the encrypted local database.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={() => void remove(record.id)}
                      >
                        Delete item
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardFooter>
            </>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileText />
                </EmptyMedia>
                <EmptyTitle>Select a saved answer</EmptyTitle>
                <EmptyDescription>
                  Its encrypted content is decrypted only in the desktop main process.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Badge variant="outline">
                  <ShieldCheck />
                  On this device only
                </Badge>
              </EmptyContent>
            </Empty>
          )}
        </Card>
      </div>
      <div className="history-footnote">
        <ShieldCheck />
        AES-256-GCM encrypted · Protected by{' '}
        {bootstrap.platform === 'darwin' ? 'Keychain' : 'DPAPI'}
      </div>
    </div>
  )
}

function Selector({ mode }: { mode: 'instant' | 'ask' }) {
  const [origin, setOrigin] = useState<Point | null>(null)
  const [current, setCurrent] = useState<Point | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [prompt, setPrompt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const promptRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') void api.cancelSelection()
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [])

  const draggingSelection = useMemo(() => {
    if (!origin || !current) return null
    return normalizeSelection(origin, current)
  }, [origin, current])
  const visible = selection ?? draggingSelection

  async function submit(next: Selection, question?: string) {
    if (submitting) return
    setSubmitting(true)
    const result = await api.completeSelection({
      region: next,
      ...(question ? { prompt: question } : {})
    })
    if (!result.ok) {
      setSubmitting(false)
      toast.error(result.error)
    }
  }

  return (
    <main
      className="selector"
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest('.ask-popover')) return
        setSelection(null)
        setOrigin({ x: event.clientX, y: event.clientY })
        setCurrent({ x: event.clientX, y: event.clientY })
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (origin) setCurrent({ x: event.clientX, y: event.clientY })
      }}
      onPointerUp={(event) => {
        if (!origin) return
        const next = normalizeSelection(origin, { x: event.clientX, y: event.clientY })
        setOrigin(null)
        setCurrent(null)
        if (next.width < 8 || next.height < 8) return
        setSelection(next)
        if (mode === 'instant') void submit(next)
        else window.setTimeout(() => promptRef.current?.focus(), 50)
      }}
    >
      <Card className="selector-tip">
        <CardContent>
          <Logo compact />
          <span>{mode === 'instant' ? 'Drag to select & answer' : 'Drag to select, then ask'}</span>
          <Kbd>Esc</Kbd>
        </CardContent>
      </Card>
      {visible && (
        <div
          className="selection-box"
          style={{
            left: visible.x,
            top: visible.y,
            width: visible.width,
            height: visible.height
          }}
        >
          <Badge className="selection-size">
            {Math.round(visible.width)} × {Math.round(visible.height)}
          </Badge>
          <i className="handle nw" />
          <i className="handle ne" />
          <i className="handle sw" />
          <i className="handle se" />
        </div>
      )}
      {mode === 'ask' && selection && (
        <form
          className="ask-popover"
          style={{
            left: Math.min(selection.x, window.innerWidth - 470),
            top: Math.min(selection.y + selection.height + 12, window.innerHeight - 82)
          }}
          onSubmit={(event) => {
            event.preventDefault()
            if (prompt.trim()) void submit(selection, prompt.trim())
          }}
        >
          <InputGroup>
            <InputGroupAddon>
              <Sparkles />
            </InputGroupAddon>
            <InputGroupInput
              ref={promptRef}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="What would you like to know?"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                type="submit"
                size="icon-sm"
                disabled={!prompt.trim() || submitting}
                aria-label="Analyze selection"
              >
                {submitting ? <Spinner /> : <ArrowRight />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>
      )}
    </main>
  )
}

function AnswerOverlay({ id }: { id: string }) {
  const opacity = Number(new URLSearchParams(window.location.search).get('opacity') ?? 0.9)
  const [question, setQuestion] = useState('Preparing your question…')
  const [mode, setMode] = useState<AnalysisMode>('fast')
  const [answer, setAnswer] = useState('')
  const [status, setStatus] = useState<'thinking' | 'complete' | 'error'>('thinking')
  const [error, setError] = useState('')
  const [pinned, setPinned] = useState(false)
  const [followUp, setFollowUp] = useState('')

  useEffect(() => {
    const removeInit = api.onOverlayInit((payload) => {
      setQuestion(payload.question)
      setMode(payload.mode)
      setAnswer('')
      setStatus('thinking')
    })
    const removeEvent = api.onOverlayEvent((event: StreamEvent) => {
      if (event.type === 'started') setStatus('thinking')
      if (event.type === 'delta') setAnswer((current) => current + event.text)
      if (event.type === 'completed') setStatus('complete')
      if (event.type === 'error') {
        setStatus('error')
        setError(event.message)
      }
    })
    const removeReset = api.onOverlayReset((payload) => {
      setQuestion(payload.question)
      setAnswer('')
      setStatus('thinking')
      setError('')
      setFollowUp('')
    })
    return () => {
      removeInit()
      removeEvent()
      removeReset()
    }
  }, [])

  async function submitFollowUp(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' || !followUp.trim()) return
    event.preventDefault()
    try {
      await unwrap(await api.followUp(id, followUp.trim()))
    } catch (cause) {
      toast.error(messageOf(cause))
    }
  }

  return (
    <main
      className="answer-overlay dark"
      style={
        {
          '--overlay-opacity': Math.min(0.98, Math.max(0.62, opacity))
        } as CSSProperties
      }
    >
      <header className="overlay-head drag-region">
        <Logo compact />
        <div className="overlay-status">
          <Badge variant="secondary">
            {mode === 'fast' ? <Zap /> : <Sparkles />}
            {titleCase(mode)}
          </Badge>
          {status === 'thinking' && (
            <Badge variant="outline">
              <Spinner />
              Thinking
            </Badge>
          )}
        </div>
        <div className="overlay-window-actions no-drag">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={pinned ? 'secondary' : 'ghost'}
                size="icon-sm"
                aria-label={pinned ? 'Unpin answer' : 'Pin answer'}
                onClick={async () => {
                  try {
                    const next = await unwrap(await api.pinOverlay(id, !pinned))
                    setPinned(next)
                  } catch (cause) {
                    toast.error(messageOf(cause))
                  }
                }}
              >
                <Pin />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{pinned ? 'Unpin answer' : 'Pin answer'}</TooltipContent>
          </Tooltip>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close answer"
            onClick={() => void api.closeOverlay(id)}
          >
            <X />
          </Button>
        </div>
      </header>
      <section className="overlay-question">
        <span>QUESTION</span>
        <p>{question}</p>
      </section>
      <ScrollArea className="overlay-answer">
        <div className="markdown">
          {status === 'thinking' && !answer && (
            <div className="overlay-skeleton" aria-label="Generating answer">
              <Skeleton />
              <Skeleton />
              <Skeleton />
            </div>
          )}
          {answer && <MarkdownAnswer>{answer}</MarkdownAnswer>}
          {status === 'error' && (
            <Alert variant="destructive">
              <EyeOff />
              <AlertTitle>Analysis failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </ScrollArea>
      <footer className="overlay-bottom no-drag">
        <InputGroup>
          <InputGroupAddon>
            <Plus />
          </InputGroupAddon>
          <InputGroupInput
            value={followUp}
            onChange={(event) => setFollowUp(event.target.value)}
            onKeyDown={(event) => void submitFollowUp(event)}
            placeholder="Ask a follow-up…"
            disabled={status === 'thinking'}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              type="button"
              size="icon-sm"
              disabled={!followUp.trim() || status === 'thinking'}
              aria-label="Send follow-up"
              onClick={async () => {
                try {
                  await unwrap(await api.followUp(id, followUp.trim()))
                } catch (cause) {
                  toast.error(messageOf(cause))
                }
              }}
            >
              <Send />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Copy answer"
              onClick={async () => {
                try {
                  await unwrap(await api.copyOverlay(id))
                  toast.success('Answer copied.')
                } catch (cause) {
                  toast.error(messageOf(cause))
                }
              }}
            >
              <Copy />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy answer</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Export answer"
              onClick={() => void api.exportOverlay(id)}
            >
              <Download />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Export answer</TooltipContent>
        </Tooltip>
      </footer>
    </main>
  )
}

function normalizeSelection(a: Point, b: Point): Selection {
  return {
    x: Math.max(0, Math.min(a.x, b.x)),
    y: Math.max(0, Math.min(a.y, b.y)),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y)
  }
}

function shortcutFromEvent(event: KeyboardEvent): string | null {
  const modifiers: string[] = []
  if (event.metaKey || event.ctrlKey) modifiers.push('CommandOrControl')
  if (event.altKey) modifiers.push('Alt')
  if (event.shiftKey) modifiers.push('Shift')
  if (modifiers.length === 0) return null

  const modifierKeys = new Set(['Meta', 'Control', 'Alt', 'Shift'])
  if (modifierKeys.has(event.key)) return null
  const key =
    event.code === 'Space'
      ? 'Space'
      : event.key === 'Enter'
        ? 'Enter'
        : event.key === 'ArrowUp'
          ? 'Up'
          : event.key === 'ArrowDown'
            ? 'Down'
            : event.key === 'ArrowLeft'
              ? 'Left'
              : event.key === 'ArrowRight'
                ? 'Right'
                : event.key.length === 1
                  ? event.key.toUpperCase()
                  : event.key
  return [...modifiers, key].join('+')
}

function shortcutToken(token: string): string {
  if (token === 'CommandOrControl') {
    return navigator.platform.toLowerCase().includes('mac') ? '⌘' : 'Ctrl'
  }
  if (token === 'Shift') return '⇧'
  if (token === 'Alt') return navigator.platform.toLowerCase().includes('mac') ? '⌥' : 'Alt'
  if (token === 'Space') return 'Space'
  if (token === 'Enter') return '↵'
  return token
}

function messageOf(value: unknown): string {
  return value instanceof Error ? value.message : 'Something went wrong'
}

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value))
}

function relativeDate(value: string): string {
  const difference = Date.now() - new Date(value).getTime()
  if (difference < 60_000) return 'just now'
  if (difference < 3_600_000) return `${Math.floor(difference / 60_000)}m ago`
  if (difference < 86_400_000) return `${Math.floor(difference / 3_600_000)}h ago`
  return `${Math.floor(difference / 86_400_000)}d ago`
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`
  return `${(value / 1024 ** 3).toFixed(1)} GB`
}
