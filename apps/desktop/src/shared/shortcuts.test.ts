import { describe, expect, it } from 'vitest'
import {
  acceleratorIdentity,
  keyboardModifierToken,
  normalizeMoveShortcut,
  overlayMovementAccelerators
} from './shortcuts'

describe('answer-window movement shortcuts', () => {
  it('normalizes modifier-only shortcuts into a stable accelerator order', () => {
    expect(normalizeMoveShortcut('Shift+CommandOrControl')).toBe(
      'CommandOrControl+Shift'
    )
    expect(normalizeMoveShortcut('Alt+Control')).toBe('Control+Alt')
    expect(normalizeMoveShortcut('Control+Command')).toBe('Command+Control')
    expect(normalizeMoveShortcut('Alt')).toBe('Alt')
  })

  it.each([
    '',
    'CommandOrControl+M',
    'CommandOrControl+CommandOrControl',
    'Space'
  ])('rejects invalid movement shortcut %j', (shortcut) => {
    expect(normalizeMoveShortcut(shortcut)).toBeNull()
  })

  it('builds one global accelerator for each arrow key', () => {
    expect(overlayMovementAccelerators('CommandOrControl+Alt')).toEqual([
      ['up', 'CommandOrControl+Alt+Up'],
      ['down', 'CommandOrControl+Alt+Down'],
      ['left', 'CommandOrControl+Alt+Left'],
      ['right', 'CommandOrControl+Alt+Right']
    ])
  })

  it('keeps Command and Control distinct on macOS', () => {
    expect(keyboardModifierToken('Meta', true)).toBe('Command')
    expect(keyboardModifierToken('Control', true)).toBe('Control')
    expect(keyboardModifierToken('Meta', false)).toBe('Super')
    expect(keyboardModifierToken('Control', false)).toBe('CommandOrControl')
    expect(keyboardModifierToken('Alt', true)).toBe('Alt')
    expect(keyboardModifierToken('Shift', true)).toBe('Shift')
    expect(keyboardModifierToken('ArrowLeft', true)).toBeNull()
  })

  it('detects portable and platform-specific accelerator conflicts', () => {
    expect(
      acceleratorIdentity('CommandOrControl+Shift+Space', true)
    ).toBe(acceleratorIdentity('Command+Shift+Space', true))
    expect(
      acceleratorIdentity('CommandOrControl+Shift+Space', true)
    ).not.toBe(acceleratorIdentity('Control+Shift+Space', true))
  })
})
