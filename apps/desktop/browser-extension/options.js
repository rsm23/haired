const tokenInput = document.getElementById('token')
const status = document.getElementById('status')
document.getElementById('connect').onclick = async () => {
  try {
    const token = tokenInput.value.trim()
    if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Paste the pairing code from Haired.')
    // Chrome requires permission because selection can change to any web tab.
    const granted = await chrome.permissions.request({ origins: ['<all_urls>'] })
    if (!granted) throw new Error('Tab capture permission was not granted.')
    const response = await fetch('http://127.0.0.1:43187/status', {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000)
    })
    if (!response.ok) throw new Error('Pairing code was rejected. Copy it again from the running Haired app.')
    await chrome.storage.local.set({ token })
    tokenInput.value = ''
    status.textContent = 'Connected. Haired must be running. The desktop shortcut becomes available when the extension connects.'
  } catch (error) { status.textContent = error.message }
}
document.getElementById('disconnect').onclick = async () => {
  await chrome.storage.local.remove('token')
  await chrome.permissions.remove({ origins: ['<all_urls>'] })
  status.textContent = 'Disconnected. Tab capture permission removed.'
}
