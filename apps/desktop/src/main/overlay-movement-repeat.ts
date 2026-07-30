import { spawn } from 'node:child_process'
import {
  normalizeMoveShortcut,
  type OverlayMoveDirection
} from '../shared/shortcuts'

export const OVERLAY_REPEAT_DELAY_MS = 260
export const OVERLAY_REPEAT_INTERVAL_MS = 40
export const OVERLAY_REPEAT_SAFETY_TIMEOUT_MS = 30_000

export interface MovementKeyMonitorSpec {
  command: string
  args: string[]
}

interface MovementKeyMonitorProcess {
  exitCode: number | null
  killed: boolean
  kill(): boolean
  once(event: 'error' | 'exit', listener: () => void): this
}

type SpawnMovementKeyMonitor = (
  spec: MovementKeyMonitorSpec
) => MovementKeyMonitorProcess

interface MovementRepeatSession {
  monitor: MovementKeyMonitorProcess
  delayTimer: NodeJS.Timeout | null
  repeatTimer: NodeJS.Timeout | null
  safetyTimer: NodeJS.Timeout | null
}

const MAC_ARROW_KEYS: Record<OverlayMoveDirection, number> = {
  left: 123,
  right: 124,
  down: 125,
  up: 126
}

const WINDOWS_ARROW_KEYS: Record<OverlayMoveDirection, number> = {
  left: 0x25,
  up: 0x26,
  right: 0x27,
  down: 0x28
}

function uniqueKeyGroups(groups: number[][]): number[][] {
  const seen = new Set<string>()
  return groups.filter((group) => {
    const identity = group.join(',')
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  })
}

function macModifierFlag(token: string): number {
  if (token === 'CommandOrControl' || token === 'Command' || token === 'Super') {
    return 1 << 20
  }
  if (token === 'Control') return 1 << 18
  if (token === 'Alt') return 1 << 19
  if (token === 'Shift') return 1 << 17
  return 0
}

function windowsModifierKeyGroup(token: string): number[] {
  if (token === 'CommandOrControl' || token === 'Control') return [0x11]
  if (token === 'Command' || token === 'Super') return [0x5b, 0x5c]
  if (token === 'Alt') return [0x12]
  if (token === 'Shift') return [0x10]
  return []
}

function macMonitorSpec(
  tokens: string[],
  direction: OverlayMoveDirection
): MovementKeyMonitorSpec {
  const requiredFlags = tokens.reduce(
    (flags, token) => flags | macModifierFlag(token),
    0
  )
  const arrowKey = MAC_ARROW_KEYS[direction]
  const script = [
    'ObjC.import("CoreGraphics")',
    'ObjC.import("unistd")',
    `const arrowKey = ${arrowKey}`,
    `const requiredFlags = ${requiredFlags}`,
    'const held = () => {',
    'const flags = Number($.CGEventSourceFlagsState(1))',
    'return Boolean($.CGEventSourceKeyState(1, arrowKey)) && (flags & requiredFlags) === requiredFlags',
    '}',
    'for (let attempt = 0; attempt < 10 && !held(); attempt++) $.usleep(10000)',
    'while (held()) $.usleep(20000)'
  ].join(';')
  return {
    command: '/usr/bin/osascript',
    args: ['-l', 'JavaScript', '-e', script]
  }
}

function windowsMonitorSpec(
  tokens: string[],
  direction: OverlayMoveDirection
): MovementKeyMonitorSpec {
  const groups = uniqueKeyGroups([
    ...tokens.map(windowsModifierKeyGroup),
    [WINDOWS_ARROW_KEYS[direction]]
  ])
  const isDown = (key: number) =>
    `(([Haired.NativeKeyState]::GetAsyncKeyState(${key}) -band 0x8000) -ne 0)`
  const condition = groups
    .map((group) => `(${group.map(isDown).join(' -or ')})`)
    .join(' -and ')
  const script = [
    '$signature = \'[DllImport("user32.dll")] public static extern short GetAsyncKeyState(int key);\'',
    'Add-Type -MemberDefinition $signature -Name NativeKeyState -Namespace Haired',
    `while (${condition}) { Start-Sleep -Milliseconds 20 }`
  ].join('; ')
  return {
    command: 'powershell.exe',
    args: [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-WindowStyle',
      'Hidden',
      '-Command',
      script
    ]
  }
}

export function movementKeyMonitorSpec(
  platform: NodeJS.Platform,
  shortcut: string,
  direction: OverlayMoveDirection
): MovementKeyMonitorSpec | null {
  const normalized = normalizeMoveShortcut(shortcut)
  if (!normalized) return null
  const tokens = normalized.split('+')
  if (platform === 'darwin') return macMonitorSpec(tokens, direction)
  if (platform === 'win32') return windowsMonitorSpec(tokens, direction)
  return null
}

function spawnMovementKeyMonitor(
  spec: MovementKeyMonitorSpec
): MovementKeyMonitorProcess {
  return spawn(spec.command, spec.args, {
    stdio: 'ignore',
    windowsHide: true
  })
}

export class HeldOverlayMovementRepeater {
  private session: MovementRepeatSession | null = null

  constructor(
    private readonly platform: NodeJS.Platform = process.platform,
    private readonly spawnMonitor: SpawnMovementKeyMonitor =
      spawnMovementKeyMonitor
  ) {}

  start(
    shortcut: string,
    direction: OverlayMoveDirection,
    repeat: () => void
  ): boolean {
    this.stop()
    const spec = movementKeyMonitorSpec(this.platform, shortcut, direction)
    if (!spec) return false

    const monitor = this.spawnMonitor(spec)
    const session: MovementRepeatSession = {
      monitor,
      delayTimer: null,
      repeatTimer: null,
      safetyTimer: null
    }
    const finish = () => {
      if (this.session === session) this.stop()
    }
    this.session = session
    monitor.once('error', finish)
    monitor.once('exit', finish)
    session.delayTimer = setTimeout(() => {
      if (this.session !== session) return
      session.repeatTimer = setInterval(repeat, OVERLAY_REPEAT_INTERVAL_MS)
    }, OVERLAY_REPEAT_DELAY_MS)
    session.safetyTimer = setTimeout(
      finish,
      OVERLAY_REPEAT_SAFETY_TIMEOUT_MS
    )
    return true
  }

  stop(): void {
    const session = this.session
    if (!session) return
    this.session = null
    if (session.delayTimer) clearTimeout(session.delayTimer)
    if (session.repeatTimer) clearInterval(session.repeatTimer)
    if (session.safetyTimer) clearTimeout(session.safetyTimer)
    if (session.monitor.exitCode === null && !session.monitor.killed) {
      session.monitor.kill()
    }
  }
}
