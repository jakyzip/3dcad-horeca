import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { CatalogArticle } from './catalog'
import { type CrmConfig, type CrmSession, crmLogin, fetchCrmCatalog, mergeCrmCatalog } from './crm'
import { PRODUCT_METADATA_KEY } from './product'
import {
  ABBATTITORE,
  BANCO_FRIGO,
  CELLA_FRIGO,
  FRIGORIFERO,
  GENERICO,
  LAVAMANI,
  LAVASTOVIGLIE,
  LAVELLO,
  MANTECATORE,
  PASTORIZZATORE,
  PENSILE,
  TAVOLO,
  TRAMOGGIA,
} from './schema'
import { daCodice } from './smontabili'

/** Category (normalised) → equipment kind. Categories without an entry use the generic block. */
export type ShapeMap = Record<string, string>

type CatalogState = {
  articles: CatalogArticle[]
  shapes: ShapeMap
  /** Replace the articles that came from a file; articles from the CRM stay. */
  importArticles: (articles: CatalogArticle[]) => void
  setShape: (category: string, kind: string | null) => void
  /** CRM sign-in; the password is not stored, the session token is. */
  crmSession: CrmSession | null
  /** Last CRM catalog change already read (`updated_at`), for incremental syncs. */
  crmSince: string | null
  crmSyncedAt: string | null
  crmSignIn: (config: CrmConfig, email: string, password: string) => Promise<void>
  crmSignOut: () => void
  /** Bring the CRM articles up to date; returns how many were added/updated and removed. */
  crmSync: (config: CrmConfig) => Promise<{ updated: number; removed: number }>
}

export const categoryKey = (category: string) => category.trim().toLowerCase()

/**
 * The local catalog and the category → shape choices. Kept in the browser (localStorage), not in
 * the scene: it belongs to the user's workstation, like a price list on the desk.
 */
export const useHorecaCatalog = create<CatalogState>()(
  persist(
    (set, get) => ({
      articles: [],
      shapes: {},
      crmSession: null,
      crmSince: null,
      crmSyncedAt: null,
      crmSignIn: async (config, email, password) => {
        const session = await crmLogin(config, email, password)
        // Another user may see another catalog: start the next sync from scratch.
        const sameUser = get().crmSession?.email === session.email
        set({ crmSession: session, ...(sameUser ? {} : { crmSince: null }) })
      },
      crmSignOut: () => set({ crmSession: null }),
      crmSync: async (config) => {
        const { crmSession, crmSince } = get()
        if (!crmSession) throw new Error('Accedi al CRM prima di aggiornare il catalogo.')
        const delta = await fetchCrmCatalog(config, crmSession, crmSince)
        set((state) => ({
          articles: mergeCrmCatalog(state.articles, delta),
          crmSession: delta.session,
          crmSince: delta.since,
          crmSyncedAt: new Date().toISOString(),
        }))
        return { updated: delta.upserts.length, removed: delta.removed.length }
      },
      importArticles: (articles) =>
        set((state) => ({
          articles: [...state.articles.filter((a) => a.source !== 'file'), ...articles],
        })),
      setShape: (category, kind) =>
        set((state) => {
          const shapes = { ...state.shapes }
          if (kind) shapes[categoryKey(category)] = kind
          else delete shapes[categoryKey(category)]
          return { shapes }
        }),
    }),
    {
      name: '3dcad-horeca:catalogo',
      version: 1,
      // Absent outside the browser (tests, server render): the store then lives in memory only.
      storage: createJSONStorage(() =>
        typeof localStorage === 'undefined'
          ? { getItem: () => null, setItem: () => {}, removeItem: () => {} }
          : localStorage,
      ),
      partialize: (state) => ({
        articles: state.articles,
        shapes: state.shapes,
        crmSession: state.crmSession,
        crmSince: state.crmSince,
        crmSyncedAt: state.crmSyncedAt,
      }),
    },
  ),
)

/**
 * Word stems that name a shape, checked in order (the more specific first: "lavastoviglie" and
 * "lava-mani" before "lavell", "cella" before "frigo"). Accents and hyphens are ignored.
 */
const GUESSES: ReadonlyArray<[RegExp, string]> = [
  [/lavastovigl/, LAVASTOVIGLIE],
  [/lava ?mani/, LAVAMANI],
  [/lavell/, LAVELLO],
  [/abbattitor/, ABBATTITORE],
  [/mantecator/, MANTECATORE],
  [/pastorizzator/, PASTORIZZATORE],
  [/\bcell[ae]\b/, CELLA_FRIGO],
  [/banc[oh]i? (frigo|refrigerat)/, BANCO_FRIGO],
  [/pensil/, PENSILE],
  [/tramogg/, TRAMOGGIA],
  [/frigorifer|\bfrigo\b/, FRIGORIFERO],
  [/tavol/, TAVOLO],
]

function guessShape(text: string): string | null {
  const plain = categoryKey(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_]/g, ' ')
  return GUESSES.find(([pattern]) => pattern.test(plain))?.[1] ?? null
}

/** The shape set for the category, else one guessed from its name, else the generic block. */
export function shapeForCategory(shapes: ShapeMap, category: string): string {
  return shapes[categoryKey(category)] ?? guessShape(category) ?? GENERICO
}

/**
 * The shape for one article: the category's (set or guessed), else one guessed from the article
 * name ("Abbattitore 5 teglie" filed under "Refrigerazione"), else the generic block.
 */
export function shapeForArticle(
  shapes: ShapeMap,
  article: Pick<CatalogArticle, 'category' | 'name'>,
): string {
  return (
    shapes[categoryKey(article.category)] ??
    guessShape(article.category) ??
    guessShape(article.name) ??
    GENERICO
  )
}

/** What the placement tool needs to place an article: its kind and the node defaults. */
export function placementFor(
  article: CatalogArticle,
  shapes: ShapeMap,
): { kind: string; defaults: Record<string, unknown> } {
  const metres = (mm: number | null) => (mm === null ? undefined : Math.round(mm) / 1000)
  const sizes = {
    width: metres(article.width_mm),
    depth: metres(article.depth_mm),
    height: metres(article.height_mm),
  }
  // A code of the open stainless line names its shape and options; the CRM's sizes still win.
  const line = daCodice(article.code)
  return {
    kind: line?.kind ?? shapeForArticle(shapes, article),
    defaults: {
      ...line?.defaults,
      ...Object.fromEntries(Object.entries(sizes).filter(([, v]) => v !== undefined)),
      name: article.name || article.code,
      metadata: {
        [PRODUCT_METADATA_KEY]: {
          item_id: article.item_id,
          code: article.code,
          name: article.name,
        },
      },
    },
  }
}
