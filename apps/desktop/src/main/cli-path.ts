import { accessSync, constants } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export function cliEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
  platform = process.platform,
  home = os.homedir()
): NodeJS.ProcessEnv {
  if (platform !== 'darwin') return environment
  const directories = [
    ...(environment.PATH ?? '/usr/bin:/bin:/usr/sbin:/sbin').split(path.delimiter),
    path.join(home, '.vite-plus', 'bin'),
    path.join(home, '.local', 'bin'),
    path.join(home, '.npm-global', 'bin'),
    '/opt/homebrew/bin', '/usr/local/bin'
  ].filter(Boolean)
  return { ...environment, PATH: [...new Set(directories)].join(path.delimiter) }
}

export function resolveCliExecutable(binary: string, environment = cliEnvironment()): string {
  // An explicit user path takes precedence over auto-detection.
  if (binary.includes('/') || binary.includes('\\')) return binary
  for (const directory of (environment.PATH ?? '').split(path.delimiter).filter(Boolean)) {
    const candidate = path.join(directory, binary)
    try { accessSync(candidate, constants.X_OK); return candidate } catch { /* Try the next directory. */ }
  }
  return binary
}
