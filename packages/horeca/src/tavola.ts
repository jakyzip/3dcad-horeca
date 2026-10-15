import type { FloorplanGeometry, FloorplanPoint } from '@pascal-app/core'
import type { SheetPdfPage } from '@pascal-app/editor'
import type { RiepilogoImpianti } from './allacciamenti'
import { TIPI_ALLACCIAMENTO, TIPO } from './allacciamenti'
import type { DistintaRow } from './distinta'
import { pathToPolylines } from './svg-path'

/**
 * The sheet for the customer: plan with dimensions, the 3D render, the list of equipment and the
 * services summary, under a title block with the company's logo and data. Laid out as geometry
 * in sheet inches for the editor's sheet PDF export (`exportSheetsToPdf`), so the plan stays
 * vector and the text stays selectable.
 */

export type Intestazione = {
  nome: string
  indirizzo: string
  telefono: string
  email: string
  piva: string
  /** PNG or JPEG as a data URL, already shrunk. */
  logo: string | null
}

export const INTESTAZIONE_VUOTA: Intestazione = {
  nome: '',
  indirizzo: '',
  telefono: '',
  email: '',
  piva: '',
  logo: null,
}

export type InfoTavola = {
  progetto: string
  cliente: string
  /** Already formatted, e.g. "15/10/2026". */
  data: string
  revisione: number
  piano: string
}

export type ContenutoTavola = {
  /** The level's plan in unrotated level metres, as `collectSheetGeometry` returns it. */
  pianta: { model: FloorplanGeometry[]; annotations: FloorplanGeometry[]; rotationDeg: number }
  /** 3D views, in order: the first beside the plan on the A3 sheet, the others on pages of their own. */
  renders: ReadonlyArray<{ dataUrl: string; aspect: number }>
  elenco: DistintaRow[]
  impianti: RiepilogoImpianti | null
}

export type FormatoTavola = 'A3' | 'A4'

const A3 = { w: 16.535, h: 11.693 }
const A4 = { w: 11.693, h: 8.268 }
const MARGIN = 0.4
const INK = '#1f2937'
const MUTED = '#6b7280'
const RULE = '#cbd5e1'
const HEAD = '#334155'
const ZEBRA = '#f1f5f9'

type Rect = { x: number; y: number; w: number; h: number }

/** Room for a dimension's text beyond its line, in plan metres. */
const DIMENSION_TEXT_ROOM = 0.35

const SCALES = [20, 25, 50, 75, 100, 150, 200, 250, 500, 1000]
const IN_PER_M = 1 / 0.0254

/* ---------------------------------------------------------------- bounds */

/** Every point a geometry draws through, after its groups' transforms. */
export function geometryPoints(g: FloorplanGeometry, out: FloorplanPoint[] = []): FloorplanPoint[] {
  switch (g.kind) {
    case 'group': {
      const inner = g.children.flatMap((c) => geometryPoints(c))
      const t = g.transform
      const cos = Math.cos(t?.rotate ?? 0)
      const sin = Math.sin(t?.rotate ?? 0)
      const [tx, ty] = t?.translate ?? [0, 0]
      for (const [x, y] of inner) out.push([x * cos - y * sin + tx, x * sin + y * cos + ty])
      return out
    }
    case 'polygon':
    case 'polyline':
      out.push(...g.points)
      return out
    case 'line':
      out.push([g.x1, g.y1], [g.x2, g.y2])
      return out
    case 'rect':
      out.push([g.x, g.y], [g.x + g.width, g.y + g.height])
      return out
    case 'circle':
      out.push([g.cx - g.r, g.cy - g.r], [g.cx + g.r, g.cy + g.r])
      return out
    case 'path':
      for (const line of pathToPolylines(g.d)) out.push(...line.points)
      return out
    case 'text':
      out.push([g.x, g.y])
      return out
    case 'dimension': {
      // The dimension line sits off the measured points, and its text a little further out.
      const reach = g.offsetDistance + DIMENSION_TEXT_ROOM
      const off = (p: FloorplanPoint): FloorplanPoint => [
        p[0] + g.offsetNormal[0] * reach,
        p[1] + g.offsetNormal[1] * reach,
      ]
      out.push(g.start, g.end, g.dimensionStart ?? off(g.start), g.dimensionEnd ?? off(g.end))
      return out
    }
    case 'dimension-string': {
      const reach = g.offsetDistance + DIMENSION_TEXT_ROOM
      for (const seg of g.segments)
        out.push(
          seg.start,
          seg.end,
          [seg.start[0] + g.offsetNormal[0] * reach, seg.start[1] + g.offsetNormal[1] * reach],
          [seg.end[0] + g.offsetNormal[0] * reach, seg.end[1] + g.offsetNormal[1] * reach],
        )
      return out
    }
    default:
      return out
  }
}

