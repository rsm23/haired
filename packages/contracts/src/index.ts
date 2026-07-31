import { z } from 'zod'

export const analysisModeSchema = z.enum(['fast', 'deep'])
export type AnalysisMode = z.infer<typeof analysisModeSchema>

export const codeResponseStyleSchema = z.enum(['code-only', 'full-reply'])
export type CodeResponseStyle = z.infer<typeof codeResponseStyleSchema>

export const themeColorSchema = z.enum([
  'blue',
  'green',
  'red',
  'yellow',
  'orange',
  'gray',
  'black',
  'purple'
])
export type ThemeColor = z.infer<typeof themeColorSchema>

export const reasoningEffortSchema = z.enum([
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
  'ultra'
])
export type ReasoningEffort = z.infer<typeof reasoningEffortSchema>

export const cliReasoningSettingSchema = z.union([
  z.literal('auto'),
  reasoningEffortSchema
])
export type CliReasoningSetting = z.infer<typeof cliReasoningSettingSchema>

export const LEGACY_DEFAULT_INSTRUCTION =
  'Analyze the selected screen region and answer concisely and accurately.'

export const PREVIOUS_DEFAULT_INSTRUCTION = [
  'Analyze the selected screen region and answer accurately using the visible context.',
  'Resolve straightforward ambiguity from the screen when possible, and state any important assumption.',
  [
    'When the request concerns code:',
    '- Answer with code, not prose alone.',
    '- Return the complete, directly usable code for every file or block you propose changing, including required imports, types, configuration, and error handling.',
    '- Do not replace required code with ellipses, placeholder comments, or partial snippets.',
    '- Put every code sample in a fenced Markdown code block with an accurate language tag such as `typescript`, `python`, or `bash` so the app can syntax-highlight it.'
  ].join('\n'),
  'For non-code requests, answer directly and keep the explanation focused unless more depth is requested.'
].join('\n\n')

export const SCREEN_TASK_INSTRUCTION = [
  'Infer and complete the actionable task shown in the selected region.',
  'If it contains a programming exercise, implementation requirements, a TODO, a bug, an error, or a code question, solve it instead of merely describing or summarizing it.',
  'If starter code is not visible, state the smallest reasonable stack assumptions and provide a complete self-contained reference implementation that satisfies every visible required behavior.'
].join('\n')

export const CODE_ANSWER_INSTRUCTION = [
  'When the request or selected screen concerns code:',
  '- Answer with code, not prose alone.',
  '- Return the complete, directly usable code for every file or block you propose changing, including required imports, types, configuration, and error handling.',
  '- Do not replace required code with ellipses, placeholder comments, or partial snippets.',
  '- Put every code sample in a fenced Markdown code block with an accurate language tag such as `typescript`, `python`, or `bash` so the app can syntax-highlight it.'
].join('\n')

export const CODE_ONLY_ANSWER_INSTRUCTION = [
  'When the request or selected screen concerns code, return only complete fenced Markdown code blocks.',
  '- Do not put explanations, headings, filenames, or other prose outside the code fences.',
  '- Include every required file or block in full, with an accurate language tag, and never use ellipses or placeholder comments.',
  'When the request is not about code, answer normally.'
].join('\n')

export const DEFAULT_INSTRUCTION = [
  'Analyze the selected screen region, infer the user’s likely intent, and complete the task shown.',
  'Resolve straightforward ambiguity from the screen when possible, and state any important assumption.',
  SCREEN_TASK_INSTRUCTION,
  CODE_ANSWER_INSTRUCTION,
  'For non-code requests, answer directly and keep the explanation focused unless more depth is requested.'
].join('\n\n')

export const providerIdSchema = z.enum([
  'codex',
  'claude',
  'lm-studio',
  'ollama',
  'openai',
  'anthropic',
  'gemini',
  'mistral',
  'openai-compatible'
])
export type ProviderId = z.infer<typeof providerIdSchema>

const cliProviderSettingsBase = {
  enabled: z.boolean(),
  binaryPath: z.string().trim().min(1).max(1_024),
  model: z.string().trim().max(160)
}

const codexCliProviderSettingsSchema = z.object({
  ...cliProviderSettingsBase,
  reasoningEffort: cliReasoningSettingSchema.default('auto')
})

const claudeCliProviderSettingsSchema = z.object({
  ...cliProviderSettingsBase,
  reasoningEffort: cliReasoningSettingSchema
    .refine((value) => value !== 'ultra', {
      message: 'Claude Code does not support Ultra reasoning'
    })
    .default('auto')
})

const apiProviderSettingsSchema = z.object({
  enabled: z.boolean(),
  baseUrl: z.string().url().max(2_048),
  model: z.string().trim().min(1).max(160)
})

const localProviderSettingsSchema = z.object({
  enabled: z.boolean(),
  baseUrl: z.string().url().max(2_048),
  model: z.string().trim().max(160)
})

