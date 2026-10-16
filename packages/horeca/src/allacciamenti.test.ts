import { describe, expect, test } from 'bun:test'
import type { AnyNode, FloorplanGeometry } from '@pascal-app/core'
import {
  allacciamentiFloorplan,
  allacciamentiTipici,
  localPoint,
  nuovoAllacciamento,
  prossimoAllacciamento,
  readAllacciamenti,
  riepilogoImpianti,
  sideDimensions,
  symbolSlots,
  wallDimensions,
  wallFacesOf,
  withAllacciamenti,
} from './allacciamenti'
import { planToDxf } from './dxf-export'
import type { EquipmentNode } from './schema'

const unit = {
  type: 'horeca:lavello',
  position: [2, 0, 1],
  rotation: 0,
  width: 1.2,
  depth: 0.7,
  height: 0.9,
  elevation: 0,
  metadata: {},
} as unknown as EquipmentNode

describe('connections data', () => {
  test('round trip through metadata, skipping entries edited by hand', () => {
    const metadata = withAllacciamenti({ product: { code: 'X' } }, [nuovoAllacciamento('scarico')])
    expect(metadata.product).toEqual({ code: 'X' })
    const raw = metadata.allacciamenti as unknown[]
    raw.push({ tipo: 'vapore' })
    expect(readAllacciamenti(metadata)).toEqual([
      { tipo: 'scarico', lato: 'retro', distanza: 0.1, altezza: 0.4, quota: true },
    ])
    expect(withAllacciamenti(metadata, [])).toEqual({ product: { code: 'X' } })
  })

  test('typical set: a sink gets cold, hot and drain along the back, centred', () => {
    const list = allacciamentiTipici('horeca:lavello', 1.2)
    expect(list.map((a) => a.tipo)).toEqual(['acqua-fredda', 'acqua-calda', 'scarico'])
    const d = list.map((a) => a.distanza)
    expect(d[0]).toBeCloseTo(0.45)
    expect(d[1]).toBeCloseTo(0.6)
    expect(d[2]).toBeCloseTo(0.75)
    expect(allacciamentiTipici('horeca:tavolo', 1.4)).toEqual([])
    const dishwasher = allacciamentiTipici('horeca:lavastoviglie', 0.6)
    expect(dishwasher.find((a) => a.tipo === 'elettrico-400')?.potenza).toBe(6.5)
  })

  test('local points: front is +z, the left edge is −x, sides measured from the back', () => {
    expect(localPoint(unit, { lato: 'retro', distanza: 0.1 })).toEqual([-0.5, -0.35])
    expect(localPoint(unit, { lato: 'fronte', distanza: 0.6 })).toEqual([0, 0.35])
    const right = localPoint(unit, { lato: 'destra', distanza: 0.2 })
    expect(right[0]).toBe(0.6)
    expect(right[1]).toBeCloseTo(-0.15)
    // Clamped to the side's length.
    expect(localPoint(unit, { lato: 'sinistra', distanza: 5 })).toEqual([-0.6, 0.35])
  })
})

describe('adding one by one', () => {
  test('each new connection goes 15 cm after the last on the back, then on to the sides', () => {
    const small = { width: 0.4, depth: 0.5 }
    let list: ReturnType<typeof nuovoAllacciamento>[] = []
    for (let i = 0; i < 4; i++) list = [...list, prossimoAllacciamento(small, list, 'scarico')]
    expect(list.map((a) => a.lato)).toEqual(['retro', 'retro', 'retro', 'sinistra'])
    expect(list[1]!.distanza).toBeCloseTo(0.25)
    expect(list[2]!.distanza).toBeCloseTo(0.4)
    expect(list[3]!.distanza).toBeCloseTo(0.1)
  })

  test('symbols that would touch spread evenly around their points; others stay put', () => {
    const slots = symbolSlots([
      { lato: 'retro', distanza: 0.3 },
      { lato: 'retro', distanza: 0.35 },
      { lato: 'retro', distanza: 0.4 },
      { lato: 'retro', distanza: 0.9 },
      { lato: 'fronte', distanza: 0.35 },
    ])
    expect(slots[0]).toBeCloseTo(0.35 - 0.17)
    expect(slots[1]).toBeCloseTo(0.35)
    expect(slots[2]).toBeCloseTo(0.35 + 0.17)
    expect(slots[3]).toBe(0.9)
    expect(slots[4]).toBe(0.35)
  })
})

