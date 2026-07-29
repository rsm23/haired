import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  appSettingsSchema,
  DEFAULT_INSTRUCTION,
  LEGACY_DEFAULT_INSTRUCTION,
  PREVIOUS_DEFAULT_INSTRUCTION
} from '@haired/contracts'
import { migrateBuiltInInstruction, SettingsStore } from './settings-store'

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

  it('persists the code-response preference across store instances', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'haired-settings-'))
    const settingsPath = path.join(directory, 'settings.json')
    try {
      const first = new SettingsStore(settingsPath)
      await first.update({ codeResponseStyle: 'code-only' })

      const relaunched = new SettingsStore(settingsPath)
      expect((await relaunched.load()).codeResponseStyle).toBe('code-only')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('persists the selected color theme across store instances', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'haired-theme-'))
    const settingsPath = path.join(directory, 'settings.json')
    try {
      const first = new SettingsStore(settingsPath)
      await first.update({ themeColor: 'green' })

      const relaunched = new SettingsStore(settingsPath)
      expect((await relaunched.load()).themeColor).toBe('green')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('persists the magnifying-glass cursor preference across store instances', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'haired-cursor-'))
    const settingsPath = path.join(directory, 'settings.json')
    try {
      const first = new SettingsStore(settingsPath)
      await first.update({ magnifyingGlassCursor: true })

      const relaunched = new SettingsStore(settingsPath)
      expect((await relaunched.load()).magnifyingGlassCursor).toBe(true)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
