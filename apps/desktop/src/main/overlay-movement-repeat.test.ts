import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  HeldOverlayMovementRepeater,
  movementKeyMonitorSpec,
  OVERLAY_REPEAT_DELAY_MS,
  OVERLAY_REPEAT_INTERVAL_MS
} from './overlay-movement-repeat'

describe('held answer-window movement', () => {
  afterEach(() => vi.useRealTimers())

  it('polls only the configured macOS modifiers and arrow key', () => {
    const spec = movementKeyMonitorSpec(
      'darwin',
      'Command+Control+Alt',
      'right'
    )

    expect(spec?.command).toBe('/usr/bin/osascript')
    expect(spec?.args.join(' ')).toContain('const arrowKey = 124')
    expect(spec?.args.join(' ')).toContain('const requiredFlags = 1835008')
    expect(spec?.args.join(' ')).toContain('CGEventSourceKeyState')
    expect(spec?.args.join(' ')).toContain('CGEventSourceFlagsState')
  })

  it('builds a hidden Windows key-state monitor', () => {
    const spec = movementKeyMonitorSpec(
      'win32',
      'CommandOrControl+Alt',
      'left'
    )

    expect(spec?.command).toBe('powershell.exe')
    expect(spec?.args).toContain('Hidden')
    expect(spec?.args.at(-1)).toContain('GetAsyncKeyState(17)')
    expect(spec?.args.at(-1)).toContain('GetAsyncKeyState(18)')
    expect(spec?.args.at(-1)).toContain('GetAsyncKeyState(37)')
  })

  it('does not start a monitor for invalid shortcuts or unsupported platforms', () => {
    expect(movementKeyMonitorSpec('darwin', 'Command+M', 'left')).toBeNull()
    expect(
      movementKeyMonitorSpec('linux', 'CommandOrControl+Alt', 'left')
    ).toBeNull()
  })

  it('uses a deliberate initial delay followed by smooth repeat steps', () => {
    expect(OVERLAY_REPEAT_DELAY_MS).toBeGreaterThanOrEqual(200)
    expect(OVERLAY_REPEAT_INTERVAL_MS).toBeLessThanOrEqual(50)
  })

  it('repeats after the hold delay and stops as soon as the monitor exits', () => {
    vi.useFakeTimers()
    const monitor = Object.assign(new EventEmitter(), {
      exitCode: null as number | null,
      killed: false,
      kill() {
        this.killed = true
        return true
      }
    })
    const repeat = vi.fn()
    const repeater = new HeldOverlayMovementRepeater('darwin', () => monitor)

    expect(repeater.start('Command+Alt', 'left', repeat)).toBe(true)
    vi.advanceTimersByTime(OVERLAY_REPEAT_DELAY_MS - 1)
    expect(repeat).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1 + OVERLAY_REPEAT_INTERVAL_MS * 3)
    expect(repeat).toHaveBeenCalledTimes(3)

    monitor.exitCode = 0
    monitor.emit('exit')
    vi.advanceTimersByTime(OVERLAY_REPEAT_INTERVAL_MS * 3)
    expect(repeat).toHaveBeenCalledTimes(3)
  })
})
