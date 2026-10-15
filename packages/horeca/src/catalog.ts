/**
 * The local catalog of Ho.Re.Ca articles the CAD places. Filled from a file (CSV or JSON) today and
 * from the CRM's `catalog_items` later; both land in the same shape. Sizes are millimetres, as in the
 * CRM (`width_mm`, `depth_mm`, `height_mm`); `null` lets the shape use its own default.
 */

export type CatalogArticle = {
  /** CRM catalog uuid, or '' for an article not in the CRM. */
  item_id: string
  code: string
  name: string
  category: string
  width_mm: number | null
  depth_mm: number | null
  height_mm: number | null
  source: 'file' | 'crm'
}

export type CatalogParseResult = { articles: CatalogArticle[]; errors: string[] }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Field = 'item_id' | 'code' | 'name' | 'category' | 'width_mm' | 'depth_mm' | 'height_mm'

/** Accepted column names, compared without case, accents, spaces or punctuation. */
const ALIASES: Record<Field, readonly string[]> = {
  code: ['codice', 'code', 'cod', 'codicearticolo'],
  name: ['nome', 'name', 'articolo', 'descrizione', 'description'],
  category: ['categoria', 'category'],
  width_mm: ['larghezzamm', 'larghezza', 'widthmm', 'width'],
  depth_mm: ['profonditamm', 'profondita', 'depthmm', 'depth'],
  height_mm: ['altezzamm', 'altezza', 'heightmm', 'height'],
  item_id: ['idcrm', 'itemid', 'id', 'uuid', 'catalogitemid'],
}

const SIZE_LABEL: Record<'width_mm' | 'depth_mm' | 'height_mm', string> = {
  width_mm: 'larghezza',
  depth_mm: 'profondità',
  height_mm: 'altezza',
}

const normalize = (header: string) =>
  header
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

function fieldOf(header: string): Field | null {
  const key = normalize(header)
  for (const [field, aliases] of Object.entries(ALIASES) as [Field, readonly string[]][]) {
    if (aliases.includes(key)) return field
  }
  return null
}

/** RFC 4180-style records, with the line each one starts on (quoted fields may span lines). */
function parseCsv(text: string, separator: string): { line: number; cells: string[] }[] {
  const records: { line: number; cells: string[] }[] = []
  let cells: string[] = []
  let cell = ''
  let quoted = false
  let line = 1
  let start = 1
  const endRecord = () => {
    cells.push(cell)
    if (cells.some((c) => c.trim() !== '')) records.push({ line: start, cells })
    cells = []
    cell = ''
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else {
        if (ch === '\n') line++
        cell += ch
      }
    } else if (ch === '"') quoted = true
    else if (ch === separator) {
      cells.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      endRecord()
      line++
      start = line
    } else cell += ch
  }
  if (cell !== '' || cells.length > 0) endRecord()
  return records
}

function detectSeparator(text: string): string {
  const header = text.split(/\r?\n/, 1)[0] ?? ''
  const count = (sep: string) => header.split(sep).length
  return count(';') >= count(',') ? ';' : ','
}

/** One raw row (column → text) to an article, or the reason it is refused. */
function toArticle(raw: Partial<Record<Field, unknown>>): CatalogArticle | string {
  const text = (value: unknown) =>
    value === undefined || value === null ? '' : String(value).trim()
  const code = text(raw.code)
  if (!code) return 'manca il codice.'
  const item_id = text(raw.item_id).toLowerCase()
  if (item_id && !UUID.test(item_id)) return `ID CRM non valido ("${text(raw.item_id)}").`
  const sizes: Partial<Record<'width_mm' | 'depth_mm' | 'height_mm', number | null>> = {}
  for (const key of ['width_mm', 'depth_mm', 'height_mm'] as const) {
    const value = text(raw[key])
    if (!value) {
      sizes[key] = null
      continue
    }
    const number = Number(value.replace(/\s/g, '').replace(',', '.'))
    if (!Number.isFinite(number) || number <= 0)
      return `${SIZE_LABEL[key]} non valida ("${value}").`
    sizes[key] = number
  }
  return {
    item_id,
    code,
    name: text(raw.name),
    category: text(raw.category),
    width_mm: sizes.width_mm ?? null,
    depth_mm: sizes.depth_mm ?? null,
    height_mm: sizes.height_mm ?? null,
    source: 'file',
  }
}

function collect(
  rows: { line: string; raw: Partial<Record<Field, unknown>> }[],
): CatalogParseResult {
  const articles: CatalogArticle[] = []
  const errors: string[] = []
  const seen = new Set<string>()
  for (const { line, raw } of rows) {
    const article = toArticle(raw)
    if (typeof article === 'string') {
      errors.push(`${line}: ${article}`)
    } else if (seen.has(article.code)) {
      errors.push(`${line}: codice ${article.code} ripetuto, tengo la prima riga.`)
    } else {
      seen.add(article.code)
      articles.push(article)
    }
  }
  return { articles, errors }
}

function parseCsvCatalog(text: string): CatalogParseResult {
  const [header, ...records] = parseCsv(text, detectSeparator(text))
  if (!header) return { articles: [], errors: ['Il file è vuoto.'] }
  const fields = header.cells.map(fieldOf)
  if (!fields.includes('code')) {
    return { articles: [], errors: ['Il file non ha una colonna "codice" (o "code").'] }
  }
  return collect(
    records.map(({ line, cells }) => {
      const raw: Partial<Record<Field, unknown>> = {}
      fields.forEach((field, i) => {
        if (field && raw[field] === undefined) raw[field] = cells[i]
      })
      return { line: `Riga ${line}`, raw }
    }),
  )
}

function parseJsonCatalog(text: string): CatalogParseResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { articles: [], errors: ['Il file JSON non è leggibile.'] }
  }
  const list = Array.isArray(data) ? data : (data as { items?: unknown })?.items
  if (!Array.isArray(list)) {
    return {
      articles: [],
      errors: ['Il JSON deve essere un elenco di articoli (o { "items": [...] }).'],
    }
  }
  return collect(
    list.map((entry, i) => {
      const raw: Partial<Record<Field, unknown>> = {}
      if (entry && typeof entry === 'object') {
        for (const [key, value] of Object.entries(entry)) {
          const field = fieldOf(key)
          if (field && raw[field] === undefined) raw[field] = value
        }
      }
      return { line: `Articolo ${i + 1}`, raw }
    }),
  )
}

/** Read a catalog file chosen by the user: JSON by extension or content, CSV otherwise. */
export function parseCatalogFile(filename: string, text: string): CatalogParseResult {
  const body = text.replace(/^﻿/, '')
  const json = /\.json$/i.test(filename) || /^\s*[[{]/.test(body)
  return json ? parseJsonCatalog(body) : parseCsvCatalog(body)
}
