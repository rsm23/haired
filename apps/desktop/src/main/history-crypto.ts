import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

export function encryptRecord(value: Buffer, key: Buffer): Buffer {
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, nonce)
  const ciphertext = Buffer.concat([cipher.update(value), cipher.final()])
  return Buffer.concat([nonce, cipher.getAuthTag(), ciphertext])
}

export function decryptRecord(value: Buffer, key: Buffer): Buffer {
  if (value.length < 29) throw new Error('Encrypted record is malformed')
  const nonce = value.subarray(0, 12)
  const tag = value.subarray(12, 28)
  const ciphertext = value.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', key, nonce)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

