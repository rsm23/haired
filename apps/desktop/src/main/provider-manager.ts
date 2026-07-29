import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import readline from 'node:readline'
import type {
  AnalysisMode,
  AnalysisMetadata,
  AppSettings,
  CliReasoningSetting,
  ProviderId,
  ProviderStatus,
  ReasoningEffort,
  StreamEvent
} from '@haired/contracts'
import {
  CODE_ONLY_ANSWER_INSTRUCTION,
  CODE_ANSWER_INSTRUCTION,
  providerIdSchema,
  reasoningEffortSchema,
  SCREEN_TASK_INSTRUCTION
} from '@haired/contracts'
import type { ProtectedFile } from './secure-storage'
import type { SettingsStore } from './settings-store'

type ProviderSecrets = Partial<Record<ProviderId, string>>

interface AnalysisInput {
  image: Buffer
  metadata: AnalysisMetadata
  onEvent: (event: StreamEvent) => void
  signal: AbortSignal
}

interface RpcMessage {
  id?: number | string
  method?: string
  params?: any
  result?: any
  error?: { code?: number; message?: string }
}

const providerNames: Record<ProviderId, string> = {
  codex: 'OpenAI Codex',
  claude: 'Claude Code',
  openai: 'OpenAI API',
  anthropic: 'Anthropic API',
  gemini: 'Google Gemini API',
  mistral: 'Mistral AI API',
  'openai-compatible': 'OpenAI-compatible API'
}

const byokProviders = new Set<ProviderId>([
  'openai',
  'anthropic',
  'gemini',
  'mistral',
  'openai-compatible'
])

const providerModels: Partial<Record<ProviderId, string[]>> = {
  mistral: [
    'mistral-small-latest',
    'mistral-medium-latest',
    'mistral-large-latest',
    'ministral-14b-latest'
  ]
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Provider request failed'
}

function safeDetail(value: unknown, fallback: string): string {
  const text = typeof value === 'string' ? value.trim() : ''
  return (text || fallback)
    .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted key]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[redacted email]')
    .slice(0, 320)
}

function resolveReasoningEffort(
  setting: CliReasoningSetting,
  mode: AnalysisMode
): ReasoningEffort {
  if (setting !== 'auto') return setting
  return mode === 'deep' ? 'high' : 'low'
}

function buildPrompt(metadata: AnalysisMetadata): string {
  const depth =
    metadata.mode === 'deep'
      ? 'Reason carefully, check ambiguity, and give a complete but focused answer.'
      : 'Answer concisely and directly.'
  const conversation =
    metadata.conversation.length > 0
      ? `\n\nConversation so far:\n${metadata.conversation
          .map((turn) => `${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.content}`)
          .join('\n\n')}`
      : ''
  const interactionInstruction =
    metadata.interaction === 'instant'
      ? [
          'The user invoked one-click Select & answer and did not type a separate question.',
          SCREEN_TASK_INSTRUCTION
        ].join('\n')
      : 'Answer the user’s explicit question using the selected screen as context.'
  const responseRequirements = [
    metadata.prompt.includes(SCREEN_TASK_INSTRUCTION) ? '' : SCREEN_TASK_INSTRUCTION,
    metadata.prompt.includes(CODE_ANSWER_INSTRUCTION) ? '' : CODE_ANSWER_INSTRUCTION,
    metadata.codeResponseStyle === 'code-only' ? CODE_ONLY_ANSWER_INSTRUCTION : ''
  ]
    .filter(Boolean)
    .join('\n\n')
  return [
    'You are Haired, a privacy-conscious screen assistant.',
    depth,
    'Analyze the attached screenshot only as needed to answer the user.',
    interactionInstruction,
    conversation,
    `\n\nCurrent question:\n${metadata.prompt}`,
    responseRequirements ? `\n\nResponse requirements:\n${responseRequirements}` : ''
  ].join('\n')
}

function codexTurnOptions(
  setting: CliReasoningSetting,
  mode: AnalysisMode,
  model: string
): {
  effort: ReasoningEffort
  model?: string
} {
  return {
    effort: resolveReasoningEffort(setting, mode),
    ...(model ? { model } : {})
  }
}

