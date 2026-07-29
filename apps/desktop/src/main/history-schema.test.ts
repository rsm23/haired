import { describe, expect, it, vi } from 'vitest'
import { ensureHistorySchema } from './history'

describe('history response-style schema', () => {
  it('adds a backward-compatible full-reply column to old databases', () => {
    const database = {
      exec: vi.fn(),
      pragma: vi.fn(() => [{ name: 'id' }, { name: 'answer' }])
    }

    ensureHistorySchema(database)

    expect(database.exec).toHaveBeenCalledTimes(2)
    expect(database.exec.mock.calls[0]?.[0]).toContain(
      "response_style TEXT NOT NULL DEFAULT 'full-reply'"
    )
    expect(database.exec.mock.calls[1]?.[0]).toContain('ALTER TABLE history')
    expect(database.exec.mock.calls[1]?.[0]).toContain(
      "DEFAULT 'full-reply'"
    )
  })

  it('does not rerun the migration when the column already exists', () => {
    const database = {
      exec: vi.fn(),
      pragma: vi.fn(() => [{ name: 'id' }, { name: 'response_style' }])
    }

    ensureHistorySchema(database)

    expect(database.exec).toHaveBeenCalledOnce()
  })
})
