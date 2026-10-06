import { mkdtempSync, chmodSync, writeFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { cliEnvironment, resolveCliExecutable } from './cli-path'

describe('Finder-launched CLI providers', () => {
  it('includes user CLI installations even when Finder supplies only system paths', () => {
    const environment = cliEnvironment({ PATH: '/usr/bin:/bin' }, 'darwin', '/Users/example')
    expect(environment.PATH).toContain('/Users/example/.vite-plus/bin')
    expect(environment.PATH).toContain('/Users/example/.local/bin')
    expect(environment.PATH).toContain('/opt/homebrew/bin')
  })
  it('resolves an executable while preserving explicit paths and missing commands', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'haired-cli-'))
    try {
      const executable = path.join(directory, 'codex')
      writeFileSync(executable, '#!/bin/sh\nexit 0\n'); chmodSync(executable, 0o700)
      expect(resolveCliExecutable('codex', { PATH: directory })).toBe(executable)
      expect(resolveCliExecutable('/custom/codex', { PATH: directory })).toBe('/custom/codex')
      expect(resolveCliExecutable('missing', { PATH: directory })).toBe('missing')
    } finally { rmSync(directory, { recursive: true }) }
  })
  it('leaves other platforms and the parent environment unchanged', () => {
    const original = { PATH: '/usr/bin' }
    expect(cliEnvironment(original, 'win32')).toBe(original)
    cliEnvironment(original, 'darwin', '/Users/example')
    expect(original.PATH).toBe('/usr/bin')
  })
})
