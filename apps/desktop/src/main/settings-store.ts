import { readFile, writeFile } from 'node:fs/promises'
import {
  appSettingsSchema,
  DEFAULT_INSTRUCTION,
  LEGACY_DEFAULT_INSTRUCTION,
  PREVIOUS_DEFAULT_INSTRUCTION,
  type AppSettings
} from '@haired/contracts'

export function migrateBuiltInInstruction(settings: AppSettings): AppSettings {
  if (
    settings.defaultInstruction !== LEGACY_DEFAULT_INSTRUCTION &&
    settings.defaultInstruction !== PREVIOUS_DEFAULT_INSTRUCTION
  ) {
    return settings
  }
  return { ...settings, defaultInstruction: DEFAULT_INSTRUCTION }
}

export class SettingsStore {
  private cached: AppSettings | null = null

  constructor(private readonly path: string) {}

  private async persist(settings: AppSettings): Promise<void> {
    await writeFile(this.path, `${JSON.stringify(settings, null, 2)}\n`, {
      mode: 0o600
    })
  }

  async load(): Promise<AppSettings> {
    if (this.cached) return this.cached
    let parsed: AppSettings
    try {
      parsed = appSettingsSchema.parse(JSON.parse(await readFile(this.path, 'utf8')))
    } catch {
      parsed = appSettingsSchema.parse({})
    }
    this.cached = migrateBuiltInInstruction(parsed)
    if (this.cached !== parsed) {
      try {
        await this.persist(this.cached)
      } catch {
        // Keep the safer built-in instruction active even if migration cannot be persisted yet.
      }
    }
    return this.cached
  }

  async update(patch: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.load()
    this.cached = appSettingsSchema.parse({
      ...current,
      ...patch,
      shortcuts: { ...current.shortcuts, ...patch.shortcuts }
    })
    await this.persist(this.cached)
    return this.cached
  }
}
