import { type ChildProcess, spawn } from 'node:child_process'
import { createWriteStream, mkdirSync } from 'node:fs'
import { createServer } from 'node:net'
import path from 'node:path'
import { app, BrowserWindow, dialog, shell } from 'electron'

/**
 * 3DCadHo.Re.Ca as a desktop app: the editor's own web server (the standalone Next.js build
 * staged in `runtime/`) runs on this computer with Electron's bundled Node, and a window shows
 * it. Projects stay in the user's app-data folder; nothing needs a server elsewhere.
 */

const PRODUCT = '3DCadHo.Re.Ca'
const HOST = '127.0.0.1'
const HEALTH_TIMEOUT_MS = 60_000

// Names the app-data folder (projects, logs) in development too; installers set it themselves.
app.setName(PRODUCT)

// The editor draws with WebGPU. Chromium enables it on Mac and Windows; on Linux it still sits
// behind these switches (Vulkan drivers needed).
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-unsafe-webgpu')
  app.commandLine.appendSwitch('enable-features', 'Vulkan')
}

let server: ChildProcess | null = null
let window: BrowserWindow | null = null

const runtimeDirectory = () =>
  app.isPackaged
    ? path.join(process.resourcesPath, 'runtime')
    : path.join(__dirname, '../build/runtime')

/**
 * Always the same port when it's free: the page's saved settings (catalog, compositions, labels)
 * live in the browser storage of its address, port included, so a new port each launch would
 * lose them. Another free port only when something else holds it.
 */
const PREFERRED_PORT = 39203

function freePort(port = PREFERRED_PORT): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', (error: NodeJS.ErrnoException) =>
      port !== 0 && error.code === 'EADDRINUSE' ? resolve(freePort(0)) : reject(error),
    )
    probe.listen(port, HOST, () => {
      const address = probe.address()
      probe.close(() =>
        typeof address === 'object' && address ? resolve(address.port) : reject(new Error('port')),
      )
    })
  })
}

async function waitForHealth(origin: string): Promise<void> {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (server?.exitCode !== null) throw new Error('il server dell’editor si è fermato all’avvio')
    try {
      const response = await fetch(`${origin}/api/health`)
      if (response.ok) return
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('il server dell’editor non ha risposto in tempo')
}

async function startServer(): Promise<string> {
  const port = await freePort()
  const origin = `http://${HOST}:${port}`
  const userData = app.getPath('userData')
  const logDirectory = path.join(userData, 'logs')
  mkdirSync(logDirectory, { recursive: true })
  const log = createWriteStream(path.join(logDirectory, 'editor.log'), { flags: 'a' })
  const serverPath = path.join(runtimeDirectory(), 'apps/editor/server.js')

  server = spawn(process.execPath, [serverPath], {
    cwd: path.dirname(serverPath),
    env: {
      ...process.env,
      // Electron's executable behaves as plain Node for this child.
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      HOSTNAME: HOST,
      PORT: String(port),
      PASCAL_DATA_DIR: path.join(userData, 'data'),
      PASCAL_PUBLIC_URL: origin,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  server.stdout?.pipe(log)
  server.stderr?.pipe(log)
  await waitForHealth(origin)
  return origin
}

const LOADING = `data:text/html;charset=utf-8,${encodeURIComponent(
  `<!doctype html><meta charset="utf-8"><title>${PRODUCT}</title>
  <body style="margin:0;height:100vh;display:grid;place-items:center;background:#1f2433;color:#e5e7eb;font:15px system-ui">
  <div>Avvio di ${PRODUCT}…</div></body>`,
)}`

async function openWindow(): Promise<void> {
  window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    title: PRODUCT,
    backgroundColor: '#1f2433',
    show: true,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  })
  window.on('closed', () => {
    window = null
  })
  await window.loadURL(LOADING)

  const origin = await startServer()
  // Links that leave the editor (documentation, the CRM) open in the normal browser.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(origin)) void shell.openExternal(url)
    return { action: url.startsWith(origin) ? 'allow' : 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(origin)) return
    event.preventDefault()
    void shell.openExternal(url)
  })
  await window.loadURL(origin)
}

function stopServer(): void {
  if (server && server.exitCode === null) server.kill()
  server = null
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!window) return
    if (window.isMinimized()) window.restore()
    window.focus()
  })
  app.whenReady().then(async () => {
    try {
      await openWindow()
    } catch (error) {
      dialog.showErrorBox(
        PRODUCT,
        `Non riesco ad avviare l’editor: ${error instanceof Error ? error.message : String(error)}.\nDettagli nel file editor.log, cartella ${path.join(app.getPath('userData'), 'logs')}.`,
      )
      app.quit()
    }
  })
  app.on('window-all-closed', () => app.quit())
  app.on('before-quit', stopServer)
  // Also when the app is ended from outside (logout, Activity Monitor): no orphan server.
  process.on('exit', stopServer)
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => app.quit())
}
