import type { AnyNode, AnyNodeId, FloorplanGeometry, FloorplanPoint } from '@pascal-app/core'
import { z } from 'zod'
import type { EquipmentNode } from './schema'

/**
 * Service connections of a unit (water, drain, power, gas), kept in `node.metadata.allacciamenti`
 * like the catalog article: typed in the CAD, saved with the unit, no schema change.
 *
 * A connection sits on one side of the unit's body. `distanza` runs along that side: on the front
 * and back from the unit's left edge (seen from the front), on the left and right from the back
 * edge, where services usually come in. `altezza` is above the floor.
 */

export const ALLACCIAMENTI_METADATA_KEY = 'allacciamenti'

export const TIPI_ALLACCIAMENTO = [
  'acqua-fredda',
  'acqua-calda',
  'scarico',
  'elettrico-230',
  'elettrico-400',
  'gas',
] as const
export type TipoAllacciamento = (typeof TIPI_ALLACCIAMENTO)[number]

export const LATI = ['retro', 'fronte', 'sinistra', 'destra'] as const
export type Lato = (typeof LATI)[number]

export const TIPO: Record<
  TipoAllacciamento,
  { label: string; sigla: string; colore: string; potenza: 'kW' | null; altezza: number }
> = {
  'acqua-fredda': {
    label: 'Acqua fredda',
    sigla: 'AF',
    colore: '#2563eb',
    potenza: null,
    altezza: 0.5,
  },
  'acqua-calda': {
    label: 'Acqua calda',
    sigla: 'AC',
    colore: '#dc2626',
    potenza: null,
    altezza: 0.5,
  },
  scarico: { label: 'Scarico', sigla: 'S', colore: '#57534e', potenza: null, altezza: 0.4 },
  'elettrico-230': {
    label: 'Corrente 230 V',
    sigla: '230',
    colore: '#ca8a04',
    potenza: 'kW',
    altezza: 0.5,
  },
  'elettrico-400': {
    label: 'Corrente 400 V',
    sigla: '400',
    colore: '#9333ea',
    potenza: 'kW',
    altezza: 0.5,
  },
  gas: { label: 'Gas', sigla: 'G', colore: '#ea580c', potenza: 'kW', altezza: 0.5 },
}

export const LATO_LABEL: Record<Lato, string> = {
  retro: 'Retro',
  fronte: 'Fronte',
  sinistra: 'Sinistra',
  destra: 'Destra',
}

export const Allacciamento = z.object({
  tipo: z.enum(TIPI_ALLACCIAMENTO),
  lato: z.enum(LATI).default('retro'),
  distanza: z.number().min(0).default(0.1),
  altezza: z.number().min(0).max(4).default(0.5),
  /** kW, for power and gas only. */
  potenza: z.number().min(0).optional(),
  /** Dimension it from the walls in the plan. */
  quota: z.boolean().default(true),
})
export type Allacciamento = z.infer<typeof Allacciamento>

/** The unit's connections; entries that don't parse (edited by hand) are skipped. */
export function readAllacciamenti(metadata: Record<string, unknown> | undefined): Allacciamento[] {
  const raw = metadata?.[ALLACCIAMENTI_METADATA_KEY]
  if (!Array.isArray(raw)) return []
  const out: Allacciamento[] = []
  for (const entry of raw) {
    const parsed = Allacciamento.safeParse(entry)
    if (parsed.success) out.push(parsed.data)
  }
  return out
}

export function withAllacciamenti(
  metadata: Record<string, unknown> | undefined,
  list: readonly Allacciamento[],
): Record<string, unknown> {
  const next = { ...metadata }
  if (list.length) next[ALLACCIAMENTI_METADATA_KEY] = list.map((a) => ({ ...a }))
  else delete next[ALLACCIAMENTI_METADATA_KEY]
  return next
}

export function nuovoAllacciamento(tipo: TipoAllacciamento, distanza = 0.1): Allacciamento {
  return {
    tipo,
    lato: 'retro',
    distanza,
    altezza: TIPO[tipo].altezza,
    ...(TIPO[tipo].potenza ? { potenza: 0 } : {}),
    quota: true,
  }
}

const PASSO = 0.15

/**
 * A new connection, next to the last one on the same side (15 cm on), moving to the next side
 * when the back is full: added one by one, they never land on top of each other.
 */
