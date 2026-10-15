import { create } from 'zustand'
import { zip } from './zip'

/**
 * The project's renders, kept on this computer (IndexedDB, one list per project) until deleted:
 * made one after the other, downloaded together as a .zip, and the chosen ones put in the
 * customer's sheet. Not in the drawing itself, so the saved project stays small.
 */

export type RenderSalvato = {
  id: string
  progetto: string
  /** ISO time it was made. */
  creato: string
  png: Blob
  width: number
  height: number
  /** Goes into the customer's sheet. */
  nellaTavola: boolean
}

/** The open project's id, from the editor's address (`/project/<id>`); null elsewhere. */
export function idProgettoDaUrl(pathname = globalThis.location?.pathname ?? ''): string | null {
  return /\/project\/([^/?#]+)/.exec(pathname)?.[1] ?? null
}

const DB = '3dcad-horeca'
const STORE = 'render'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1)
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: 'id' })
      store.createIndex('progetto', 'progetto')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(STORE, mode).objectStore(STORE))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

/** Oldest first. */
export const ordina = (list: RenderSalvato[]) =>
  [...list].sort((a, b) => a.creato.localeCompare(b.creato))

/** `render-01.png`, `render-02.png`… in the gallery's order. */
export const nomeFile = (index: number) => `render-${String(index + 1).padStart(2, '0')}.png`

export async function zipDeiRender(list: readonly RenderSalvato[]): Promise<Blob> {
  const files = await Promise.all(
    list.map(async (r, i) => ({
      name: nomeFile(i),
      data: new Uint8Array(await r.png.arrayBuffer()),
      date: new Date(r.creato),
    })),
  )
  return new Blob([zip(files) as BlobPart], { type: 'application/zip' })
}

type Stato = {
  progetto: string | null
  renders: RenderSalvato[]
  /** Object URLs for the thumbnails, by render id. */
  urls: Record<string, string>
  error: string | null
  carica: (progetto: string | null) => Promise<void>
  aggiungi: (png: Blob) => Promise<void>
  elimina: (id: string) => Promise<void>
  svuota: () => Promise<void>
  setNellaTavola: (id: string, value: boolean) => Promise<void>
}

const revoke = (urls: Record<string, string>) => {
  for (const url of Object.values(urls)) URL.revokeObjectURL(url)
}

const withUrls = (renders: RenderSalvato[]) =>
  Object.fromEntries(renders.map((r) => [r.id, URL.createObjectURL(r.png)]))

const failed = (e: unknown) =>
  `Archivio dei render non disponibile: ${e instanceof Error ? e.message : String(e)}`

export const useHorecaRenders = create<Stato>((set, get) => ({
  progetto: null,
  renders: [],
  urls: {},
  error: null,
  carica: async (progetto) => {
    if (progetto === get().progetto) return
    revoke(get().urls)
    set({ progetto, renders: [], urls: {}, error: null })
    if (!progetto) return
    try {
      const all = await tx<RenderSalvato[]>('readonly', (s) => s.index('progetto').getAll(progetto))
      if (get().progetto !== progetto) return
      const renders = ordina(all)
      set({ renders, urls: withUrls(renders) })
    } catch (e) {
      set({ error: failed(e) })
    }
  },
  aggiungi: async (png) => {
    const progetto = get().progetto ?? 'senza-progetto'
    const bitmap = await createImageBitmap(png)
    const render: RenderSalvato = {
      id: crypto.randomUUID(),
      progetto,
      creato: new Date().toISOString(),
      png,
      width: bitmap.width,
      height: bitmap.height,
      nellaTavola: true,
    }
    bitmap.close()
    // Shown even if it cannot be stored (private window): it lasts until the page closes.
    set((s) => ({
      renders: [...s.renders, render],
      urls: { ...s.urls, [render.id]: URL.createObjectURL(png) },
    }))
    try {
      await tx('readwrite', (s) => s.put(render))
    } catch (e) {
      set({ error: failed(e) })
    }
  },
  elimina: async (id) => {
    const url = get().urls[id]
    if (url) URL.revokeObjectURL(url)
    set((s) => {
      const { [id]: _, ...urls } = s.urls
      return { renders: s.renders.filter((r) => r.id !== id), urls }
    })
    await tx('readwrite', (s) => s.delete(id)).catch((e) => set({ error: failed(e) }))
  },
  svuota: async () => {
    const ids = get().renders.map((r) => r.id)
    revoke(get().urls)
    set({ renders: [], urls: {} })
    for (const id of ids)
      await tx('readwrite', (s) => s.delete(id)).catch((e) => set({ error: failed(e) }))
  },
  setNellaTavola: async (id, value) => {
    const render = get().renders.find((r) => r.id === id)
    if (!render) return
    const updated = { ...render, nellaTavola: value }
    set((s) => ({ renders: s.renders.map((r) => (r.id === id ? updated : r)) }))
    await tx('readwrite', (s) => s.put(updated)).catch((e) => set({ error: failed(e) }))
  },
}))
