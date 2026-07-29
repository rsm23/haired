import { describe, expect, it } from 'vitest'
import {
  appSettingsSchema,
  DEFAULT_INSTRUCTION,
  LEGACY_DEFAULT_INSTRUCTION,
  PREVIOUS_DEFAULT_INSTRUCTION
} from '@haired/contracts'
import { migrateBuiltInInstruction } from './settings-store'

describe('settings migration', () => {
  it.each([LEGACY_DEFAULT_INSTRUCTION, PREVIOUS_DEFAULT_INSTRUCTION])(
    'expands a previous built-in instruction',
    (defaultInstruction) => {
    const settings = appSettingsSchema.parse({
        defaultInstruction
    })

    expect(migrateBuiltInInstruction(settings).defaultInstruction).toBe(DEFAULT_INSTRUCTION)
    }
  )

  it('preserves custom instructions exactly', () => {
    const settings = appSettingsSchema.parse({
      defaultInstruction: 'Use my custom response style.'
    })

    expect(migrateBuiltInInstruction(settings)).toBe(settings)
  })
})
