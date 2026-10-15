import { type DxfEntity, type DxfParsed, denormalise, parseString } from 'dxf'
import applyTransforms from 'dxf/lib/applyTransforms'
import entityToPolyline from 'dxf/lib/entityToPolyline'

/**
 * A DXF survey (rilievo) turned into plain data the plan can draw: line segments per layer, texts
 * and linear dimensions. Coordinates are in drawing units, already in plan axes (DXF y points up
 * on paper, the plan's y points down, so y is negated) and centred on the drawing; `unit` is metres
 * per drawing unit. DWG files are not read: they must be saved as DXF first (see PIANO.md, fase 3).
 */

export type RilievoPoint = [number, number]

export type RilievoLayer = {
  name: string
  visible: boolean
  /** Flat x1, y1, x2, y2 quadruples. Curves arrive already split into short segments. */
  segments: number[]
}

export type RilievoText = {
  layer: string
  x: number
  y: number
  text: string
  height: number
  /** Plan radians, clockwise on screen (SVG rotation). */
  angle: number
  anchor: 'start' | 'middle' | 'end'
  baseline: 'alphabetic' | 'central' | 'hanging'
}

/** A linear dimension: measured points `a`, `b` and the dimension line through `lineA`–`lineB`. */
export type RilievoDimension = {
  layer: string
  a: RilievoPoint
  b: RilievoPoint
  lineA: RilievoPoint
  lineB: RilievoPoint
}

export type RilievoData = {
  unit: number
  /** True when the file did not say its unit and `unit` was guessed from the drawing size. */
  unitGuessed: boolean
  layers: RilievoLayer[]
  texts: RilievoText[]
  dimensions: RilievoDimension[]
  /** Drawing extent in drawing units, width × height. */
  size: RilievoPoint
}

/** `$INSUNITS` codes → metres. */
const INSUNITS: Record<number, number> = { 1: 0.0254, 2: 0.3048, 4: 0.001, 5: 0.01, 6: 1, 14: 0.1 }

export const UNIT_CHOICES: ReadonlyArray<{ unit: number; label: string }> = [
  { unit: 0.001, label: 'millimetri' },
  { unit: 0.01, label: 'centimetri' },
  { unit: 1, label: 'metri' },
  { unit: 0.0254, label: 'pollici' },
]

/** A room drawn in mm spans thousands of units, in cm hundreds, in metres tens. */
export function guessUnit(largestSide: number): number {
  if (largestSide >= 2000) return 0.001
  if (largestSide >= 100) return 0.01
  return 1
}

const round = (v: number) => Math.round(v * 10_000) / 10_000