export function prossimoAllacciamento(
  node: Pick<EquipmentNode, 'width' | 'depth'>,
  list: readonly Allacciamento[],
  tipo: TipoAllacciamento,
): Allacciamento {
  for (const lato of ['retro', 'sinistra', 'destra', 'fronte'] as const) {
    const length = latoLength(node, lato)
    const used = list.filter((a) => a.lato === lato).map((a) => a.distanza)
    const distanza = used.length ? Math.max(...used) + PASSO : Math.min(0.1, length / 2)
    if (distanza <= length + 1e-9) return { ...nuovoAllacciamento(tipo, distanza), lato }
  }
  return nuovoAllacciamento(tipo, Math.min(0.1, node.width / 2))
}

/**
 * A starting set per kind, to correct against the data sheet: indicative values only, so a
 * new drawing doesn't start from a blank list.
 */
const TIPICI: Record<string, ReadonlyArray<[TipoAllacciamento, number?]>> = {
  'horeca:banco-frigo': [['elettrico-230', 0.4]],
  'horeca:cella-frigo': [['elettrico-230', 1.2], ['scarico']],
  'horeca:lavello': [['acqua-fredda'], ['acqua-calda'], ['scarico']],
  'horeca:lavamani': [['acqua-fredda'], ['acqua-calda'], ['scarico']],
  'horeca:lavastoviglie': [['acqua-fredda'], ['scarico'], ['elettrico-400', 6.5]],
  'horeca:abbattitore': [['elettrico-230', 1.2]],
  'horeca:mantecatore': [['elettrico-400', 7], ['acqua-fredda'], ['scarico']],
  'horeca:pastorizzatore': [['elettrico-400', 7], ['acqua-fredda'], ['scarico']],
  'horeca:frigorifero': [['elettrico-230', 0.3]],
}

export function allacciamentiTipici(kind: string, width: number): Allacciamento[] {
  const list = TIPICI[kind] ?? []
  // Spread along the back, 15 cm apart, centred on the unit.
  const step = PASSO
  const start = Math.max(0.05, width / 2 - ((list.length - 1) * step) / 2)
  return list.map(([tipo, potenza], i) => ({
    ...nuovoAllacciamento(tipo, Math.min(width, start + i * step)),
    ...(potenza !== undefined ? { potenza } : {}),
  }))
}

export const hasTipici = (kind: string) => (TIPICI[kind]?.length ?? 0) > 0

/** Length of the side a connection runs along. */
export const latoLength = (node: Pick<EquipmentNode, 'width' | 'depth'>, lato: Lato) =>
  lato === 'retro' || lato === 'fronte' ? node.width : node.depth

/** Unit-local (x, z) of a connection: front is +z, left is −x, as in the plan marks. */
export function localPoint(
  node: Pick<EquipmentNode, 'width' | 'depth'>,
  a: Pick<Allacciamento, 'lato' | 'distanza'>,
): [number, number] {
  const hw = node.width / 2
  const hd = node.depth / 2
  const d = Math.min(Math.max(a.distanza, 0), latoLength(node, a.lato))
  if (a.lato === 'fronte') return [-hw + d, hd]
  if (a.lato === 'retro') return [-hw + d, -hd]
  if (a.lato === 'sinistra') return [-hw, -hd + d]
  return [hw, -hd + d]
}

/** Outward unit normal of a side, unit-local. */
const LATO_NORMAL: Record<Lato, [number, number]> = {
  fronte: [0, 1],
  retro: [0, -1],
  sinistra: [-1, 0],
  destra: [1, 0],
}

export type PlanTransform = (lx: number, lz: number) => FloorplanPoint

export function planTransformOf(node: Pick<EquipmentNode, 'position' | 'rotation'>): PlanTransform {
  const [cx, , cz] = node.position
  const cos = Math.cos(node.rotation)
  const sin = Math.sin(node.rotation)
  return (lx, lz) => [cx + lx * cos + lz * sin, cz - lx * sin + lz * cos]
}

/** A wall face as a plan segment, for dimensioning. */
export type WallFace = { a: FloorplanPoint; b: FloorplanPoint }

/** Both faces of every straight wall among the level's children. Curved walls are skipped. */
export function wallFacesOf(walls: readonly AnyNode[]): WallFace[] {
  const faces: WallFace[] = []
  for (const node of walls) {
    if (node.type !== 'wall') continue
    const w = node as unknown as {
      start: [number, number]
      end: [number, number]
      thickness?: number
      curveOffset?: number
    }
    if (w.curveOffset && Math.abs(w.curveOffset) > 1e-6) continue
    const dx = w.end[0] - w.start[0]
    const dy = w.end[1] - w.start[1]
    const length = Math.hypot(dx, dy)
    if (length < 1e-6) continue
    const half = (w.thickness ?? 0.1) / 2
    const nx = -dy / length
    const ny = dx / length
    for (const s of [1, -1]) {
      faces.push({
        a: [w.start[0] + nx * half * s, w.start[1] + ny * half * s],
        b: [w.end[0] + nx * half * s, w.end[1] + ny * half * s],
      })
    }
  }
  return faces
}

