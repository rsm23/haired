import { describe, expect, it } from 'vitest'
import {
  analysisMetadataSchema,
  appSettingsSchema,
  captureRegionSchema,
  CODE_ANSWER_INSTRUCTION,
  CODE_ONLY_ANSWER_INSTRUCTION,
  DEFAULT_INSTRUCTION,
  SCREEN_TASK_INSTRUCTION,
  streamEventSchema
} from './index'

describe('shared contracts', () => {
  it('applies privacy-preserving desktop defaults', () => {
    const settings = appSettingsSchema.parse({})
    expect(settings.defaultMode).toBe('fast')
    expect(settings.codeResponseStyle).toBe('full-reply')
    expect(settings.themeColor).toBe('black')
    expect(settings.launchAtLogin).toBe(false)
    expect(settings.magnifyingGlassCursor).toBe(false)
    expect(settings.historyAutoDeleteDays).toBeNull()
    expect(settings.shortcuts.moveOverlay).toBe('CommandOrControl+Alt')
    expect(settings.defaultInstruction).toBe(DEFAULT_INSTRUCTION)
    expect(settings.defaultInstruction).toContain(CODE_ANSWER_INSTRUCTION)
    expect(settings.defaultInstruction).toContain(SCREEN_TASK_INSTRUCTION)
    expect(settings.defaultInstruction).toContain(
      'solve it instead of merely describing or summarizing it'
    )
    expect(settings.defaultInstruction).toContain('complete, directly usable code')
    expect(settings.defaultInstruction).toContain('fenced Markdown code block')
    expect(CODE_ONLY_ANSWER_INSTRUCTION).toContain('only complete fenced Markdown code blocks')
    expect(settings.providers.selected).toBe('codex')
    expect(settings.providers.codex).toMatchObject({
      enabled: true,
      binaryPath: 'codex',
      reasoningEffort: 'auto'
    })
    expect(settings.providers.claude.reasoningEffort).toBe('auto')
    expect(settings.providers['lm-studio']).toMatchObject({
      enabled: false,
      baseUrl: 'http://127.0.0.1:1234/v1',
      model: ''
    })
    expect(settings.providers.ollama).toMatchObject({
      enabled: false,
      baseUrl: 'http://127.0.0.1:11434',
      model: ''
    })
    expect(settings.providers.openai.enabled).toBe(false)
  })

  it('migrates existing CLI settings to independent reasoning defaults', () => {
    const settings = appSettingsSchema.parse({
      providers: {
        codex: { enabled: true, binaryPath: 'codex', model: 'gpt-5.6-sol' },
        claude: { enabled: true, binaryPath: 'claude', model: 'sonnet' }
      }
    })

    expect(settings.providers.codex.reasoningEffort).toBe('auto')
    expect(settings.providers.claude.reasoningEffort).toBe('auto')
  })

  it('rejects unsupported CLI reasoning settings', () => {
    expect(() =>
      appSettingsSchema.parse({
        providers: {
          claude: {
            enabled: true,
            binaryPath: 'claude',
            model: 'sonnet',
            reasoningEffort: 'ultra'
          }
        }
      })
    ).toThrow('Claude Code does not support Ultra reasoning')
  })

  it('accepts supported themes and rejects unknown colors', () => {
    expect(appSettingsSchema.parse({ themeColor: 'blue' }).themeColor).toBe('blue')
    expect(appSettingsSchema.parse({ themeColor: 'black' }).themeColor).toBe('black')
    expect(() => appSettingsSchema.parse({ themeColor: 'rainbow' })).toThrow()
  })

  it('rejects oversized prompts and empty capture regions', () => {
    expect(() =>
      analysisMetadataSchema.parse({
        requestId: crypto.randomUUID(),
        mode: 'fast',
        prompt: 'x'.repeat(4_001),
        conversation: []
      })
    ).toThrow()
    expect(() => captureRegionSchema.parse({ x: 0, y: 0, width: 0, height: 20 })).toThrow()
  })

  it('defaults old analysis metadata to full replies', () => {
    expect(
      analysisMetadataSchema.parse({
        requestId: crypto.randomUUID(),
        mode: 'fast',
        prompt: 'Solve this',
        conversation: []
      }).codeResponseStyle
    ).toBe('full-reply')
  })

  it('validates every streaming event shape', () => {
    expect(
      streamEventSchema.parse({
        type: 'error',
        code: 'provider_unavailable',
        message: 'Provider temporarily unavailable',
        retryable: true
      })
    ).toMatchObject({ type: 'error', retryable: true })
  })
})
