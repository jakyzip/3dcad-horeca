import { appendFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { app, type BrowserWindow, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'

/**
 * Looks for a newer version among the project's GitHub releases (`publish` in
 * electron-builder.yml) and downloads it in the background. When it is ready the user picks:
 * restart now, or later, in which case it installs when the app is closed. On the Mac this
 * works only for a signed app; failures (offline, unsigned, no release yet) just go to the log.
 */
export function checkForUpdates(product: string, window: () => BrowserWindow | null): void {
  if (!app.isPackaged) return
  const logDirectory = path.join(app.getPath('userData'), 'logs')
  mkdirSync(logDirectory, { recursive: true })
  const file = path.join(logDirectory, 'aggiornamenti.log')
  const write = (level: string) => (message: unknown) =>
    appendFileSync(file, `${new Date().toISOString()} ${level} ${String(message)}\n`)
  autoUpdater.logger = {
    info: write('info'),
    warn: write('warn'),
    error: write('error'),
    debug: () => {},
  }
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-downloaded', async (info) => {
    const owner = window()
    const options = {
      type: 'info' as const,
      buttons: ['Riavvia e aggiorna', 'Più tardi'],
      defaultId: 0,
      cancelId: 1,
      title: product,
      message: `È pronta la versione ${info.version} di ${product}.`,
      detail:
        'Si installa al riavvio, i progetti restano dove sono. Se scegli "Più tardi", si installa quando chiudi l’app.',
    }
    const { response } = owner
      ? await dialog.showMessageBox(owner, options)
      : await dialog.showMessageBox(options)
    if (response === 0) autoUpdater.quitAndInstall()
  })

  autoUpdater.checkForUpdates().catch((error: unknown) => write('error')(error))
}
