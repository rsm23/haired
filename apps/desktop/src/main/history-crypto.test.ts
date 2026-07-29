import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { decryptRecord, encryptRecord } from './history-crypto'

describe('encrypted history records', () => {
  it('round-trips content without plaintext in the stored blob', () => {
    const key = randomBytes(32)
    const source = Buffer.from('private screenshot answer')
    const encrypted = encryptRecord(source, key)
    expect(encrypted.includes(source)).toBe(false)
    expect(decryptRecord(encrypted, key)).toEqual(source)
  })

  it('detects tampering', () => {
    const key = randomBytes(32)
    const encrypted = encryptRecord(Buffer.from('answer'), key)
    encrypted[encrypted.length - 1] = (encrypted[encrypted.length - 1] ?? 0) ^ 0xff
    expect(() => decryptRecord(encrypted, key)).toThrow()
  })
})