/** The plan's extent once turned like the sheet turns it (pdfkit's clockwise degrees). */
export function rotatedBounds(geometry: readonly FloorplanGeometry[], rotationDeg: number) {
  const r = (rotationDeg * Math.PI) / 180
  const cos = Math.cos(r)
  const sin = Math.sin(r)
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const g of geometry) {
    for (const [x, y] of geometryPoints(g)) {
      const px = x * cos - y * sin
      const py = x * sin + y * cos
      minX = Math.min(minX, px)
      maxX = Math.max(maxX, px)
      minY = Math.min(minY, py)
      maxY = Math.max(maxY, py)
    }
  }
  if (!Number.isFinite(minX)) return null
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/** The largest usual scale (1:20, 1:25, 1:50…) at which the plan fits the window. */
export function scalaPerFinestra(widthM: number, heightM: number, box: Rect): number {
  for (const d of SCALES) {
    if ((widthM * IN_PER_M) / d <= box.w && (heightM * IN_PER_M) / d <= box.h) return d
  }
  return SCALES[SCALES.length - 1]!
}

/* ------------------------------------------------------------ primitives */

const text = (
  x: number,
  y: number,
  value: string,
  size: number,
  options: { bold?: boolean; color?: string; anchor?: 'start' | 'middle' | 'end' } = {},
): FloorplanGeometry => ({
  kind: 'text',
  x,
  y,
  text: value,
  fontSize: size,
  fontWeight: options.bold ? 700 : 400,
  fill: options.color ?? INK,
  textAnchor: options.anchor ?? 'start',
  dominantBaseline: 'middle',
})

const box = (r: Rect, stroke = INK, width = 0.012, fill = 'none'): FloorplanGeometry => ({
  kind: 'rect',
  x: r.x,
  y: r.y,
  width: r.w,
  height: r.h,
  fill,
  stroke,
  strokeWidth: width,
})

const hline = (x1: number, x2: number, y: number, color = RULE): FloorplanGeometry => ({
  kind: 'line',
  x1,
  y1: y,
  x2,
  y2: y,
  stroke: color,
  strokeWidth: 0.008,
})

/** Cut to fit a width at a font size (an estimate: about 0,55 em per character). */
export function fit(value: string, width: number, size: number): string {
  const max = Math.max(1, Math.floor(width / (size * 0.55)))
  return value.length <= max ? value : `${value.slice(0, Math.max(1, max - 1))}…`
}

/* ----------------------------------------------------------- title block */

export function cartiglio(
  r: Rect,
  intestazione: Intestazione,
  info: InfoTavola,
  scala: number | null,
  foglio: string,
): FloorplanGeometry[] {
  const out: FloorplanGeometry[] = [box(r)]
  const logoW = intestazione.logo ? Math.min(1.8, r.h * 1.6) : 0
  const cols = [logoW, (r.w - logoW) * 0.36, (r.w - logoW) * 0.34, (r.w - logoW) * 0.3]
  let x = r.x
  const cells = cols.map((w) => {
    const cell = { x, y: r.y, w, h: r.h }
    x += w
    return cell
  })
  for (const c of cells.slice(1))
    if (c.w > 0)
      out.push({
        kind: 'line',
        x1: c.x,
        y1: r.y,
        x2: c.x,
        y2: r.y + r.h,
        stroke: INK,
        strokeWidth: 0.01,
      })

  const pad = 0.1
  const big = Math.min(0.17, r.h / 6)
  const small = big * 0.7
  /** Lines stacked from the top of a cell, each as tall as its own text. */
  const stack = (
    cell: Rect,
    lines: Array<{ value: string; size: number; bold?: boolean; color?: string; gap?: number }>,
  ) => {
    let y = cell.y + pad
    for (const l of lines) {
      y += l.gap ?? 0
      if (l.value)
        out.push(
          text(cell.x + pad, y + l.size / 2, fit(l.value, cell.w - 2 * pad, l.size), l.size, {
            bold: l.bold,
            color: l.color,
          }),
        )
      y += l.size * 1.4
    }
  }

  const [logoCell, azienda, lavoro, dati] = cells as [Rect, Rect, Rect, Rect]
  if (intestazione.logo)
    out.push({
      kind: 'image',
      url: intestazione.logo,
      center: [logoCell.x + logoCell.w / 2, logoCell.y + logoCell.h / 2],
      width: logoCell.w - 2 * pad,
      height: logoCell.h - 2 * pad,
    } as FloorplanGeometry)

  stack(azienda, [
    { value: intestazione.nome, size: big, bold: true },
    { value: intestazione.indirizzo, size: small },
    { value: [intestazione.telefono, intestazione.email].filter(Boolean).join(' · '), size: small },
    { value: intestazione.piva ? `P.IVA ${intestazione.piva}` : '', size: small, color: MUTED },
  ])
  stack(lavoro, [
    { value: 'Cliente', size: small, color: MUTED },
    { value: info.cliente || '—', size: big, bold: true },
    { value: 'Progetto', size: small, color: MUTED, gap: small * 0.4 },
    { value: info.progetto, size: small, bold: true },
  ])
  const coppie: Array<[string, string]> = [
    ['Data', info.data],
    ['Scala', scala ? `1:${scala}` : '—'],
    ['Revisione', String(info.revisione)],
    ['Piano', info.piano],
    ['Foglio', foglio],
  ]
  const row = (dati.h - 2 * pad) / coppie.length
  coppie.forEach(([k, v], i) => {
    const y = dati.y + pad + row * (i + 0.5)
    out.push(text(dati.x + pad, y, k, small, { color: MUTED }))
    out.push(
      text(dati.x + dati.w - pad, y, fit(v, dati.w * 0.6, small), small, {
        bold: true,
        anchor: 'end',
      }),
    )
  })
  return out
}

