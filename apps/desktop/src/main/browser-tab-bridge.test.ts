import { afterEach, describe, expect, it, vi } from 'vitest'
import { BrowserTabBridge } from './browser-tab-bridge'

const token = 'a'.repeat(64)
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII='
let bridge: BrowserTabBridge
let url: string
afterEach(async () => { await bridge?.stop() })
async function setup() {
  const capture = vi.fn().mockResolvedValue(undefined)
  const end = vi.fn()
  bridge = new BrowserTabBridge(token, capture, end)
  url = `http://127.0.0.1:${await bridge.start(0)}`
  return { capture, end }
}
function request(route: string, body?: unknown, headers: Record<string, string> = {}) {
  return fetch(url + route, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    ...(body ? { body: JSON.stringify(body) } : {})
  })
}
async function arm() {
  await request('/status')
  bridge.arm()
  return (await (await request('/poll')).json()).request.id as string
}

describe('paired browser tab captures', () => {
  it('rejects missing pairing and ordinary webpage origins', async () => {
    await setup()
    expect((await request('/status', undefined, { Authorization: '' })).status).toBe(403)
    expect((await request('/status', undefined, { Origin: 'https://example.com' })).status).toBe(403)
    expect(bridge.connected).toBe(false)
    expect(() => bridge.arm()).toThrow('Connect')
  })
  it('accepts a single capture only after an authenticated selection', async () => {
    const { capture, end } = await setup()
    const id = await arm()
    expect((await request('/capture', { id: 'wrong', image: png })).status).toBe(409)
    expect(capture).not.toHaveBeenCalled()
    expect((await request('/capture', { id, image: png, title: 'Synthetic test' })).status).toBe(200)
    expect(capture).toHaveBeenCalledWith({ image: Buffer.from(png.slice('data:image/png;base64,'.length), 'base64'), title: 'Synthetic test' })
    expect(end).toHaveBeenCalledWith()
    expect((await request('/capture', { id, image: png })).status).toBe(409)
    expect(capture).toHaveBeenCalledTimes(1)
  })
  it('invalidates the previous request on cancel or a newer shortcut', async () => {
    const { capture } = await setup()
    const id = await arm()
    bridge.cancel()
    expect((await request('/capture', { id, image: png })).status).toBe(409)
    const previous = await arm()
    bridge.arm()
    expect((await request('/capture', { id: previous, image: png })).status).toBe(409)
    expect(capture).not.toHaveBeenCalled()
  })
  it('rejects malformed images without consuming a valid selection', async () => {
    const { capture } = await setup()
    const id = await arm()
    expect((await request('/capture', { id, image: 'data:image/png;base64,aGVsbG8=' })).status).toBe(400)
    expect(capture).not.toHaveBeenCalled()
    expect((await request('/capture', { id, image: png })).status).toBe(200)
  })
  it('delivers an armed request to an already waiting extension', async () => {
    await setup()
    await request('/status')
    const waiting = request('/poll')
    bridge.arm()
    expect((await (await waiting).json()).request.id).toBeTruthy()
  })
  it('does not accept a screenshot after the selection deadline', async () => {
    const { capture } = await setup()
    const id = await arm()
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 31_000)
    try { expect((await request('/capture', { id, image: png })).status).toBe(409) }
    finally { clock.mockRestore() }
    expect(capture).not.toHaveBeenCalled()
  })
})