type Foot = { foot: FloorplanPoint; distance: number; direction: [number, number] }

/** Perpendicular foot of `p` on a face, when it falls within the face. */
function footOn(face: WallFace, p: FloorplanPoint): Foot | null {
  const dx = face.b[0] - face.a[0]
  const dy = face.b[1] - face.a[1]
  const length2 = dx * dx + dy * dy
  const t = ((p[0] - face.a[0]) * dx + (p[1] - face.a[1]) * dy) / length2
  if (t < 0 || t > 1) return null
  const foot: FloorplanPoint = [face.a[0] + t * dx, face.a[1] + t * dy]
  const length = Math.sqrt(length2)
  return {
    foot,
    distance: Math.hypot(p[0] - foot[0], p[1] - foot[1]),
    direction: [dx / length, dy / length],
  }
}

/**
 * The two dimensions that place a point in the room: to the nearest wall face, and to the
 * nearest face running across it (at least 60° off). Faces beyond `maxDistance` are ignored.
 */
export function wallDimensions(
  p: FloorplanPoint,
  faces: readonly WallFace[],
  maxDistance = 6,
): Foot[] {
  const feet = faces
    .map((face) => footOn(face, p))
    .filter((f): f is Foot => f !== null && f.distance > 0.005 && f.distance <= maxDistance)
    .sort((x, y) => x.distance - y.distance)
  const first = feet[0]
  if (!first) return []
  const across = feet.find(
    (f) =>
      Math.abs(f.direction[0] * first.direction[0] + f.direction[1] * first.direction[1]) < 0.5,
  )
  return across ? [first, across] : [first]
}

const metri = (value: number) => `${value.toFixed(2).replace('.', ',')}`

const SYMBOL_R = 0.07

const QUOTE_COLOR = '#c2410c'
/** Centre-to-centre gap between two symbols on the same side. */
const SYMBOL_GAP = 2 * SYMBOL_R + 0.03

/**
 * Where each symbol sits along its side: at its connection, unless that would touch a
 * neighbour; then the close ones spread apart, evenly around where they belong, each tied to its
 * point by a slanted leader.
 */
export function symbolSlots(list: readonly Pick<Allacciamento, 'lato' | 'distanza'>[]): number[] {
  const slots = list.map((a) => a.distanza)
  for (const lato of LATI) {
    const order = list
      .map((a, i) => ({ d: a.distanza, i }))
      .filter((_, i) => list[i]!.lato === lato)
      .sort((x, y) => x.d - y.d)
    // Clusters of evenly spaced symbols, each centred on the mean of the points it holds;
    // a cluster that reaches into the one before merges with it.
    const clusters: Array<{ items: typeof order; centre: number }> = []
    for (const item of order) {
      clusters.push({ items: [item], centre: item.d })
      for (;;) {
        const last = clusters[clusters.length - 1]!
        const prev = clusters[clusters.length - 2]
        if (!prev) break
        const prevEnd = prev.centre + ((prev.items.length - 1) * SYMBOL_GAP) / 2
        const lastStart = last.centre - ((last.items.length - 1) * SYMBOL_GAP) / 2
        if (lastStart - prevEnd >= SYMBOL_GAP - 1e-9) break
        const items = [...prev.items, ...last.items]
        clusters.splice(-2, 2, {
          items,
          centre: items.reduce((sum, x) => sum + x.d, 0) / items.length,
        })
      }
    }
    for (const { items, centre } of clusters)
      for (const [k, { i }] of items.entries())
        slots[i] = centre + (k - (items.length - 1) / 2) * SYMBOL_GAP
  }
  return slots
}

const dot = (a: readonly number[], b: readonly number[]) => a[0]! * b[0]! + a[1]! * b[1]!

/**
 * Dimensions for the connections on one side of a unit, as on a services drawing: one dimension
 * from the nearest wall (all the points of a side sit at the same depth), and one chain along it,
 * from the nearest wall across to each connection in turn.
 */