function claudeArguments(
  model: string,
  setting: CliReasoningSetting,
  mode: AnalysisMode
): string[] {
  return [
    '--print',
    '--output-format',
    'stream-json',
    '--input-format',
    'stream-json',
    '--verbose',
    '--max-turns',
    '1',
    '--effort',
    resolveReasoningEffort(setting, mode),
    '--model',
    model,
    '--tools',
    '',
    '--permission-mode',
    'dontAsk',
    '--setting-sources',
    'user',
    '--no-session-persistence',
    '--system-prompt',
    'You are Haired. Analyze the provided screenshot and answer without using tools.'
  ]
}

function dataUrl(image: Buffer): string {
  return `data:image/png;base64,${image.toString('base64')}`
}

function createAbortError(): Error {
  const error = new Error('Analysis canceled')
  error.name = 'AbortError'
  return error
}

async function commandResult(
  binary: string,
  args: string[],
  options: { signal?: AbortSignal; stdin?: string; timeoutMs?: number } = {}
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      env: process.env
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    const finish = (result: { code: number; stdout: string; stderr: string }): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', abort)
      resolve(result)
    }
    const abort = (): void => {
      child.kill()
      if (!settled) {
        settled = true
        clearTimeout(timer)
        reject(createAbortError())
      }
    }
    const timer = setTimeout(() => {
      child.kill()
      finish({ code: 124, stdout, stderr: stderr || 'Command timed out' })
    }, options.timeoutMs ?? 15_000)
    options.signal?.addEventListener('abort', abort, { once: true })
    child.once('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', abort)
      reject(error)
    })
    child.stdout.on('data', (chunk) => {
      if (stdout.length < 2_000_000) stdout += String(chunk)
    })
    child.stderr.on('data', (chunk) => {
      if (stderr.length < 20_000) stderr += String(chunk)
    })
    child.once('close', (code) => finish({ code: code ?? 1, stdout, stderr }))
    child.stdin.end(options.stdin)
  })
}

class CodexRpc {
  private readonly child: ChildProcessWithoutNullStreams
  private readonly pending = new Map<
    number,
    { resolve: (value: any) => void; reject: (error: Error) => void }
  >()
  private readonly listeners = new Set<(message: RpcMessage) => void>()
  private nextId = 1
  private stderr = ''