/** MTEXT inline formatting (`\P`, `{\fArial;…}`, `\H2.5x;`…) and `%%` codes → plain text. */
export function plainText(raw: string): string {
  return raw
    .replace(/\\P/gi, ' ')
    .replace(/\\~/g, ' ')
    .replace(/\\[ACcFfHhQTWp][^;]*;/g, '')
    .replace(/\\[LlOoKkX]/g, '')
    .replace(/\\S([^;^/#]*)[\^/#]([^;]*);/g, '$1/$2')
    .replace(/[{}]/g, '')
    .replace(/%%[cC]/g, 'Ø')
    .replace(/%%[dD]/g, '°')
    .replace(/%%[pP]/g, '±')
    .replace(/%%[uUoO]/g, '')
    .replace(/\\\\/g, '\\')
    .replace(/\s+/g, ' ')
    .trim()
}

type Transforms = Array<Record<string, number | undefined>>
type Pt = { x: number; y: number }

const num = (v: unknown, fallback = 0) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback
const pt = (v: unknown): Pt => {
  const p = (v ?? {}) as { x?: unknown; y?: unknown }
  return { x: num(p.x), y: num(p.y) }
}

function place(p: Pt, transforms: Transforms): Pt {
  const [q] = applyTransforms([[p.x, p.y]], transforms)
  return { x: q?.[0] ?? p.x, y: q?.[1] ?? p.y }
}

/** Total rotation (degrees) and uniform scale the block inserts add to an entity. */
function insertFrame(transforms: Transforms) {
  let rotation = 0
  let scale = 1
  for (const t of transforms) {
    rotation += num(t.rotation)
    scale *= Math.abs(num(t.scaleX, 1)) || 1
  }
  return { rotation, scale }
}

/**
 * Non-linear dimensions (angles, radii) are drawn from the block CAD software stored with them:
 * turn them into inserts of that block so they come out as plain lines and texts.
 */
function dimensionsAsInserts(entities: DxfEntity[]): DxfEntity[] {
  return entities.map((e) =>
    e.type === 'DIMENSION' && !isLinear(e) && typeof e.block === 'string'
      ? { type: 'INSERT', block: e.block, layer: e.layer, x: 0, y: 0 }
      : e,
  )
}
const isLinear = (e: DxfEntity) => e.dimensionType === 0 || e.dimensionType === 1

const SKIPPED = new Set(['HATCH', 'SOLID', 'POINT', 'VIEWPORT', 'OLE2FRAME', 'ATTDEF', '3DFACE'])

export function parseDxfRilievo(text: string): RilievoData {
  let parsed: DxfParsed
  try {
    parsed = parseString(text)
  } catch {
    throw new Error('Il file non è un DXF leggibile.')
  }
  if (!parsed || !Array.isArray(parsed.entities)) throw new Error('Il file non è un DXF leggibile.')
  parsed = {
    ...parsed,
    entities: dimensionsAsInserts(parsed.entities),
    blocks: (parsed.blocks ?? []).map((b) => ({
      ...b,
      entities: dimensionsAsInserts(b.entities ?? []),
    })),
  }

  const segments = new Map<string, number[]>()
  const texts: RilievoText[] = []
  const dimensions: RilievoDimension[] = []
  // Drawing coordinates as read (y up); flipped and centred at the end.
  const add = (layer: string, a: Pt, b: Pt) => {
    const list = segments.get(layer) ?? []
    if (list.length === 0) segments.set(layer, list)
    list.push(a.x, a.y, b.x, b.y)
  }

  for (const entity of denormalise(parsed)) {
    // Paper-space entities (title blocks, viewports) are not part of the plan.
    if (entity.paperSpace) continue
    const layer = entity.layer ?? '0'
    const transforms = entity.transforms as Transforms
    if (entity.type === 'TEXT' || entity.type === 'MTEXT') {
      const t = readText(entity, transforms, layer)
      if (t) texts.push(t)
      continue
    }
    if (entity.type === 'DIMENSION') {
      const d = readDimension(entity, transforms, layer)
      if (d) dimensions.push(d)
      continue
    }
    if (SKIPPED.has(entity.type)) continue
    const line = applyTransforms(entityToPolyline(entity), transforms)
    for (let i = 1; i < line.length; i++) {
      const [x1, y1] = line[i - 1]!
      const [x2, y2] = line[i]!
      if (![x1, y1, x2, y2].every(Number.isFinite)) continue
      add(layer, { x: x1, y: y1 }, { x: x2, y: y2 })
    }
  }

  // Extent over everything drawn.
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  const grow = (x: number, y: number) => {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  for (const list of segments.values())
    for (let i = 0; i < list.length; i += 2) grow(list[i]!, list[i + 1]!)
  for (const t of texts) grow(t.x, t.y)
  for (const d of dimensions) for (const p of [d.a, d.b, d.lineA, d.lineB]) grow(p[0], p[1])
  if (!Number.isFinite(minX))
    throw new Error('Il DXF non contiene linee, testi o quote da importare.')

  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const fx = (x: number) => round(x - cx)
  const fy = (y: number) => round(cy - y)
  const fp = (p: RilievoPoint): RilievoPoint => [fx(p[0]), fy(p[1])]

  const tableLayers = parsed.tables?.layers ?? {}
  const layers: RilievoLayer[] = [
    ...segments.keys(),
    ...texts.map((t) => t.layer),
    ...dimensions.map((d) => d.layer),
  ]
    .filter((name, i, all) => all.indexOf(name) === i)
    .sort((a, b) => a.localeCompare(b, 'it'))
    .map((name) => {
      const table = tableLayers[name]
      // A negative colour means "layer off"; flag bit 1 means frozen.
      const off = num(table?.colorNumber, 7) < 0 || (num(table?.flags) & 1) === 1
      const list = segments.get(name) ?? []
      return {
        name,
        visible: !off,
        segments: list.map((v, i) => (i % 2 === 0 ? fx(v) : fy(v))),
      }
    })

  const size: RilievoPoint = [round(maxX - minX), round(maxY - minY)]
  const declared = INSUNITS[num(parsed.header?.insUnits)]
  return {
    unit: declared ?? guessUnit(Math.max(...size)),
    unitGuessed: declared === undefined,
    layers,
    // The y flip mirrors angles: counter-clockwise on paper becomes clockwise on screen.
    texts: texts.map((t) => ({
      ...t,
      x: fx(t.x),
      y: fy(t.y),
      height: round(t.height),
      angle: -t.angle,
    })),
    dimensions: dimensions.map((d) => ({
      ...d,
      a: fp(d.a),
      b: fp(d.b),
      lineA: fp(d.lineA),
      lineB: fp(d.lineB),
    })),
    size,
  }
}

const TEXT_ANCHOR = ['start', 'middle', 'end'] as const
const MTEXT_BASELINE = ['hanging', 'central', 'alphabetic'] as const

function readText(entity: DxfEntity, transforms: Transforms, layer: string): RilievoText | null {
  const frame = insertFrame(transforms)
  if (entity.type === 'TEXT') {
    const text = plainText(String(entity.string ?? ''))
    if (!text) return null
    const hAlign = num(entity.hAlign)
    const vAlign = num(entity.vAlign)
    // Aligned texts are placed by their second point.
    const aligned = (hAlign !== 0 || vAlign !== 0) && entity.x2 !== undefined
    const at = place(aligned ? { x: num(entity.x2), y: num(entity.y2) } : pt(entity), transforms)
    return {
      layer,
      x: at.x,
      y: at.y,
      text,
      height: num(entity.textHeight, 1) * frame.scale,
      angle: ((num(entity.rotation) + frame.rotation) * Math.PI) / 180,
      anchor: hAlign === 1 || hAlign === 4 ? 'middle' : hAlign === 2 ? 'end' : 'start',
      baseline: vAlign === 3 ? 'hanging' : vAlign === 2 || hAlign === 4 ? 'central' : 'alphabetic',
    }
  }
  const text = plainText(String(entity.string ?? ''))
  if (!text) return null
  const at = place(pt(entity), transforms)
  const attachment = Math.min(9, Math.max(1, num(entity.attachmentPoint, 1))) - 1
  const own = Math.atan2(num(entity.xAxisY), num(entity.xAxisX, 1))
  return {
    layer,
    x: at.x,
    y: at.y,
    text,
    height: num(entity.nominalTextHeight, 1) * frame.scale,
    angle: own + (frame.rotation * Math.PI) / 180,
    anchor: TEXT_ANCHOR[attachment % 3]!,
    baseline: MTEXT_BASELINE[Math.floor(attachment / 3)]!,
  }
}

function readDimension(
  entity: DxfEntity,
  transforms: Transforms,
  layer: string,
): RilievoDimension | null {
  const a = place(pt(entity.measureStart), transforms)
  const b = place(pt(entity.measureEnd), transforms)
  const on = place(pt(entity.start), transforms)
  let dx: number
  let dy: number
  if (entity.dimensionType === 1) {
    dx = b.x - a.x
    dy = b.y - a.y
  } else {
    const deg = num(entity.rotation) + insertFrame(transforms).rotation
    dx = Math.cos((deg * Math.PI) / 180)
    dy = Math.sin((deg * Math.PI) / 180)
  }
  const len = Math.hypot(dx, dy)
  if (len < 1e-9) return null
  dx /= len
  dy /= len
  // The dimension line passes through `on` along (dx, dy); project the measured points onto it.
  const foot = (p: Pt): RilievoPoint => {
    const t = (p.x - on.x) * dx + (p.y - on.y) * dy
    return [on.x + dx * t, on.y + dy * t]
  }
  const lineA = foot(a)
  const lineB = foot(b)
  if (Math.hypot(lineB[0] - lineA[0], lineB[1] - lineA[1]) < 1e-9) return null
  return { layer, a: [a.x, a.y], b: [b.x, b.y], lineA, lineB }
}
