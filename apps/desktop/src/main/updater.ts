import { dialog } from 'electron'
import updater from 'electron-updater'

const { autoUpdater } = updater

let busy = false

export function setUpdateBusy(value: boolean): void {
  busy = value
}

export function configureUpdates(): void {
  if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'production') return
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('update-downloaded', async () => {
    if (busy) return
    const choice = await dialog.showMessageBox({
      type: 'info',
      title: 'Haired update ready',
      message: 'A signed Haired update has been downloaded.',
      detail: 'Restart now to install it, or keep working and install when you quit.',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1
    })
    if (choice.response === 0 && !busy) autoUpdater.quitAndInstall()
  })
  autoUpdater.on('error', () => {
    // Intentionally content-free; update failures are retried on the next schedule.
  })
  const check = () => void autoUpdater.checkForUpdates().catch(() => undefined)
  setTimeout(check, 15_000)
  setInterval(check, 6 * 60 * 60 * 1_000)
}