describe('wall dimensions', () => {
  // A room corner: one wall along x at y = 0, one along y at x = 0, both 20 cm thick.
  const walls = [
    { type: 'wall', start: [0, 0], end: [6, 0], thickness: 0.2 },
    { type: 'wall', start: [0, 0], end: [0, 6], thickness: 0.2 },
  ] as unknown as AnyNode[]
  const faces = wallFacesOf(walls)

  test('nearest face, then the nearest one across it', () => {
    const dims = wallDimensions([2, 0.5], faces)
    expect(dims).toHaveLength(2)
    expect(dims[0]!.distance).toBeCloseTo(0.4)
    expect(dims[1]!.distance).toBeCloseTo(1.9)
  })

  test('far walls are not dimensioned', () => {
    expect(wallDimensions([20, 20], faces)).toEqual([])
  })
})

const texts = (g: FloorplanGeometry | null): string[] =>
  !g
    ? []
    : g.kind === 'group'
      ? g.children.flatMap(texts)
      : g.kind === 'text' || g.kind === 'dimension'
        ? [g.text]
        : []

describe('plan and DXF', () => {
  const faces = wallFacesOf([
    { type: 'wall', start: [0, 0], end: [6, 0], thickness: 0.2 },
  ] as unknown as AnyNode[])

  test('symbol, height and dimension only when asked', () => {
    const list = [
      { ...nuovoAllacciamento('acqua-fredda', 0.6), quota: true },
      { ...nuovoAllacciamento('elettrico-230', 0.2), quota: false },
    ]
    const plan = allacciamentiFloorplan(unit, list, faces)
    expect(plan?.kind === 'group' && plan.metadata?.dxfLayer).toBe('IMPIANTI')
    // Back of the unit at z = 0.65, the wall face at 0.1.
    expect(texts(plan)).toEqual(['AF', '230', 'h 500', '550'])
  })

  test('the export puts connections on their own layer, dimensions included', () => {
    const plan = allacciamentiFloorplan(unit, [nuovoAllacciamento('scarico', 0.6)], faces)
    const dxf = planToDxf([{ type: 'horeca:lavello', model: plan, annotations: null }])
    expect(dxf).toContain('IMPIANTI')
    // Every entity of the connection, the dimension's block included, is on IMPIANTI.
    const layers = [...dxf.matchAll(/\nAcDbEntity\n8\n([^\n]+)/g)].map((m) => m[1])
    expect(layers.filter((l) => l === 'QUOTE' || l === 'ATTREZZATURE')).toEqual([])
    expect(layers.filter((l) => l === 'IMPIANTI').length).toBeGreaterThan(4)
  })
})

describe('side dimensions', () => {
  // A room corner: back wall along x (face at y = 0.1), side wall along y (face at x = 0.1).
  const faces = wallFacesOf([
    { type: 'wall', start: [0, 0], end: [6, 0], thickness: 0.2 },
    { type: 'wall', start: [0, 0], end: [0, 6], thickness: 0.2 },
  ] as unknown as AnyNode[])

  test('one dimension from the wall behind, one chain from the side wall', () => {
    const dims = sideDimensions(
      [
        [2.3, 0.6],
        [2, 0.6],
        [2.15, 0.6],
      ],
      faces,
    )
    expect(dims.map((d) => d.kind)).toEqual(['dimension', 'dimension-string'])
    const depth = dims[0] as Extract<FloorplanGeometry, { kind: 'dimension' }>
    expect(depth.text).toBe('500')
    const chain = dims[1] as Extract<FloorplanGeometry, { kind: 'dimension-string' }>
    // Nearest the side wall first: 1,90 to the first point, then 15 cm steps.
    expect(chain.segments.map((s) => s.text)).toEqual(['1900', '150', '150'])
    // Room behind the points: the chain runs between them and the wall (towards −y).
    expect(chain.offsetNormal[1]).toBeLessThan(0)
  })
})

describe('summary', () => {
  test('counts per type and power per supply; missing power is reported, not guessed', () => {
    const nodes = [
      { metadata: withAllacciamenti({}, allacciamentiTipici('horeca:lavastoviglie', 0.6)) },
      { metadata: withAllacciamenti({}, allacciamentiTipici('horeca:banco-frigo', 1.5)) },
      { metadata: withAllacciamenti({}, [nuovoAllacciamento('gas')]) },
      { metadata: {} },
    ]
    const r = riepilogoImpianti(nodes)
    expect(r.conteggi.scarico).toBe(1)
    expect(r.conteggi['elettrico-400']).toBe(1)
    expect(r.potenze['elettrico-400']).toBe(6.5)
    expect(r.potenze['elettrico-230']).toBeCloseTo(0.4)
    expect(r.senzaPotenza).toBe(1)
  })
})