/* ----------------------------------------------------------------- table */

export type Colonna = { label: string; weight: number; align?: 'start' | 'end' }

/**
 * A table in `r`: title, dark header, zebra rows. Rows that don't fit are summed up in a last
 * line, so nothing is dropped silently. Returns the geometry and the height used.
 */
export function tabella(
  r: Rect,
  titolo: string,
  colonne: readonly Colonna[],
  righe: readonly string[][],
  size = 0.1,
): { geometry: FloorplanGeometry[]; used: number } {
  const out: FloorplanGeometry[] = []
  const rowH = size * 2.1
  const titleH = size * 2.2
  out.push(text(r.x, r.y + titleH / 2, titolo, size * 1.25, { bold: true }))
  const total = colonne.reduce((s, c) => s + c.weight, 0)
  const xs: number[] = []
  let x = r.x
  for (const c of colonne) {
    xs.push(x)
    x += (c.weight / total) * r.w
  }
  const cell = (row: string[], y: number, color: string, bold: boolean) =>
    colonne.map((c, i) => {
      const w = (c.weight / total) * r.w
      const value = fit(row[i] ?? '', w - 0.12, size)
      return c.align === 'end'
        ? text(xs[i]! + w - 0.06, y, value, size, { color, bold, anchor: 'end' })
        : text(xs[i]! + 0.06, y, value, size, { color, bold })
    })
  let y = r.y + titleH
  out.push(box({ x: r.x, y, w: r.w, h: rowH }, HEAD, 0.005, HEAD))
  out.push(
    ...cell(
      colonne.map((c) => c.label),
      y + rowH / 2,
      '#ffffff',
      true,
    ),
  )
  y += rowH
  const room = Math.max(0, Math.floor((r.y + r.h - y) / rowH))
  const shown = righe.length > room ? Math.max(0, room - 1) : righe.length
  righe.slice(0, shown).forEach((row, i) => {
    if (i % 2 === 1) out.push(box({ x: r.x, y, w: r.w, h: rowH }, ZEBRA, 0.001, ZEBRA))
    out.push(...cell(row, y + rowH / 2, INK, false))
    out.push(hline(r.x, r.x + r.w, y + rowH))
    y += rowH
  })
  if (shown < righe.length) {
    out.push(
      text(r.x + 0.06, y + rowH / 2, `… e altre ${righe.length - shown} righe`, size, {
        color: MUTED,
      }),
    )
    y += rowH
  }
  return { geometry: out, used: y - r.y }
}

export const COLONNE_ELENCO: Colonna[] = [
  { label: 'Codice', weight: 2 },
  { label: 'Articolo', weight: 5 },
  { label: 'Q.tà', weight: 1, align: 'end' },
]

export const righeElenco = (rows: readonly DistintaRow[]) =>
  [...rows]
    .sort((a, b) => a.code.localeCompare(b.code, 'it'))
    .map((r) => [r.code, r.name, String(r.quantity)])

const kw = (v: number) => `${v.toFixed(2).replace('.', ',')} kW`