export function sideDimensions(
  points: readonly FloorplanPoint[],
  faces: readonly WallFace[],
  /** Where to draw the dimension from the wall behind, clear of the symbols (a corner). */
  depthAnchor?: FloorplanPoint,
): FloorplanGeometry[] {
  const first = points[0]
  if (!first) return []
  const [behind, across] = wallDimensions(first, faces)
  if (!behind) return []
  const out: FloorplanGeometry[] = []
  // From the wall behind: once, unless the points sit at different depths (a slanted wall).
  const depths = points.map((p) => wallDimensions(p, [faceThrough(behind)])[0]?.distance ?? 0)
  const sameDepth = depths.every((d) => Math.abs(d - depths[0]!) < 0.01)
  const depthPoints = sameDepth && depthAnchor ? [depthAnchor] : points
  for (const [i, p] of depthPoints.entries()) {
    if (sameDepth && i > 0) break
    const foot = wallDimensions(p, [faceThrough(behind)])[0]
    if (!foot) continue
    out.push({
      kind: 'dimension',
      start: foot.foot,
      end: p,
      dimensionStart: foot.foot,
      dimensionEnd: p,
      offsetNormal: behind.direction,
      offsetDistance: 0,
      extensionOvershoot: 0.03,
      text: metri(foot.distance),
      stroke: QUOTE_COLOR,
    })
  }
  if (!across) return out
  // Along the wall: from the cross wall to each point, nearest first, as one chain.
  const along: [number, number] = [-across.direction[1], across.direction[0]]
  const toward = dot(along, [first[0] - across.foot[0], first[1] - across.foot[1]]) >= 0 ? 1 : -1
  const order = [...points].sort(
    (a, b) =>
      toward * dot(along, [a[0] - across.foot[0], a[1] - across.foot[1]]) -
      toward * dot(along, [b[0] - across.foot[0], b[1] - across.foot[1]]),
  )
  const chain = [wallDimensions(order[0]!, [faceThrough(across)])[0]?.foot ?? across.foot, ...order]
  const segments = []
  for (let i = 1; i < chain.length; i++) {
    const a = chain[i - 1]!
    const b = chain[i]!
    const length = Math.abs(dot(along, [b[0] - a[0], b[1] - a[1]]))
    if (length < 0.005) continue
    segments.push({ start: a, end: b, text: metri(length) })
  }
  if (!segments.length) return out
  // The chain runs in the gap towards the wall behind when there is room, else over the unit.
  const wallNormal: [number, number] = [-behind.direction[1], behind.direction[0]]
  const side = dot(wallNormal, [first[0] - behind.foot[0], first[1] - behind.foot[1]]) >= 0 ? 1 : -1
  const away: FloorplanPoint = [wallNormal[0] * side, wallNormal[1] * side]
  const roomy = behind.distance > 0.35
  out.push({
    kind: 'dimension-string',
    segments,
    offsetNormal: roomy ? [-away[0], -away[1]] : away,
    offsetDistance: roomy ? Math.min(0.3, behind.distance - 0.05) : 0.3,
    extensionOvershoot: 0.03,
    stroke: QUOTE_COLOR,
  })
  return out
}

/** The infinite line of a wall face found by `wallDimensions`, as a long face. */
function faceThrough(foot: Foot): WallFace {
  const far = 1000
  return {
    a: [foot.foot[0] - foot.direction[0] * far, foot.foot[1] - foot.direction[1] * far],
    b: [foot.foot[0] + foot.direction[0] * far, foot.foot[1] + foot.direction[1] * far],
  }
}

/**
 * The plan drawing of a unit's connections: a circle with the type's initials just outside the
 * side, the height under it, and the wall dimensions when asked. One group, tagged for the DXF
 * export so it lands on its own layer.
 */
