import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import {
  appSettingsSchema,
  DEFAULT_INSTRUCTION,
  type AppSettings,
  type ProviderId,
  type StreamEvent
} from '@haired/contracts'
import { ProviderManager, providerInternals } from './provider-manager'
import type { ProtectedFile } from './secure-storage'
import type { SettingsStore } from './settings-store'

class MemorySecrets {
  value: Partial<Record<ProviderId, string>> | null = null

  async read() {
    return this.value
  }

  async write(value: Partial<Record<ProviderId, string>>) {
    this.value = { ...value }
  }

  async clear() {
    this.value = null
  }
}

function managerFor(settings: AppSettings, secrets = new MemorySecrets()) {
  const store = {
    load: async () => settings
  } as unknown as SettingsStore
  return {
    manager: new ProviderManager(
      store,
      secrets as unknown as ProtectedFile<Partial<Record<ProviderId, string>>>
    ),
    secrets
  }
}

describe('provider manager', () => {
  it('stores BYOK secrets without exposing their value in status', async () => {
    const settings = appSettingsSchema.parse({
      providers: {
        selected: 'openai',
        openai: {
          enabled: true,
          baseUrl: 'https://api.openai.com/v1',
          model: 'gpt-5.6-terra'
        }
      }
    })
    const { manager, secrets } = managerFor(settings)

    await manager.setApiKey('openai', 'sk-test-never-return-this')
    expect(secrets.value?.openai).toBe('sk-test-never-return-this')
    const status = (await manager.statuses()).find((item) => item.id === 'openai')
    expect(status).toMatchObject({ hasKey: true, authenticated: true, ready: true })
    expect(JSON.stringify(status)).not.toContain('sk-test')

    await manager.clearApiKey('openai')
    expect(secrets.value).toBeNull()
  })

  it('streams an OpenAI Responses BYOK request directly to the caller', async () => {
    const settings = appSettingsSchema.parse({
      providers: {
        selected: 'openai',
        openai: {
          enabled: true,
          baseUrl: 'https://api.openai.com/v1',
          model: 'gpt-5.6-terra'
        }
      }
    })
    const { manager, secrets } = managerFor(settings)
    secrets.value = { openai: 'sk-local-test-key' }
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ authorization: 'Bearer sk-local-test-key' })
      const body = JSON.parse(String(init?.body))
      expect(body.input.at(-1).content[1].image_url).toMatch(
        /^data:image\/png;base64,/
      )
      return new Response(
        [
          'event: response.output_text.delta',
          'data: {"type":"response.output_text.delta","delta":"HAIRED"}',
          '',
          'event: response.completed',
          'data: {"type":"response.completed","response":{"usage":{"input_tokens":7,"output_tokens":2}}}',
          '',
          ''
        ].join('\n'),
        { status: 200, headers: { 'content-type': 'text/event-stream' } }
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    const events: StreamEvent[] = []

    await manager.analyze({
      image: Buffer.from('image'),
      metadata: {
        requestId: crypto.randomUUID(),
        mode: 'fast',
        prompt: 'What is shown?',
        conversation: []
      },
      signal: new AbortController().signal,
      onEvent: (event) => events.push(event)
    })

    expect(events.map((event) => event.type)).toEqual([
      'started',
      'delta',
      'usage',
      'completed'
    ])
    expect(events.find((event) => event.type === 'delta')).toMatchObject({
      text: 'HAIRED'
    })
    expect(events.find((event) => event.type === 'usage')).toMatchObject({
      provider: 'openai',
      model: 'gpt-5.6-terra',
      inputTokens: 7,
      outputTokens: 2
    })
    vi.unstubAllGlobals()
  })

  it('refreshes LM Studio and Ollama model options from their downloaded models', async () => {
    const settings = appSettingsSchema.parse({
      providers: {
        'lm-studio': {
          enabled: true,
          baseUrl: 'http://127.0.0.1:1234/v1',
          model: 'qwen2-vl'
        },
        ollama: {
          enabled: true,
          baseUrl: 'http://127.0.0.1:11434',
          model: 'llava:latest'
        }
      }
    })
    const { manager } = managerFor(settings)
    let refresh = 0
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const address = String(url)
      if (address.endsWith('/v1/models')) {
        return Response.json({
          data: refresh === 0 ? [{ id: 'qwen2-vl' }, { id: 'pixtral-12b' }] : [{ id: 'gemma-3-12b' }]
        })
      }
      if (address.endsWith('/api/tags')) {
        const response = Response.json({
          models:
            refresh === 0
              ? [{ model: 'llava:latest' }, { name: 'gemma3:12b' }]
              : [{ model: 'qwen2.5vl:7b' }]
        })
        refresh += 1
        return response
      }
      throw new Error(`Unexpected URL: ${address}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const first = await manager.statuses()
    expect(first.find((provider) => provider.id === 'lm-studio')).toMatchObject({
      ready: true,
      models: ['pixtral-12b', 'qwen2-vl']
    })
    expect(first.find((provider) => provider.id === 'ollama')).toMatchObject({
      ready: true,
      models: ['gemma3:12b', 'llava:latest']
    })

    const refreshed = await manager.statuses()
    expect(refreshed.find((provider) => provider.id === 'lm-studio')).toMatchObject({
      ready: false,
      models: ['gemma-3-12b']
    })
    expect(refreshed.find((provider) => provider.id === 'ollama')).toMatchObject({
      ready: false,
      models: ['qwen2.5vl:7b']
    })
    expect(fetchMock).toHaveBeenCalledTimes(4)
    vi.unstubAllGlobals()
  })

  it('streams a vision request through LM Studio without an API key', async () => {
    const settings = appSettingsSchema.parse({
      providers: {
        selected: 'lm-studio',
        'lm-studio': {
          enabled: true,
          baseUrl: 'http://127.0.0.1:1234',
          model: 'qwen2-vl'
        }
      }
    })
    const { manager } = managerFor(settings)
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('http://127.0.0.1:1234/v1/chat/completions')
      expect(init?.headers).not.toHaveProperty('authorization')
      const body = JSON.parse(String(init?.body))
      expect(body).toMatchObject({
        model: 'qwen2-vl',
        stream: true,
        stream_options: { include_usage: true }
      })
      expect(body.messages.at(-1).content[1]).toMatchObject({
        type: 'image_url',
        image_url: { url: expect.stringMatching(/^data:image\/png;base64,/) }
      })
      return new Response(
        [
          'data: {"choices":[{"delta":{"content":"LOCAL_OK"}}]}',
          '',
          'data: {"choices":[],"usage":{"prompt_tokens":5,"completion_tokens":2}}',
          '',
          ''
        ].join('\n'),
        { headers: { 'content-type': 'text/event-stream' } }
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    const events: StreamEvent[] = []

    await manager.analyze({
      image: Buffer.from('image'),
      metadata: {
        requestId: crypto.randomUUID(),
        mode: 'fast',
        prompt: 'Analyze',
        conversation: []
      },
      signal: new AbortController().signal,
      onEvent: (event) => events.push(event)
    })

    expect(events.find((event) => event.type === 'delta')).toMatchObject({ text: 'LOCAL_OK' })
    expect(events.find((event) => event.type === 'usage')).toMatchObject({
      provider: 'lm-studio',
      model: 'qwen2-vl',
      inputTokens: 5,
      outputTokens: 2
    })
    expect(events.at(-1)?.type).toBe('completed')
    vi.unstubAllGlobals()
  })

  it('streams Ollama NDJSON with the selected crop as an image', async () => {
    const settings = appSettingsSchema.parse({
      providers: {
        selected: 'ollama',
        ollama: {
          enabled: true,
          baseUrl: 'http://127.0.0.1:11434/api/',
          model: 'gemma3:12b'
        }
      }
    })
    const { manager } = managerFor(settings)
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('http://127.0.0.1:11434/api/chat')
      const body = JSON.parse(String(init?.body))
      expect(body).toMatchObject({ model: 'gemma3:12b', stream: true })
      expect(body.messages.at(-1).images).toEqual([Buffer.from('image').toString('base64')])
      return new Response(
        [
          '{"message":{"role":"assistant","content":"OLLAMA"},"done":false}',
          '{"message":{"role":"assistant","content":"_OK"},"done":false}',
          '{"message":{"role":"assistant","content":""},"done":true,"prompt_eval_count":6,"eval_count":3}',
          ''
        ].join('\n'),
        { headers: { 'content-type': 'application/x-ndjson' } }
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    const events: StreamEvent[] = []

    await manager.analyze({
      image: Buffer.from('image'),
      metadata: {
        requestId: crypto.randomUUID(),
        mode: 'deep',
        prompt: 'Analyze',
        conversation: []
      },
      signal: new AbortController().signal,
      onEvent: (event) => events.push(event)
    })

    expect(
      events
        .filter((event): event is Extract<StreamEvent, { type: 'delta' }> => event.type === 'delta')
        .map((event) => event.text)
        .join('')
    ).toBe('OLLAMA_OK')
    expect(events.find((event) => event.type === 'usage')).toMatchObject({
      provider: 'ollama',
      model: 'gemma3:12b',
      inputTokens: 6,
      outputTokens: 3
    })
    expect(events.at(-1)?.type).toBe('completed')
    vi.unstubAllGlobals()
  })

  it('redacts recognizable credentials and emails from provider diagnostics', () => {
    expect(
      providerInternals.safeDetail(
        'failed sk-proj-secretvalue for person@example.com',
        'failed'
      )
    ).toBe('failed [redacted key] for [redacted email]')
  })

  it.each([
    { setting: 'auto' as const, mode: 'fast' as const, effort: 'low' },
    { setting: 'auto' as const, mode: 'deep' as const, effort: 'high' },
    { setting: 'medium' as const, mode: 'fast' as const, effort: 'medium' },
    { setting: 'xhigh' as const, mode: 'deep' as const, effort: 'xhigh' },
    { setting: 'max' as const, mode: 'fast' as const, effort: 'max' }
  ])(
    'maps $setting with $mode analysis to $effort CLI reasoning',
    ({ setting, mode, effort }) => {
    expect(providerInternals.resolveReasoningEffort(setting, mode)).toBe(effort)
    expect(providerInternals.codexTurnOptions(setting, mode, '')).toEqual({ effort })

    const claudeArgs = providerInternals.claudeArguments('sonnet', setting, mode)
    expect(claudeArgs.slice(claudeArgs.indexOf('--effort'), claudeArgs.indexOf('--effort') + 2)).toEqual([
      '--effort',
      effort
    ])
    }
  )

  it('requires full language-tagged code in every provider prompt', () => {
    const prompt = providerInternals.buildPrompt({
      requestId: crypto.randomUUID(),
      mode: 'fast',
      prompt: 'Fix this TypeScript function.',
      conversation: []
    })

    expect(prompt).toContain('complete, directly usable code')
    expect(prompt).toContain('fenced Markdown code block')
    expect(prompt).toContain('`typescript`')
  })

  it('requests prose-free fenced blocks only in code-only mode', () => {
    const base = {
      requestId: crypto.randomUUID(),
      mode: 'fast' as const,
      prompt: 'Implement the visible task',
      conversation: []
    }

    expect(
      providerInternals.buildPrompt({ ...base, codeResponseStyle: 'code-only' })
    ).toContain('return only complete fenced Markdown code blocks')
    expect(
      providerInternals.buildPrompt({ ...base, codeResponseStyle: 'full-reply' })
    ).not.toContain('return only complete fenced Markdown code blocks')
  })

  it('treats a one-click programming exercise as a task to solve', () => {
    const prompt = providerInternals.buildPrompt({
      requestId: crypto.randomUUID(),
      mode: 'fast',
      interaction: 'instant',
      prompt: DEFAULT_INSTRUCTION,
      conversation: []
    })

    expect(prompt).toContain('did not type a separate question')
    expect(prompt).toContain('solve it instead of merely describing or summarizing it')
    expect(prompt).toContain('complete self-contained reference implementation')
  })

  it('parses Claude stream-json answers, usage, and account errors', () => {
    const answer = providerInternals.parseClaudeOutput(
      [
        '{"type":"assistant","message":{"content":[{"type":"text","text":"CLAUDE_OK"}],"usage":{"input_tokens":8,"output_tokens":3}}}',
        '{"type":"result","is_error":false}'
      ].join('\n')
    )
    expect(answer).toEqual({
      answer: 'CLAUDE_OK',
      inputTokens: 8,
      outputTokens: 3,
      error: ''
    })
    expect(
      providerInternals.parseClaudeOutput(
        '{"type":"result","is_error":true,"result":"Credit balance is too low"}'
      ).error
    ).toBe('Credit balance is too low')
  })

  it.each([
    {
      id: 'anthropic' as const,
      stream: [
        'event: message_start',
        'data: {"message":{"usage":{"input_tokens":5}}}',
        '',
        'event: content_block_delta',
        'data: {"delta":{"type":"text_delta","text":"ANTHROPIC_OK"}}',
        '',
        'event: message_delta',
        'data: {"usage":{"output_tokens":2}}',
        '',
        ''
      ].join('\n')
    },
    {
      id: 'gemini' as const,
      stream: [
        'data: {"candidates":[{"content":{"parts":[{"text":"GEMINI_OK"}]}}],"usageMetadata":{"promptTokenCount":6,"candidatesTokenCount":2}}',
        '',
        ''
      ].join('\n')
    },
    {
      id: 'openai-compatible' as const,
      stream: [
        'data: {"choices":[{"delta":{"content":"COMPATIBLE_OK"}}]}',
        '',
        'data: {"choices":[],"usage":{"prompt_tokens":4,"completion_tokens":2}}',
        '',
        ''
      ].join('\n')
    },
    {
      id: 'mistral' as const,
      stream: [
        'data: {"choices":[{"delta":{"content":"MISTRAL_OK"}}]}',
        '',
        'data: {"choices":[],"usage":{"prompt_tokens":9,"completion_tokens":2}}',
        '',
        ''
      ].join('\n')
    }
  ])('streams the $id BYOK protocol', async ({ id, stream }) => {
    const settings = appSettingsSchema.parse({
      providers: {
        selected: id,
        [id]: {
          enabled: true,
          baseUrl: 'https://provider.example/v1',
          model: 'vision-model'
        }
      }
    })
    const { manager, secrets } = managerFor(settings)
    secrets.value = { [id]: 'provider-test-key' }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(stream, { status: 200 }))
    )
    const events: StreamEvent[] = []
    await manager.analyze({
      image: Buffer.from('image'),
      metadata: {
        requestId: crypto.randomUUID(),
        mode: 'fast',
        prompt: 'Analyze',
        conversation: []
      },
      signal: new AbortController().signal,
      onEvent: (event) => events.push(event)
    })
    const answer = events
      .filter(
        (event): event is Extract<StreamEvent, { type: 'delta' }> =>
          event.type === 'delta'
      )
      .map((event) => event.text)
      .join('')
    expect(answer).toContain('_OK')
    expect(events.at(-1)?.type).toBe('completed')
    vi.unstubAllGlobals()
  })

  it('sends Mistral vision input using its documented Chat Completions shape', async () => {
    const settings = appSettingsSchema.parse({
      providers: {
        selected: 'mistral',
        mistral: {
          enabled: true,
          baseUrl: 'https://api.mistral.ai/v1/',
          model: 'mistral-small-latest'
        }
      }
    })
    const { manager, secrets } = managerFor(settings)
    secrets.value = { mistral: 'mistral-local-test-key' }
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('https://api.mistral.ai/v1/chat/completions')
      expect(init?.headers).toMatchObject({
        authorization: 'Bearer mistral-local-test-key',
        'content-type': 'application/json'
      })
      const body = JSON.parse(String(init?.body))
      expect(body).not.toHaveProperty('stream_options')
      expect(body.model).toBe('mistral-small-latest')
      expect(body.messages.at(-1).content[1]).toMatchObject({
        type: 'image_url',
        image_url: expect.stringMatching(/^data:image\/png;base64,/)
      })
      return new Response(
        [
          'data: {"choices":[{"delta":{"content":"VISION_OK"}}]}',
          '',
          'data: {"choices":[],"usage":{"prompt_tokens":8,"completion_tokens":2}}',
          '',
          ''
        ].join('\n'),
        { status: 200, headers: { 'content-type': 'text/event-stream' } }
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    const events: StreamEvent[] = []

    await manager.analyze({
      image: Buffer.from('image'),
      metadata: {
        requestId: crypto.randomUUID(),
        mode: 'fast',
        prompt: 'Analyze',
        conversation: []
      },
      signal: new AbortController().signal,
      onEvent: (event) => events.push(event)
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(events.find((event) => event.type === 'delta')).toMatchObject({
      text: 'VISION_OK'
    })
    expect(events.find((event) => event.type === 'usage')).toMatchObject({
      provider: 'mistral',
      model: 'mistral-small-latest',
      inputTokens: 8,
      outputTokens: 2
    })
    vi.unstubAllGlobals()
  })
})

const liveCodex = process.env.HAIRED_LIVE_CODEX === '1' ? it : it.skip

liveCodex.each([
  {
    mode: 'fast' as const,
    reasoningEffort: 'medium' as const,
    marker: 'HAIRED_CODEX_MEDIUM_OK'
  },
  {
    mode: 'deep' as const,
    reasoningEffort: 'xhigh' as const,
    marker: 'HAIRED_CODEX_XHIGH_OK'
  }
])(
  'runs a real $mode screenshot turn with configured $reasoningEffort Codex reasoning',
  async ({ mode, reasoningEffort, marker }) => {
  const settings = appSettingsSchema.parse({
    providers: {
      codex: {
        enabled: true,
        binaryPath: 'codex',
        model: '',
        reasoningEffort
      }
    }
  })
  const { manager } = managerFor(settings)
  const events: StreamEvent[] = []
  await manager.analyze({
    image: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZP40AAAAASUVORK5CYII=',
      'base64'
    ),
    metadata: {
      requestId: crypto.randomUUID(),
      mode,
      prompt: `Reply with exactly ${marker}`,
      conversation: []
    },
    signal: new AbortController().signal,
    onEvent: (event) => events.push(event)
  })
  const answer = events
    .filter((event): event is Extract<StreamEvent, { type: 'delta' }> => event.type === 'delta')
    .map((event) => event.text)
    .join('')
  expect(answer.trim()).toBe(marker)
  expect(events.at(-1)?.type).toBe('completed')
  },
  180_000
)

liveCodex('returns complete language-tagged code through authenticated Codex', async () => {
  const settings = appSettingsSchema.parse({})
  const { manager } = managerFor(settings)
  const events: StreamEvent[] = []
  await manager.analyze({
    image: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZP40AAAAASUVORK5CYII=',
      'base64'
    ),
    metadata: {
      requestId: crypto.randomUUID(),
      mode: 'fast',
      prompt:
        'Return only one fenced code block containing the complete contents of square.ts. It must export a TypeScript function square(value: number): number that returns the square.',
      conversation: []
    },
    signal: new AbortController().signal,
    onEvent: (event) => events.push(event)
  })
  const answer = events
    .filter((event): event is Extract<StreamEvent, { type: 'delta' }> => event.type === 'delta')
    .map((event) => event.text)
    .join('')
  expect(answer).toMatch(/```(?:typescript|ts)\n/)
  expect(answer).toContain('export function square')
  expect(answer).not.toContain('...')
}, 180_000)

const liveCodexScreenshot =
  process.env.HAIRED_LIVE_CODEX === '1' && process.env.HAIRED_LIVE_SCREENSHOT_PATH
    ? it
    : it.skip

liveCodexScreenshot(
  'solves a real selected programming exercise instead of summarizing it',
  async () => {
    const settings = appSettingsSchema.parse({})
    const { manager } = managerFor(settings)
    const events: StreamEvent[] = []
    await manager.analyze({
      image: await readFile(process.env.HAIRED_LIVE_SCREENSHOT_PATH!),
      metadata: {
        requestId: crypto.randomUUID(),
        mode: 'fast',
        interaction: 'instant',
        prompt: DEFAULT_INSTRUCTION,
        conversation: []
      },
      signal: new AbortController().signal,
      onEvent: (event) => events.push(event)
    })
    const answer = events
      .filter(
        (event): event is Extract<StreamEvent, { type: 'delta' }> => event.type === 'delta'
      )
      .map((event) => event.text)
      .join('')

    expect(answer).toMatch(/```(?:tsx|jsx|typescript|javascript)\n/)
    expect(answer).toMatch(/localStorage\.(?:getItem|setItem)/)
    expect(answer).toMatch(/checked|completed/i)
    expect(answer).not.toMatch(/^The selected region describes/i)
    expect(events.at(-1)?.type).toBe('completed')
  },
  180_000
)

const liveClaude = process.env.HAIRED_LIVE_CLAUDE === '1' ? it : it.skip

liveClaude.each([
  {
    mode: 'fast' as const,
    reasoningEffort: 'medium' as const,
    marker: 'HAIRED_CLAUDE_MEDIUM_OK'
  },
  {
    mode: 'deep' as const,
    reasoningEffort: 'high' as const,
    marker: 'HAIRED_CLAUDE_HIGH_OK'
  }
])(
  'runs a real $mode screenshot turn with configured $reasoningEffort Claude reasoning',
  async ({ mode, reasoningEffort, marker }) => {
  const settings = appSettingsSchema.parse({
    providers: {
      selected: 'claude',
      claude: {
        enabled: true,
        binaryPath: 'claude',
        model: 'sonnet',
        reasoningEffort
      }
    }
  })
  const { manager } = managerFor(settings)
  const events: StreamEvent[] = []
  await manager.analyze({
    image: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZP40AAAAASUVORK5CYII=',
      'base64'
    ),
    metadata: {
      requestId: crypto.randomUUID(),
      mode,
      prompt: `Reply with exactly ${marker}`,
      conversation: []
    },
    signal: new AbortController().signal,
    onEvent: (event) => events.push(event)
  })
  const answer = events
    .filter((event): event is Extract<StreamEvent, { type: 'delta' }> => event.type === 'delta')
    .map((event) => event.text)
    .join('')
  expect(answer.trim()).toBe(marker)
  expect(events.at(-1)?.type).toBe('completed')
  },
  180_000
)