export function righeImpianti(r: RiepilogoImpianti): string[][] {
  const rows = TIPI_ALLACCIAMENTO.filter((t) => r.conteggi[t] > 0).map((t) => [
    TIPO[t].sigla,
    TIPO[t].label,
    String(r.conteggi[t]),
    t === 'elettrico-230' || t === 'elettrico-400' || t === 'gas' ? kw(r.potenze[t]) : '',
  ])
  const elettrica = r.potenze['elettrico-230'] + r.potenze['elettrico-400']
  if (elettrica > 0) rows.push(['', 'Potenza elettrica totale', '', kw(elettrica)])
  return rows
}

export const COLONNE_IMPIANTI: Colonna[] = [
  { label: '', weight: 1 },
  { label: 'Allacciamento', weight: 4 },
  { label: 'N.', weight: 1, align: 'end' },
  { label: 'Potenza', weight: 2, align: 'end' },
]

/* -------------------------------------------------------------- the plan */

/** A window showing the whole plan at a usual scale, centred in `area`. */
function finestraPianta(pianta: ContenutoTavola['pianta'], area: Rect) {
  const bounds = rotatedBounds([...pianta.model, ...pianta.annotations], pianta.rotationDeg)
  if (!bounds) return { windows: [], scala: null }
  const pad = Math.max(0.3, Math.max(bounds.width, bounds.height) * 0.04)
  const w = bounds.width + 2 * pad
  const h = bounds.height + 2 * pad
  const scala = scalaPerFinestra(w, h, area)
  // The window takes the whole area; the viewport is what the scale shows there, centred.
  const vw = (area.w / IN_PER_M) * scala
  const vh = (area.h / IN_PER_M) * scala
  const cx = bounds.x + bounds.width / 2
  const cy = bounds.y + bounds.height / 2
  return {
    scala,
    windows: [
      {
        rect: area,
        viewport: { x: cx - vw / 2, y: cy - vh / 2, width: vw, height: vh },
        rotationDeg: pianta.rotationDeg,
        model: { kind: 'group' as const, children: pianta.model },
        annotations: pianta.annotations.length
          ? { kind: 'group' as const, children: pianta.annotations }
          : null,
      },
    ],
  }
}

const imageIn = (dataUrl: string, aspect: number, area: Rect): FloorplanGeometry => {
  let w = area.w
  let h = w / aspect
  if (h > area.h) {
    h = area.h
    w = h * aspect
  }
  return {
    kind: 'image',
    url: dataUrl,
    center: [area.x + area.w / 2, area.y + area.h / 2],
    width: w,
    height: h,
  } as FloorplanGeometry
}

/* ---------------------------------------------------------------- sheets */

export function tavolaPages(
  formato: FormatoTavola,
  contenuto: ContenutoTavola,
  intestazione: Intestazione,
  info: InfoTavola,
): SheetPdfPage[] {
  return formato === 'A3'
    ? pagineA3(contenuto, intestazione, info)
    : pagineA4(contenuto, intestazione, info)
}

function pagineA3(
  c: ContenutoTavola,
  intestazione: Intestazione,
  info: InfoTavola,
): SheetPdfPage[] {
  const [first, ...more] = c.renders
  const total = 1 + more.length
  const { w, h } = A3
  const titleH = 1.35
  const inner = { x: MARGIN, y: MARGIN, w: w - 2 * MARGIN, h: h - 2 * MARGIN }
  const body = { x: inner.x + 0.1, y: inner.y + 0.1, w: inner.w - 0.2, h: inner.h - titleH - 0.3 }
  return [
    paginaA3({ ...c, renders: first ? [first] : [] }, intestazione, info, `1/${total}`),
    ...more.map(
      (r, i): SheetPdfPage => ({
        number: String(i + 2),
        title: 'Vista 3D',
        widthIn: w,
        heightIn: h,
        plate: [
          box(inner, INK, 0.02),
          ...cartiglio(
            { x: inner.x, y: inner.y + inner.h - titleH, w: inner.w, h: titleH },
            intestazione,
            info,
            null,
            `${i + 2}/${total}`,
          ),
        ],
        windows: [],
        overlay: [imageIn(r.dataUrl, r.aspect, body)],
      }),
    ),
  ]
}

