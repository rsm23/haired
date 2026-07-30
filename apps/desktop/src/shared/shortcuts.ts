export const OVERLAY_MOVE_DIRECTIONS = ['up', 'down', 'left', 'right'] as const

export type OverlayMoveDirection = (typeof OVERLAY_MOVE_DIRECTIONS)[number]

const MOVE_SHORTCUT_MODIFIERS = [
  'CommandOrControl',
  'Command',
  'Control',
  'Alt',
  'Shift',
  'Super'
] as const
const DIRECTION_KEYS: Record<OverlayMoveDirection, string> = {
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right'
}

export function normalizeMoveShortcut(value: string): string | null {
  const tokens = value
    .split('+')
    .map((token) => token.trim())
    .filter(Boolean)
  const uniqueTokens = new Set(tokens)
  if (
    tokens.length === 0 ||
    uniqueTokens.size !== tokens.length ||
    tokens.some(
      (token) =>
        !MOVE_SHORTCUT_MODIFIERS.includes(
          token as (typeof MOVE_SHORTCUT_MODIFIERS)[number]
        )
    )
  ) {
    return null
  }
  return MOVE_SHORTCUT_MODIFIERS.filter((modifier) =>
    uniqueTokens.has(modifier)
  ).join('+')
}

export function overlayMovementAccelerators(
  shortcut: string
): Array<[OverlayMoveDirection, string]> {
  const normalized = normalizeMoveShortcut(shortcut)
  if (!normalized) throw new Error('Answer-window movement requires modifier keys')
  return OVERLAY_MOVE_DIRECTIONS.map((direction) => [
    direction,
    `${normalized}+${DIRECTION_KEYS[direction]}`
  ])
}

export function keyboardModifierToken(key: string, isMac: boolean): string | null {
  if (key === 'Meta') return isMac ? 'Command' : 'Super'
  if (key === 'Control') return isMac ? 'Control' : 'CommandOrControl'
  if (key === 'Alt') return 'Alt'
  if (key === 'Shift') return 'Shift'
  return null
}

export function acceleratorIdentity(value: string, isMac: boolean): string {
  return value
    .split('+')
    .map((token) =>
      token === 'CommandOrControl' ? (isMac ? 'Command' : 'Control') : token
    )
    .map((token) => token.toLowerCase())
    .sort()
    .join('+')
}
