const endpoint = 'http://127.0.0.1:43187'
let polling = false
let pending = null
let capturing = false
let queuedTab = null

async function request(path, body) {
  const { token } = await chrome.storage.local.get('token')
  if (!token) throw new Error('Connect Haired in extension options first.')
  const response = await fetch(endpoint + path, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(25000)
  })
  if (!response.ok) throw new Error(`Haired connection: ${response.status}`)
  return response.json()
}

async function poll() {
  if (polling) return
  polling = true
  try {
    while ((await chrome.storage.local.get('token')).token) {
      const result = await request('/poll')
      pending = result.request
      await chrome.action.setBadgeText({ text: pending ? 'TAB' : '' })
      // A pending response returns immediately: avoid spinning until selection.
      if (pending) await new Promise(resolve => setTimeout(resolve, 500))
    }
  } catch {
    pending = null
    await chrome.action.setBadgeText({ text: '' })
  } finally { polling = false }
}

async function capture(tabId, windowId) {
  const selection = pending
  if (!selection || selection.expiresAt <= Date.now()) return
  if (capturing) { queuedTab = { tabId, windowId }; return }
  capturing = true
  try {
    const tab = await chrome.tabs.get(tabId)
    if (!tab.url || !/^https?:\/\//.test(tab.url) || tab.url.startsWith(endpoint)) {
      throw new Error('Choose a regular web page.')
    }
    // onActivated can precede rendering of the newly selected tab.
    await new Promise(resolve => setTimeout(resolve, 350))
    const [active] = await chrome.tabs.query({ active: true, windowId })
    if (active?.id !== tabId) return
    const image = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' })
    // Never label an image as a tab that was switched away from mid-capture.
    const [after] = await chrome.tabs.query({ active: true, windowId })
    if (after?.id !== tabId) return
    await request('/capture', { id: selection.id, image, title: tab.title ?? 'Browser tab' })
    pending = null
    await chrome.action.setBadgeText({ text: '' })
  } catch {
    await request('/failure', { id: selection.id }).catch(() => {})
    pending = null
    await chrome.action.setBadgeText({ text: '!' })
  } finally {
    capturing = false
    const next = queuedTab
    queuedTab = null
    if (next && pending) void capture(next.tabId, next.windowId)
  }
}

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => { void capture(tabId, windowId) })
chrome.windows.onFocusChanged.addListener(async windowId => {
  if (windowId < 0 || !pending) return
  const [tab] = await chrome.tabs.query({ active: true, windowId })
  if (tab?.id !== undefined) await capture(tab.id, windowId)
})
chrome.action.onClicked.addListener(async tab => {
  if (!pending) { await chrome.runtime.openOptionsPage(); return }
  if (tab.id !== undefined) await capture(tab.id, tab.windowId)
})
chrome.runtime.onStartup.addListener(() => { void poll() })
chrome.runtime.onInstalled.addListener(() => {
  void chrome.alarms.create('connect', { periodInMinutes: 0.5 })
  void poll()
})
chrome.alarms.onAlarm.addListener(() => { void poll() })
chrome.storage.onChanged.addListener(() => { void poll() })
void poll()
