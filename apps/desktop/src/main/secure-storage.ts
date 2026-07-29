import { readFile, unlink, writeFile } from 'node:fs/promises'
import { safeStorage } from 'electron'

interface AsyncSafeStorage {
  isAsyncEncryptionAvailable?: () => Promise<boolean>
  encryptStringAsync?: (value: string) => Promise<Buffer>
  decryptStringAsync?: (
    value: Buffer
  ) => Promise<{ result: string; shouldReEncrypt: boolean }>
}

export async function protectString(value: string): Promise<Buffer> {
  const asyncStorage = safeStorage as typeof safeStorage & AsyncSafeStorage
  if (asyncStorage.encryptStringAsync && (await asyncStorage.isAsyncEncryptionAvailable?.())) {
    return asyncStorage.encryptStringAsync(value)
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Operating-system secure storage is unavailable')
  }
  return safeStorage.encryptString(value)
}

export async function unprotectString(value: Buffer): Promise<string> {
  const asyncStorage = safeStorage as typeof safeStorage & AsyncSafeStorage
  if (asyncStorage.decryptStringAsync && (await asyncStorage.isAsyncEncryptionAvailable?.())) {
    return (await asyncStorage.decryptStringAsync(value)).result
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Operating-system secure storage is unavailable')
  }
  return safeStorage.decryptString(value)
}

export class ProtectedFile<T> {
  constructor(private readonly path: string) {}

  async read(): Promise<T | null> {
    try {
      const encrypted = await readFile(this.path)
      return JSON.parse(await unprotectString(encrypted)) as T
    } catch {
      return null
    }
  }

  async write(value: T): Promise<void> {
    const encrypted = await protectString(JSON.stringify(value))
    await writeFile(this.path, encrypted, { mode: 0o600 })
  }

  async clear(): Promise<void> {
    await unlink(this.path).catch(() => undefined)
  }
}

