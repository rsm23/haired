import { randomBytes, randomUUID } from 'node:crypto'
import { unlink, writeFile } from 'node:fs/promises'
import Database from 'better-sqlite3'
import { nativeImage } from 'electron'
import type {
  AnalysisMode,
  HistorySummary,
  LocalHistoryRecord
} from '@haired/contracts'
import { decryptRecord, encryptRecord } from './history-crypto'
import { ProtectedFile } from './secure-storage'

interface HistoryRow {
  id: string
  created_at: string
  mode: AnalysisMode
  byte_size: number
  title: Buffer
  question: Buffer
  answer: Buffer
  provider: Buffer | null
  model: Buffer | null
  screenshot: Buffer
}

export class HistoryVault {
  private readonly database: Database.Database
  private readonly keyFile: ProtectedFile<{ key: string }>
  private key: Buffer | null = null

  constructor(
    private readonly databasePath: string,
    keyPath: string
  ) {
    this.keyFile = new ProtectedFile(keyPath)
    this.database = new Database(databasePath)
    this.database.pragma('journal_mode = WAL')
    this.database.pragma('secure_delete = ON')
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS history (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        mode TEXT NOT NULL CHECK (mode IN ('fast', 'deep')),
        byte_size INTEGER NOT NULL,
        title BLOB NOT NULL,
        question BLOB NOT NULL,
        answer BLOB NOT NULL,
        provider BLOB,
        model BLOB,
        screenshot BLOB NOT NULL
      );
      CREATE INDEX IF NOT EXISTS history_created_at_idx
        ON history (created_at DESC);
    `)
  }

  async initialize(): Promise<void> {
    const stored = await this.keyFile.read()
    if (stored) {
      this.key = Buffer.from(stored.key, 'base64')
      return
    }
    this.key = randomBytes(32)
    await this.keyFile.write({ key: this.key.toString('base64') })
  }

  async add(input: {
    mode: AnalysisMode
    title: string
    question: string
    answer: string
    screenshot: Buffer
    provider?: string
    model?: string
  }): Promise<string> {
    const key = this.requireKey()
    const id = randomUUID()
    const encryptedTitle = encryptText(input.title, key)
    const encryptedQuestion = encryptText(input.question, key)
    const encryptedAnswer = encryptText(input.answer, key)
    const encryptedProvider = input.provider ? encryptText(input.provider, key) : null
    const encryptedModel = input.model ? encryptText(input.model, key) : null
    const encryptedScreenshot = encryptRecord(input.screenshot, key)
    const byteSize = [
      encryptedTitle,
      encryptedQuestion,
      encryptedAnswer,
      encryptedProvider,
      encryptedModel,
      encryptedScreenshot
    ].reduce((total, value) => total + (value?.length ?? 0), 0)
    this.database
      .prepare(
        `INSERT INTO history
          (id, created_at, mode, byte_size, title, question, answer, provider, model, screenshot)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        new Date().toISOString(),
        input.mode,
        byteSize,
        encryptedTitle,
        encryptedQuestion,
        encryptedAnswer,
        encryptedProvider,
        encryptedModel,
        encryptedScreenshot
      )
    return id
  }

  list(search = ''): HistorySummary[] {
    const rows = this.database
      .prepare('SELECT * FROM history ORDER BY created_at DESC LIMIT 500')
      .all() as HistoryRow[]
    const normalized = search.trim().toLocaleLowerCase()
    return rows.flatMap((row) => {
      try {
        const title = decryptText(row.title, this.requireKey())
        const question = decryptText(row.question, this.requireKey())
        const answer = decryptText(row.answer, this.requireKey())
        if (
          normalized &&
          !`${title} ${question} ${answer}`
            .toLocaleLowerCase()
            .includes(normalized)
        ) {
          return []
        }
        const screenshot = decryptRecord(row.screenshot, this.requireKey())
        const thumbnail = nativeImage
          .createFromBuffer(screenshot)
          .resize({ width: 112, quality: 'good' })
          .toPNG()
        return [
          {
            id: row.id,
            createdAt: row.created_at,
            mode: row.mode,
            title,
            byteSize: row.byte_size,
            ...(row.provider
              ? { provider: decryptText(row.provider, this.requireKey()) }
              : {}),
            ...(row.model ? { model: decryptText(row.model, this.requireKey()) } : {}),
            thumbnailDataUrl: `data:image/png;base64,${thumbnail.toString('base64')}`
          }
        ]
      } catch {
        return []
      }
    })
  }

  get(id: string): LocalHistoryRecord | null {
    const row = this.database.prepare('SELECT * FROM history WHERE id = ?').get(id) as
      | HistoryRow
      | undefined
    if (!row) return null
    const screenshot = decryptRecord(row.screenshot, this.requireKey())
    return {
      id: row.id,
      createdAt: row.created_at,
      mode: row.mode,
      title: decryptText(row.title, this.requireKey()),
      question: decryptText(row.question, this.requireKey()),
      answer: decryptText(row.answer, this.requireKey()),
      screenshotDataUrl: `data:image/png;base64,${screenshot.toString('base64')}`,
      byteSize: row.byte_size,
      ...(row.provider
        ? { provider: decryptText(row.provider, this.requireKey()) }
        : {}),
      ...(row.model ? { model: decryptText(row.model, this.requireKey()) } : {})
    }
  }

  delete(id: string): boolean {
    return this.database.prepare('DELETE FROM history WHERE id = ?').run(id).changes > 0
  }

  pruneOlderThan(days: number | null): number {
    if (!days) return 0
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1_000).toISOString()
    return this.database.prepare('DELETE FROM history WHERE created_at < ?').run(cutoff)
      .changes
  }

  storageBytes(): number {
    const row = this.database.prepare('SELECT COALESCE(sum(byte_size), 0) AS total FROM history').get() as {
      total: number
    }
    return row.total
  }

  async clear(): Promise<void> {
    this.database.exec('DELETE FROM history; VACUUM;')
    this.key = randomBytes(32)
    await this.keyFile.write({ key: this.key.toString('base64') })
  }

  async export(id: string, path: string): Promise<void> {
    const record = this.get(id)
    if (!record) throw new Error('History record not found')
    const markdown = [
      `# ${record.title}`,
      '',
      `- Date: ${record.createdAt}`,
      `- Mode: ${record.mode}`,
      '',
      '## Question',
      '',
      record.question,
      '',
      '## Answer',
      '',
      record.answer,
      ''
    ].join('\n')
    await writeFile(path, markdown, { mode: 0o600 })
  }

  close(): void {
    this.database.close()
  }

  async destroy(): Promise<void> {
    this.close()
    await Promise.allSettled([
      unlink(this.databasePath),
      unlink(`${this.databasePath}-wal`),
      unlink(`${this.databasePath}-shm`)
    ])
  }

  private requireKey(): Buffer {
    if (!this.key || this.key.length !== 32) throw new Error('History vault is not initialized')
    return this.key
  }
}

function encryptText(value: string, key: Buffer): Buffer {
  return encryptRecord(Buffer.from(value, 'utf8'), key)
}

function decryptText(value: Buffer, key: Buffer): string {
  return decryptRecord(value, key).toString('utf8')
}