function paginaA3(
  c: ContenutoTavola,
  intestazione: Intestazione,
  info: InfoTavola,
  foglio: string,
): SheetPdfPage {
  const render = c.renders[0]
  const { w, h } = A3
  const titleH = 1.35
  const inner = { x: MARGIN, y: MARGIN, w: w - 2 * MARGIN, h: h - 2 * MARGIN }
  const body = { x: inner.x, y: inner.y, w: inner.w, h: inner.h - titleH - 0.15 }
  const side = render || c.elenco.length || c.impianti ? 5.4 : 0
  const planArea = { x: body.x + 0.1, y: body.y + 0.1, w: body.w - side - 0.3, h: body.h - 0.2 }
  const { windows, scala } = finestraPianta(c.pianta, planArea)

  const overlay: FloorplanGeometry[] = []
  let y = body.y + 0.1
  const sx = body.x + body.w - side
  if (render) {
    const area = { x: sx, y, w: side, h: Math.min(3.4, side / render.aspect) }
    overlay.push(imageIn(render.dataUrl, render.aspect, area), box(area, RULE, 0.008))
    y += area.h + 0.25
  }
  const bottom = body.y + body.h - 0.1
  const impiantiRows = c.impianti ? righeImpianti(c.impianti) : []
  const impiantiH = impiantiRows.length ? (impiantiRows.length + 1) * 0.21 + 0.3 : 0
  if (c.elenco.length) {
    const t = tabella(
      { x: sx, y, w: side, h: bottom - y - impiantiH },
      'Attrezzature',
      COLONNE_ELENCO,
      righeElenco(c.elenco),
    )
    overlay.push(...t.geometry)
    y += t.used + 0.25
  }
  if (impiantiRows.length)
    overlay.push(
      ...tabella({ x: sx, y, w: side, h: bottom - y }, 'Impianti', COLONNE_IMPIANTI, impiantiRows)
        .geometry,
    )

  return {
    number: '1',
    title: info.progetto,
    widthIn: w,
    heightIn: h,
    plate: [
      box(inner, INK, 0.02),
      ...cartiglio(
        { x: inner.x, y: inner.y + inner.h - titleH, w: inner.w, h: titleH },
        intestazione,
        info,
        scala,
        foglio,
      ),
    ],
    windows,
    overlay,
  }
}

function pagineA4(
  c: ContenutoTavola,
  intestazione: Intestazione,
  info: InfoTavola,
): SheetPdfPage[] {
  const { w, h } = A4
  const titleH = 1.05
  const inner = { x: MARGIN, y: MARGIN, w: w - 2 * MARGIN, h: h - 2 * MARGIN }
  const body = { x: inner.x + 0.1, y: inner.y + 0.1, w: inner.w - 0.2, h: inner.h - titleH - 0.3 }
  const { windows, scala } = finestraPianta(c.pianta, body)

  type Draft = { title: string; windows: SheetPdfPage['windows']; overlay: FloorplanGeometry[] }
  const drafts: Draft[] = [{ title: 'Pianta', windows, overlay: [] }]
  for (const render of c.renders)
    drafts.push({
      title: 'Vista 3D',
      windows: [],
      overlay: [imageIn(render.dataUrl, render.aspect, body)],
    })

  // The equipment list runs over as many pages as it needs, the services under its end.
  const rows = righeElenco(c.elenco)
  const impiantiRows = c.impianti ? righeImpianti(c.impianti) : []
  const perPage = Math.max(1, Math.floor((body.h - 0.22) / 0.21) - 1)
  for (let start = 0; start < rows.length; start += perPage) {
    const slice = rows.slice(start, start + perPage)
    const t = tabella(body, start ? 'Attrezzature (segue)' : 'Attrezzature', COLONNE_ELENCO, slice)
    drafts.push({ title: 'Attrezzature', windows: [], overlay: t.geometry })
  }
  if (impiantiRows.length) {
    const last = drafts[drafts.length - 1]!
    const lastUsed =
      last.title === 'Attrezzature' ? (rows.length % perPage || perPage) * 0.21 + 0.45 : 0
    const room = body.h - lastUsed - 0.3
    const needed = (impiantiRows.length + 1) * 0.21 + 0.3
    if (last.title === 'Attrezzature' && needed <= room)
      last.overlay.push(
        ...tabella(
          { ...body, y: body.y + lastUsed + 0.3, h: room },
          'Impianti',
          COLONNE_IMPIANTI,
          impiantiRows,
        ).geometry,
      )
    else
      drafts.push({
        title: 'Impianti',
        windows: [],
        overlay: tabella(body, 'Impianti', COLONNE_IMPIANTI, impiantiRows).geometry,
      })
  }

  return drafts.map((d, i) => ({
    number: String(i + 1),
    title: d.title,
    widthIn: w,
    heightIn: h,
    plate: [
      box(inner, INK, 0.015),
      ...cartiglio(
        { x: inner.x, y: inner.y + inner.h - titleH, w: inner.w, h: titleH },
        intestazione,
        info,
        d.windows.length ? scala : null,
        `${i + 1}/${drafts.length}`,
      ),
    ],
    windows: d.windows,
    overlay: d.overlay,
  }))
}
