import { randomUUID, timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'

export const BROWSER_TAB_PORT = 43187
const MAX_BODY = 15 * 1024 * 1024
export interface TabCapture { image: Buffer; title: string }
type Pending = { id: string; expiresAt: number }

// Loopback only; pairing is required even for polling. Screenshots are accepted
// only for a live, user-armed request and never retained by the bridge.
export class BrowserTabBridge {
  private server: Server | null = null
  private pending: Pending | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private polls = new Set<ServerResponse>()
  private lastSeen = 0

  constructor(
    private readonly token: string,
    private readonly onCapture: (capture: TabCapture) => Promise<void>,
    private readonly onEnd: (error?: string) => void
  ) {}

  get connected(): boolean { return Date.now() - this.lastSeen < 35_000 }

  async start(port = BROWSER_TAB_PORT): Promise<number> {
    const server = createServer((req, res) => { void this.handle(req, res) })
    server.requestTimeout = 15_000
    server.headersTimeout = 10_000
    this.server = server
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(port, '127.0.0.1', resolve)
    })
    const address = server.address()
    return typeof address === 'object' && address ? address.port : port
  }

  arm(): void {
    if (!this.connected) throw new Error('Connect the Haired browser extension first in Settings → Shortcuts.')
    this.cancel()
    this.pending = { id: randomUUID(), expiresAt: Date.now() + 30_000 }
    this.timer = setTimeout(() => {
      this.cancel()
      this.onEnd('Tab selection expired. Press the shortcut to try again.')
    }, 30_000)
    this.flush()
  }

  cancel(): void {
    this.pending = null
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.flush()
  }

  async stop(): Promise<void> {
    this.cancel()
    for (const res of this.polls) this.reply(res, 200, { request: null })
    this.polls.clear()
    this.server?.closeAllConnections()
    await new Promise<void>((resolve) => this.server ? this.server.close(() => resolve()) : resolve())
    this.server = null
  }

  private reply(res: ServerResponse, status: number, value: unknown): void {
    if (res.destroyed || res.writableEnded) return
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify(value))
  }

  private flush(): void {
    for (const res of this.polls) this.reply(res, 200, { request: this.pending })
    this.polls.clear()
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const origin = req.headers.origin
      const credential = Buffer.from(req.headers.authorization?.replace(/^Bearer /, '') ?? '')
      const expected = Buffer.from(this.token)
      if ((origin && !/^chrome-extension:\/\/[a-p]{32}$/.test(origin)) ||
        credential.length !== expected.length || !timingSafeEqual(credential, expected)) {
        this.reply(res, 403, { error: 'Pairing required' }); return
      }
      if (req.headers.host !== `127.0.0.1:${(this.server?.address() as { port: number }).port}`) {
        this.reply(res, 403, { error: 'Invalid host' }); return
      }
      this.lastSeen = Date.now()
      if (req.method === 'GET' && req.url === '/status') {
        this.reply(res, 200, { ok: true }); return
      }
      if (req.method === 'GET' && req.url === '/poll') {
        if (this.pending) { this.reply(res, 200, { request: this.pending }); return }
        if (this.polls.size >= 4) { this.reply(res, 429, { error: 'Too many connections' }); return }
        this.polls.add(res)
        const timeout = setTimeout(() => {
          this.polls.delete(res); this.reply(res, 200, { request: null })
        }, 20_000)
        res.on('close', () => { clearTimeout(timeout); this.polls.delete(res) })
        return
      }
      if (req.method !== 'POST' || !['/capture', '/failure', '/cancel'].includes(req.url ?? '')) {
        this.reply(res, 404, { error: 'Not found' }); return
      }
      if (!req.headers['content-type']?.startsWith('application/json')) {
        this.reply(res, 415, { error: 'JSON required' }); return
      }
      let size = 0
      const chunks: Buffer[] = []
      for await (const chunk of req) {
        size += chunk.length
        if (size > MAX_BODY) { this.reply(res, 413, { error: 'Capture too large' }); req.destroy(); return }
        chunks.push(Buffer.from(chunk))
      }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>
      if (!this.pending || body.id !== this.pending.id || Date.now() > this.pending.expiresAt) {
        this.reply(res, 409, { error: 'No matching tab selection' }); return
      }
      if (req.url === '/failure' || req.url === '/cancel') {
        this.cancel()
        this.onEnd(req.url === '/failure' ? 'The browser could not capture this tab. Check the extension permissions and try again.' : undefined)
        this.reply(res, 200, { ok: true }); return
      }
      if (typeof body.image !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(body.image)) {
        this.reply(res, 400, { error: 'PNG required' }); return
      }
      const image = Buffer.from(body.image.slice('data:image/png;base64,'.length), 'base64')
      if (image.length > 10 * 1024 * 1024 || !image.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
        this.reply(res, 400, { error: 'Invalid or oversized PNG' }); return
      }
      if (image.length < 24 || image.readUInt32BE(16) * image.readUInt32BE(20) > 50_000_000) {
        this.reply(res, 400, { error: 'Image dimensions are too large' }); return
      }
      this.cancel()
      this.onEnd()
      await this.onCapture({ image, title: typeof body.title === 'string' ? body.title.slice(0, 200) : 'Browser tab' })
      this.reply(res, 200, { ok: true })
    } catch {
      this.reply(res, 400, { error: 'Unable to process tab capture' })
    }
  }
}