export function allacciamentiFloorplan(
  node: EquipmentNode,
  list: readonly Allacciamento[],
  faces: readonly WallFace[],
  /** Marks the dimensions so the editor shows them with the manual dimensions (see definitions). */
  tagQuote: (g: FloorplanGeometry) => FloorplanGeometry = (g) => g,
): FloorplanGeometry | null {
  if (!list.length) return null
  const at = planTransformOf(node)
  const children: FloorplanGeometry[] = []
  const quote: FloorplanGeometry[] = []
  const quoted: Array<{ lato: Lato; point: FloorplanPoint; distanza: number }> = []
  const slots = symbolSlots(list)
  for (const [index, a] of list.entries()) {
    const t = TIPO[a.tipo]
    const [lx, lz] = localPoint(node, a)
    const [nx, nz] = LATO_NORMAL[a.lato]
    const point = at(lx, lz)
    // The symbol sits just outside the side, slid along it when it would touch a neighbour.
    const out = SYMBOL_R + 0.04
    const slide =
      (slots[index] ?? a.distanza) - Math.min(Math.max(a.distanza, 0), latoLength(node, a.lato))
    const [tx, tz] = [Math.abs(nz), Math.abs(nx)]
    const symbol = at(lx + nx * out + tx * slide, lz + nz * out + tz * slide)
    children.push(
      {
        kind: 'line',
        x1: point[0],
        y1: point[1],
        x2: symbol[0],
        y2: symbol[1],
        stroke: t.colore,
        strokeWidth: 1,
        vectorEffect: 'non-scaling-stroke',
      },
      {
        kind: 'circle',
        cx: symbol[0],
        cy: symbol[1],
        r: SYMBOL_R,
        fill: '#ffffff',
        stroke: t.colore,
        strokeWidth: 1.5,
        vectorEffect: 'non-scaling-stroke',
      },
      {
        kind: 'text',
        x: symbol[0],
        y: symbol[1],
        text: t.sigla,
        fontSize: t.sigla.length > 2 ? 0.045 : 0.06,
        fill: t.colore,
        textAnchor: 'middle',
        dominantBaseline: 'central',
        upright: true,
      },
    )
    if (!a.quota) continue
    // The height goes just past the symbol, away from the unit.
    const far = out + SYMBOL_R + 0.05
    const label = at(lx + nx * far + tx * slide, lz + nz * far + tz * slide)
    quote.push({
      kind: 'text',
      x: label[0],
      y: label[1],
      text: `h ${metri(a.altezza)}`,
      fontSize: 0.05,
      fill: t.colore,
      textAnchor: 'middle',
      dominantBaseline: 'central',
      upright: true,
    })
    quoted.push({ lato: a.lato, point, distanza: a.distanza })
  }
  for (const lato of LATI) {
    const group = quoted.filter((q) => q.lato === lato)
    if (!group.length) continue
    // The side's corner farther from the connections carries the dimension from the wall.
    const mean = group.reduce((sum, q) => sum + q.distanza, 0) / group.length
    const corner = mean > latoLength(node, lato) / 2 ? 0 : latoLength(node, lato)
    const [cx, cz] = localPoint(node, { lato, distanza: corner })
    quote.push(
      ...sideDimensions(
        group.map((q) => q.point),
        faces,
        at(cx, cz),
      ),
    )
  }
  if (quote.length) children.push(tagQuote({ kind: 'group', children: quote }))
  return { kind: 'group', children, metadata: { dxfLayer: 'IMPIANTI' } }
}

/** The level's wall faces, read through the plan context. */
export function levelWallFaces(
  parent: AnyNode | null,
  resolve: (id: AnyNodeId) => AnyNode | undefined,
): WallFace[] {
  const ids = (parent as unknown as { children?: AnyNodeId[] } | null)?.children ?? []
  const walls: AnyNode[] = []
  for (const id of ids) {
    const child = resolve(id)
    if (child?.type === 'wall') walls.push(child)
  }
  return wallFacesOf(walls)
}

export type RiepilogoImpianti = {
  conteggi: Record<TipoAllacciamento, number>
  /** kW per type, for the types that carry power. */
  potenze: Record<'elettrico-230' | 'elettrico-400' | 'gas', number>
  /** Power or gas connections with no power typed in. */
  senzaPotenza: number
}

export function riepilogoImpianti(nodes: Iterable<{ metadata?: unknown }>): RiepilogoImpianti {
  const conteggi = Object.fromEntries(TIPI_ALLACCIAMENTO.map((t) => [t, 0])) as Record<
    TipoAllacciamento,
    number
  >
  const potenze = { 'elettrico-230': 0, 'elettrico-400': 0, gas: 0 }
  let senzaPotenza = 0
  for (const node of nodes) {
    for (const a of readAllacciamenti(node.metadata as Record<string, unknown> | undefined)) {
      conteggi[a.tipo] += 1
      if (a.tipo === 'elettrico-230' || a.tipo === 'elettrico-400' || a.tipo === 'gas') {
        if (a.potenza && a.potenza > 0) potenze[a.tipo] += a.potenza
        else senzaPotenza += 1
      }
    }
  }
  return { conteggi, potenze, senzaPotenza }
}