  constructor(binary: string, signal?: AbortSignal) {
    this.child = spawn(binary, ['app-server'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      env: process.env
    })
    readline.createInterface({ input: this.child.stdout }).on('line', (line) => {
      let message: RpcMessage
      try {
        message = JSON.parse(line) as RpcMessage
      } catch {
        return
      }
      if (typeof message.id === 'number' && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id)!
        this.pending.delete(message.id)
        if (message.error) {
          pending.reject(new Error(safeDetail(message.error.message, 'Codex request failed')))
        } else {
          pending.resolve(message.result)
        }
        return
      }
      for (const listener of this.listeners) listener(message)
    })
    this.child.stderr.on('data', (chunk) => {
      if (this.stderr.length < 20_000) this.stderr += String(chunk)
    })
    this.child.once('error', (error) => this.rejectAll(error))
    this.child.once('close', (code) => {
      this.rejectAll(
        new Error(
          safeDetail(this.stderr, `Codex app-server exited${code === null ? '' : ` (${code})`}`)
        )
      )
    })
    signal?.addEventListener('abort', () => this.close(createAbortError()), { once: true })
  }

  onNotification(listener: (message: RpcMessage) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  notify(method: string, params: unknown = {}): void {
    this.child.stdin.write(`${JSON.stringify({ method, params })}\n`)
  }

  request(method: string, params: unknown = {}, timeoutMs = 30_000): Promise<any> {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Codex ${method} timed out`))
      }, timeoutMs)
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer)
          resolve(value)
        },
        reject: (error) => {
          clearTimeout(timer)
          reject(error)
        }
      })
      this.child.stdin.write(`${JSON.stringify({ id, method, params })}\n`)
    })
  }

  async initialize(): Promise<void> {
    await this.request('initialize', {
      clientInfo: { name: 'haired', title: 'Haired', version: '0.1.0' },
      capabilities: { experimentalApi: true }
    })
    this.notify('initialized')
  }

  close(cause = new Error('Codex app-server closed')): void {
    this.child.kill()
    this.rejectAll(cause)
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error)
    this.pending.clear()
  }
}

async function readSse(
  response: Response,
  onJson: (event: string, payload: any) => void,
  signal: AbortSignal
): Promise<void> {
  if (!response.body) throw new Error('Provider returned no response stream')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    if (signal.aborted) throw createAbortError()
    const { done, value } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })
    const chunks = buffer.split(/\r?\n\r?\n/)
    buffer = chunks.pop() ?? ''
    for (const chunk of chunks) {
      let event = ''
      const data: string[] = []
      for (const line of chunk.split(/\r?\n/)) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        if (line.startsWith('data:')) data.push(line.slice(5).trimStart())
      }
      const raw = data.join('\n')
      if (!raw || raw === '[DONE]') continue
      try {
        onJson(event, JSON.parse(raw))
      } catch {
        // Providers may include heartbeat or non-JSON diagnostic events.
      }
    }
    if (done) break
  }
}

async function requireOk(response: Response): Promise<Response> {
  if (response.ok) return response
  let detail = `${response.status} ${response.statusText}`.trim()
  try {
    const body = (await response.json()) as any
    detail = body?.error?.message ?? body?.message ?? detail
  } catch {
    // Avoid reflecting HTML or proxy bodies that may contain sensitive data.
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error(`Authentication failed: ${safeDetail(detail, 'check the provider key')}`)
  }
  if (response.status === 429) {
    throw new Error(`Provider rate limit reached: ${safeDetail(detail, 'try again later')}`)
  }
  throw new Error(`Provider request failed: ${safeDetail(detail, 'unknown error')}`)
}

function usageEvent(
  provider: string,
  model: string,
  inputTokens = 0,
  outputTokens = 0
): StreamEvent {
  return { type: 'usage', provider, model, inputTokens, outputTokens }
}

function parseClaudeOutput(stdout: string): {
  answer: string
  inputTokens: number
  outputTokens: number
  error: string
} {
  let answer = ''
  let inputTokens = 0
  let outputTokens = 0
  let resultError = ''
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) continue
    try {
      const event = JSON.parse(line) as any
      if (event.type === 'assistant') {
        for (const block of event.message?.content ?? []) {
          if (block?.type === 'text' && typeof block.text === 'string') answer += block.text
        }
        inputTokens = event.message?.usage?.input_tokens ?? inputTokens
        outputTokens = event.message?.usage?.output_tokens ?? outputTokens
      }
      if (event.type === 'result' && event.is_error) {
        resultError = safeDetail(event.result, 'Claude request failed')
      }
    } catch {
      // Ignore non-JSON Claude diagnostics.
    }
  }
  return { answer, inputTokens, outputTokens, error: resultError }
}

export class ProviderManager {
  constructor(
    private readonly settingsStore: SettingsStore,
    private readonly secretsFile: ProtectedFile<ProviderSecrets>
  ) {}

  async setApiKey(rawProvider: unknown, rawKey: unknown): Promise<void> {
    const provider = providerIdSchema.parse(rawProvider)
    if (!byokProviders.has(provider)) throw new Error('This provider uses its CLI login')
    if (typeof rawKey !== 'string') throw new Error('API key must be a string')
    const key = rawKey.trim()
    if (key.length < 8 || key.length > 2_048) throw new Error('Enter a valid API key')
    const secrets = (await this.secretsFile.read()) ?? {}
    await this.secretsFile.write({ ...secrets, [provider]: key })
  }

  async clearApiKey(rawProvider: unknown): Promise<void> {
    const provider = providerIdSchema.parse(rawProvider)
    if (!byokProviders.has(provider)) throw new Error('This provider uses its CLI login')
    const secrets = (await this.secretsFile.read()) ?? {}
    delete secrets[provider]
    if (Object.keys(secrets).length === 0) await this.secretsFile.clear()
    else await this.secretsFile.write(secrets)
  }

  async statuses(): Promise<ProviderStatus[]> {
    const settings = await this.settingsStore.load()
    const secrets = (await this.secretsFile.read()) ?? {}
    const [codex, claude] = await Promise.all([
      this.codexStatus(settings),
      this.claudeStatus(settings)
    ])
    const apiStatuses = (
      ['openai', 'anthropic', 'gemini', 'mistral', 'openai-compatible'] as ProviderId[]
    ).map((id) => {
      const config = settings.providers[id]
      const hasKey = Boolean(secrets[id])
      return {
        id,
        name: providerNames[id],
        kind: 'byok' as const,
        enabled: config.enabled,
        selected: settings.providers.selected === id,
        installed: true,
        authenticated: hasKey,
        ready: config.enabled && hasKey,
        detail: hasKey
          ? 'API key stored with operating-system encryption.'
          : 'Add an API key to use this provider.',
        model: config.model,
        models: Array.from(new Set([config.model, ...(providerModels[id] ?? [])])),
        hasKey
      }
    })
    return [codex, claude, ...apiStatuses]
  }

  async analyze(input: AnalysisInput): Promise<void> {
    const settings = await this.settingsStore.load()
    const provider = settings.providers.selected
    const config = settings.providers[provider]
    if (!config.enabled) throw new Error(`${providerNames[provider]} is disabled`)
    input.onEvent({ type: 'started', requestId: input.metadata.requestId })
    if (provider === 'codex') await this.analyzeCodex(input, settings)
    else if (provider === 'claude') await this.analyzeClaude(input, settings)
    else if (provider === 'openai') await this.analyzeOpenAi(input, settings)
    else if (provider === 'mistral') {
      await this.analyzeChatCompletions(input, settings, 'mistral')
    }
    else if (provider === 'openai-compatible') {
      await this.analyzeChatCompletions(input, settings, 'openai-compatible')
    } else if (provider === 'anthropic') await this.analyzeAnthropic(input, settings)
    else await this.analyzeGemini(input, settings)
    input.onEvent({ type: 'completed', requestId: input.metadata.requestId })
  }

  private async codexStatus(settings: AppSettings): Promise<ProviderStatus> {
    const config = settings.providers.codex
    const base: ProviderStatus = {
      id: 'codex',
      name: providerNames.codex,
      kind: 'cli',
      enabled: config.enabled,
      selected: settings.providers.selected === 'codex',
      installed: false,
      authenticated: false,
      ready: false,
      detail: 'Codex CLI was not found.',
      model: config.model,
      models: [],
      hasKey: false
    }
    let rpc: CodexRpc | undefined
    try {
      rpc = new CodexRpc(config.binaryPath)
      await rpc.initialize()
      const [accountResult, modelResult] = await Promise.all([
        rpc.request('account/read', {}),
        rpc.request('model/list', { limit: 100 })
      ])
      const account = accountResult?.account
      const modelEntries: any[] = Array.isArray(modelResult?.data) ? modelResult.data : []
      const models = modelEntries
        .map((item: any) => item?.model ?? item?.id ?? item?.slug)
        .filter((value: unknown): value is string => typeof value === 'string')
      const selectedModel = config.model || models[0] || ''
      const selectedModelEntry = modelEntries.find(
        (item: any) => (item?.model ?? item?.id ?? item?.slug) === selectedModel
      )
      const reasoningEfforts = Array.isArray(selectedModelEntry?.supportedReasoningEfforts)
        ? selectedModelEntry.supportedReasoningEfforts
            .map((item: any) => item?.reasoningEffort)
            .filter(
              (value: unknown): value is ReasoningEffort =>
                reasoningEffortSchema.safeParse(value).success
            )
        : []
      const defaultReasoningEffort = reasoningEffortSchema.safeParse(
        selectedModelEntry?.defaultReasoningEffort
      )
      const authenticated = Boolean(account)
      const authLabel =
        account?.type === 'chatgpt'
          ? account?.planType
            ? `ChatGPT ${String(account.planType)}`
            : 'ChatGPT subscription'
          : account?.type === 'apiKey'
            ? 'Codex API key login'
            : authenticated
              ? 'Codex login'
              : undefined
      return {
        ...base,
        installed: true,
        authenticated,
        ready: config.enabled && authenticated,
        detail: authenticated
          ? 'Uses your existing Codex login and its plan limits.'
          : 'Run “codex login” in Terminal, then refresh.',
        ...(authLabel ? { authLabel } : {}),
        model: selectedModel,
        models,
        reasoningEfforts,
        ...(defaultReasoningEffort.success
          ? { defaultReasoningEffort: defaultReasoningEffort.data }
          : {})
      }
    } catch (error) {
      const detail = errorMessage(error)
      const missing = /ENOENT|not found|spawn/i.test(detail)
      return {
        ...base,
        installed: !missing,
        detail: missing
          ? `Codex CLI was not found at “${config.binaryPath}”.`
          : safeDetail(detail, 'Codex is unavailable')
      }
    } finally {
      rpc?.close()
    }
  }

  private async claudeStatus(settings: AppSettings): Promise<ProviderStatus> {
    const config = settings.providers.claude
    const base: ProviderStatus = {
      id: 'claude',
      name: providerNames.claude,
      kind: 'cli',
      enabled: config.enabled,
      selected: settings.providers.selected === 'claude',
      installed: false,
      authenticated: false,
      ready: false,
      detail: 'Claude Code CLI was not found.',
      model: config.model,
      models: ['sonnet', 'opus', 'fable'],
      reasoningEfforts: ['low', 'medium', 'high', 'xhigh', 'max'],
      hasKey: false
    }
    try {
      const version = await commandResult(config.binaryPath, ['--version'])
      if (version.code !== 0) throw new Error(version.stderr || 'Claude version probe failed')
      const auth = await commandResult(config.binaryPath, ['auth', 'status', '--json'])
      let account: any = null
      try {
        account = JSON.parse(auth.stdout)
      } catch {
        // Older Claude versions may not support structured auth status.
      }
      const authenticated = auth.code === 0 && Boolean(account?.loggedIn ?? auth.stdout.trim())
      return {
        ...base,
        installed: true,
        authenticated,
        ready: config.enabled && authenticated,
        detail: authenticated
          ? `Claude Code ${version.stdout.trim()} is authenticated.`
          : 'Run “claude auth login” in Terminal, then refresh.',
        ...(authenticated ? { authLabel: 'Claude account' } : {})
      }
    } catch (error) {
      const detail = errorMessage(error)
      const missing = /ENOENT|not found|spawn/i.test(detail)
      return {
        ...base,
        installed: !missing,
        detail: missing
          ? `Claude Code CLI was not found at “${config.binaryPath}”.`
          : safeDetail(detail, 'Claude Code is unavailable')
      }
    }
  }

  private async analyzeCodex(input: AnalysisInput, settings: AppSettings): Promise<void> {
    const config = settings.providers.codex
    const rpc = new CodexRpc(config.binaryPath, input.signal)
    let completed = false
    let turnError = ''
    const done = new Promise<void>((resolve) => {
      rpc.onNotification((message) => {
        if (message.method === 'item/agentMessage/delta') {
          const delta = message.params?.delta
          if (typeof delta === 'string') input.onEvent({ type: 'delta', text: delta })
        }
        if (message.method === 'turn/completed') {
          completed = true
          const turn = message.params?.turn
          if (turn?.status === 'failed') {
            turnError = safeDetail(turn?.error?.message, 'Codex turn failed')
          }
          resolve()
        }
        if (message.method === 'error') {
          turnError = safeDetail(message.params?.message, 'Codex turn failed')
          resolve()
        }
      })
    })
    try {
      await rpc.initialize()
      const thread = await rpc.request('thread/start', {
        cwd: process.cwd(),
        approvalPolicy: 'never',
        approvalsReviewer: 'user',
        sandbox: 'read-only',
        ephemeral: true,
        ...(config.model ? { model: config.model } : {})
      })
      await rpc.request('turn/start', {
        threadId: thread.thread.id,
        input: [
          { type: 'text', text: buildPrompt(input.metadata) },
          { type: 'image', url: dataUrl(input.image) }
        ],
        approvalPolicy: 'never',
        sandboxPolicy: { type: 'readOnly' },
        ...codexTurnOptions(config.reasoningEffort, input.metadata.mode, config.model)
      })
      await Promise.race([
        done,
        new Promise<never>((_, reject) => {
          input.signal.addEventListener('abort', () => reject(createAbortError()), { once: true })
        })
      ])
      if (!completed || turnError) throw new Error(turnError || 'Codex turn ended unexpectedly')
      input.onEvent(usageEvent('codex', config.model || 'default'))
    } finally {
      rpc.close()
    }
  }

  private async analyzeClaude(input: AnalysisInput, settings: AppSettings): Promise<void> {
    const config = settings.providers.claude
    const request = {
      type: 'user',
      session_id: '',
      parent_tool_use_id: null,
      message: {
        role: 'user',
        content: [
          { type: 'text', text: buildPrompt(input.metadata) },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: input.image.toString('base64')
            }
          }
        ]
      }
    }
    const result = await commandResult(
      config.binaryPath,
      claudeArguments(config.model, config.reasoningEffort, input.metadata.mode),
      {
        signal: input.signal,
        stdin: `${JSON.stringify(request)}\n`,
        timeoutMs: 180_000
      }
    )
    const parsed = parseClaudeOutput(result.stdout)
    if (result.code !== 0 || parsed.error) {
      throw new Error(parsed.error || safeDetail(result.stderr, 'Claude request failed'))
    }
    if (!parsed.answer.trim()) throw new Error('Claude returned no answer')
    input.onEvent({ type: 'delta', text: parsed.answer })
    input.onEvent(
      usageEvent('claude', config.model, parsed.inputTokens, parsed.outputTokens)
    )
  }

  private async keyFor(provider: ProviderId): Promise<string> {
    const secrets = (await this.secretsFile.read()) ?? {}
    const key = secrets[provider]
    if (!key) throw new Error(`Add an API key for ${providerNames[provider]} in Providers`)
    return key
  }

  private async analyzeOpenAi(
    input: AnalysisInput,
    settings: AppSettings
  ): Promise<void> {
    const id = 'openai'
    const config = settings.providers[id]
    const key = await this.keyFor(id)
    const url = `${config.baseUrl.replace(/\/+$/, '')}/responses`
    const prompt = buildPrompt(input.metadata)
    const body = {
      model: config.model,
      stream: true,
      input: [
        ...input.metadata.conversation.map((turn) => ({
          role: turn.role,
          content: turn.content
        })),
        {
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            { type: 'input_image', image_url: dataUrl(input.image), detail: 'auto' }
          ]
        }
      ]
    }
    const response = await requireOk(
      await fetch(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${key}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: input.signal
      })
    )
    let inputTokens = 0
    let outputTokens = 0
    await readSse(
      response,
      (_event, payload) => {
        const delta =
          payload?.type === 'response.output_text.delta' ? payload.delta : ''
        if (typeof delta === 'string' && delta) input.onEvent({ type: 'delta', text: delta })
        const usage = payload?.response?.usage ?? payload?.usage
        inputTokens = usage?.input_tokens ?? inputTokens
        outputTokens = usage?.output_tokens ?? outputTokens
      },
      input.signal
    )
    input.onEvent(usageEvent(id, config.model, inputTokens, outputTokens))
  }

  private async analyzeChatCompletions(
    input: AnalysisInput,
    settings: AppSettings,
    id: 'mistral' | 'openai-compatible'
  ): Promise<void> {
    const config = settings.providers[id]
    const key = await this.keyFor(id)
    const imageUrl =
      id === 'mistral'
        ? dataUrl(input.image)
        : { url: dataUrl(input.image) }
    const body = {
      model: config.model,
      stream: true,
      messages: [
        ...input.metadata.conversation,
        {
          role: 'user',
          content: [
            { type: 'text', text: buildPrompt(input.metadata) },
            { type: 'image_url', image_url: imageUrl }
          ]
        }
      ],
      ...(id === 'openai-compatible'
        ? { stream_options: { include_usage: true } }
        : {})
    }
    const response = await requireOk(
      await fetch(`${config.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${key}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: input.signal
      })
    )
    let inputTokens = 0
    let outputTokens = 0
    await readSse(
      response,
      (_event, payload) => {
        const delta = payload?.choices?.[0]?.delta?.content
        if (typeof delta === 'string' && delta) input.onEvent({ type: 'delta', text: delta })
        inputTokens = payload?.usage?.prompt_tokens ?? inputTokens
        outputTokens = payload?.usage?.completion_tokens ?? outputTokens
      },
      input.signal
    )
    input.onEvent(usageEvent(id, config.model, inputTokens, outputTokens))
  }

  private async analyzeAnthropic(input: AnalysisInput, settings: AppSettings): Promise<void> {
    const config = settings.providers.anthropic
    const key = await this.keyFor('anthropic')
    const response = await requireOk(
      await fetch(`${config.baseUrl.replace(/\/+$/, '')}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: input.metadata.mode === 'deep' ? 4_096 : 2_048,
          stream: true,
          messages: [
            ...input.metadata.conversation,
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/png',
                    data: input.image.toString('base64')
                  }
                },
                { type: 'text', text: buildPrompt(input.metadata) }
              ]
            }
          ]
        }),
        signal: input.signal
      })
    )
    let inputTokens = 0
    let outputTokens = 0
    await readSse(
      response,
      (event, payload) => {
        if (
          event === 'content_block_delta' &&
          payload?.delta?.type === 'text_delta' &&
          typeof payload.delta.text === 'string'
        ) {
          input.onEvent({ type: 'delta', text: payload.delta.text })
        }
        inputTokens = payload?.message?.usage?.input_tokens ?? inputTokens
        outputTokens = payload?.usage?.output_tokens ?? outputTokens
      },
      input.signal
    )
    input.onEvent(usageEvent('anthropic', config.model, inputTokens, outputTokens))
  }

  private async analyzeGemini(input: AnalysisInput, settings: AppSettings): Promise<void> {
    const config = settings.providers.gemini
    const key = await this.keyFor('gemini')
    const model = encodeURIComponent(config.model)
    const response = await requireOk(
      await fetch(
        `${config.baseUrl.replace(/\/+$/, '')}/models/${model}:streamGenerateContent?alt=sse`,
        {
          method: 'POST',
          headers: {
            'x-goog-api-key': key,
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            contents: [
              ...input.metadata.conversation.map((turn) => ({
                role: turn.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: turn.content }]
              })),
              {
                role: 'user',
                parts: [
                  {
                    inline_data: {
                      mime_type: 'image/png',
                      data: input.image.toString('base64')
                    }
                  },
                  { text: buildPrompt(input.metadata) }
                ]
              }
            ]
          }),
          signal: input.signal
        }
      )
    )
    let inputTokens = 0
    let outputTokens = 0
    await readSse(
      response,
      (_event, payload) => {
        for (const part of payload?.candidates?.[0]?.content?.parts ?? []) {
          if (typeof part?.text === 'string') input.onEvent({ type: 'delta', text: part.text })
        }
        inputTokens = payload?.usageMetadata?.promptTokenCount ?? inputTokens
        outputTokens = payload?.usageMetadata?.candidatesTokenCount ?? outputTokens
      },
      input.signal
    )
    input.onEvent(usageEvent('gemini', config.model, inputTokens, outputTokens))
  }
}

export const providerInternals = {
  buildPrompt,
  claudeArguments,
  codexTurnOptions,
  parseClaudeOutput,
  resolveReasoningEffort,
  safeDetail
}