export const providerSettingsSchema = z.object({
  selected: providerIdSchema.default('codex'),
  codex: codexCliProviderSettingsSchema.default({
    enabled: true,
    binaryPath: 'codex',
    model: '',
    reasoningEffort: 'auto'
  }),
  claude: claudeCliProviderSettingsSchema.default({
    enabled: false,
    binaryPath: 'claude',
    model: 'sonnet',
    reasoningEffort: 'auto'
  }),
  'lm-studio': localProviderSettingsSchema.default({
    enabled: false,
    baseUrl: 'http://127.0.0.1:1234/v1',
    model: ''
  }),
  ollama: localProviderSettingsSchema.default({
    enabled: false,
    baseUrl: 'http://127.0.0.1:11434',
    model: ''
  }),
  openai: apiProviderSettingsSchema.default({
    enabled: false,
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5.6-terra'
  }),
  anthropic: apiProviderSettingsSchema.default({
    enabled: false,
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-sonnet-4-6'
  }),
  gemini: apiProviderSettingsSchema.default({
    enabled: false,
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-3.5-flash'
  }),
  mistral: apiProviderSettingsSchema.default({
    enabled: false,
    baseUrl: 'https://api.mistral.ai/v1',
    model: 'mistral-small-latest'
  }),
  'openai-compatible': apiProviderSettingsSchema.default({
    enabled: false,
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-5.6'
  })
})
export type ProviderSettings = z.infer<typeof providerSettingsSchema>

export const providerStatusSchema = z.object({
  id: providerIdSchema,
  name: z.string(),
  kind: z.enum(['cli', 'local', 'byok']),
  enabled: z.boolean(),
  selected: z.boolean(),
  installed: z.boolean(),
  authenticated: z.boolean(),
  ready: z.boolean(),
  detail: z.string(),
  authLabel: z.string().optional(),
  model: z.string(),
  models: z.array(z.string()),
  reasoningEfforts: z.array(reasoningEffortSchema).optional(),
  defaultReasoningEffort: reasoningEffortSchema.optional(),
  hasKey: z.boolean()
})
export type ProviderStatus = z.infer<typeof providerStatusSchema>

export const conversationTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(20_000)
})
export type ConversationTurn = z.infer<typeof conversationTurnSchema>

export const analysisMetadataSchema = z.object({
  requestId: z.string().uuid(),
  mode: analysisModeSchema,
  codeResponseStyle: codeResponseStyleSchema.default('full-reply'),
  interaction: z.enum(['instant', 'ask']).optional(),
  prompt: z.string().min(1).max(4_000),
  conversation: z.array(conversationTurnSchema).max(20).default([])
})
type ParsedAnalysisMetadata = z.infer<typeof analysisMetadataSchema>
export type AnalysisMetadata = Omit<ParsedAnalysisMetadata, 'codeResponseStyle'> & {
  codeResponseStyle?: CodeResponseStyle
}

export const streamEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('started'),
    requestId: z.string().uuid()
  }),
  z.object({ type: z.literal('delta'), text: z.string() }),
  z.object({
    type: z.literal('usage'),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    provider: z.string(),
    model: z.string()
  }),
  z.object({
    type: z.literal('completed'),
    requestId: z.string().uuid()
  }),
  z.object({
    type: z.literal('error'),
    code: z.enum([
      'invalid_request',
      'authentication_required',
      'rate_limited',
      'provider_unavailable',
      'provider_not_configured',
      'canceled',
      'internal_error'
    ]),
    message: z.string().max(500),
    retryable: z.boolean()
  })
])
export type StreamEvent = z.infer<typeof streamEventSchema>

export const appSettingsSchema = z.object({
  defaultMode: analysisModeSchema.default('fast'),
  codeResponseStyle: codeResponseStyleSchema.default('full-reply'),
  themeColor: themeColorSchema.default('black'),
  defaultInstruction: z
    .string()
    .min(1)
    .max(4_000)
    .default(DEFAULT_INSTRUCTION),
  launchAtLogin: z.boolean().default(false),
  overlayOpacity: z.number().min(0.62).max(0.98).default(0.88),
  magnifyingGlassCursor: z.boolean().default(false),
  historyAutoDeleteDays: z.number().int().positive().nullable().default(null),
  providers: providerSettingsSchema.default({}),
  shortcuts: z
    .object({
      instant: z.string().default('CommandOrControl+Shift+Space'),
      ask: z.string().default('CommandOrControl+Shift+Enter'),
      settings: z.string().default('CommandOrControl+Shift+H'),
      moveOverlay: z.string().default('CommandOrControl+Alt')
    })
    .default({})
})
export type AppSettings = z.infer<typeof appSettingsSchema>

export const captureRegionSchema = z.object({
  x: z.number().nonnegative(),
  y: z.number().nonnegative(),
  width: z.number().positive(),
  height: z.number().positive()
})
export type CaptureRegion = z.infer<typeof captureRegionSchema>

export const localHistoryRecordSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  mode: analysisModeSchema,
  codeResponseStyle: codeResponseStyleSchema.default('full-reply'),
  title: z.string(),
  question: z.string(),
  answer: z.string(),
  screenshotDataUrl: z.string().startsWith('data:image/png;base64,'),
  byteSize: z.number().int().nonnegative(),
  provider: z.string().optional(),
  model: z.string().optional()
})
export type LocalHistoryRecord = z.infer<typeof localHistoryRecordSchema>

export const historySummarySchema = localHistoryRecordSchema.omit({
  question: true,
  answer: true,
  screenshotDataUrl: true
}).extend({
  thumbnailDataUrl: z.string().startsWith('data:image/png;base64,')
})
export type HistorySummary = z.infer<typeof historySummarySchema>

export const ipcResultSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), data }),
    z.object({ ok: z.literal(false), error: z.string() })
  ])
