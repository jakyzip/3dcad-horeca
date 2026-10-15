import { describe, expect, test } from 'bun:test'
import { parseString } from 'dxf'
import { cutWalls, layerForKind, planToDxf, zoneLabelEntries } from './dxf-export'
import { parseDxfRilievo } from './dxf-import'
import { pathToPolylines } from './svg-path'

describe('pathToPolylines', () => {
  test('lines, relative moves and closing', () => {
    const [a, b] = pathToPolylines('M0 0L1 0l0 1Z m2 0 h1 v1')
    expect(a).toEqual({
      points: [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      closed: true,
    })
    expect(b!.points).toEqual([
      [2, 0],
      [3, 0],
      [3, 1],
    ])
  })

  test('a quarter arc ends where it should and stays on the circle', () => {
    const [arc] = pathToPolylines('M1 0 A1 1 0 0 1 0 1')
    const last = arc!.points.at(-1)!
    expect(last[0]).toBeCloseTo(0)
    expect(last[1]).toBeCloseTo(1)
    for (const [x, y] of arc!.points) expect(Math.hypot(x, y)).toBeCloseTo(1, 5)
  })

  test('packed arc flags and cubic curves', () => {
    const [arc] = pathToPolylines('M1 0a1 1 0 011-1')
    expect(arc!.points.at(-1)).toEqual([2, -1])
    const [curve] = pathToPolylines('M0 0C0 1 1 1 1 0')
    expect(curve!.points.at(-1)).toEqual([1, 0])
    expect(curve!.points.length).toBeGreaterThan(8)
  })
})

describe('planToDxf', () => {
  const dxf = planToDxf([
    {
      type: 'wall',
      model: {
        kind: 'polygon',
        points: [
          [0, 0],
          [4, 0],
          [4, 0.2],
          [0, 0.2],
        ],
      },
      annotations: {
        kind: 'dimension',
        start: [0, 0],
        end: [4, 0],
        offsetNormal: [0, -1],
        offsetDistance: 0.5,
        extensionOvershoot: 0.05,
        text: '4,00',
      },
    },
    {
      type: 'door',
      model: { kind: 'path', d: 'M1 0.2 L1 1.1 A0.9 0.9 0 0 0 1.9 0.2' },
      annotations: null,
    },
    {
      type: 'horeca:banco-frigo',
      model: {
        kind: 'group',
        transform: { translate: [2, 2], rotate: Math.PI / 2 },
        children: [{ kind: 'text', x: 0, y: 0, text: 'BF-150', fontSize: 0.1 }],
      },
      annotations: null,
    },
  ])

  test('writes millimetres, layers and a dimension with its block', () => {
    const parsed = parseString(dxf)
    expect(parsed.header.insUnits).toBe(4)
    const layers = new Set(parsed.entities.map((e) => e.layer))
    for (const name of ['MURI', 'APERTURE', 'ATTREZZATURE', 'QUOTE'])
      expect(layers.has(name)).toBe(true)
    const dim = parsed.entities.find((e) => e.type === 'DIMENSION')!
    expect(parsed.blocks.some((b) => b.name === dim.block)).toBe(true)
  })

  test('reads back as the same plan', () => {
    const back = parseDxfRilievo(dxf)
    expect(back.unit).toBe(0.001)
    const [dim] = back.dimensions
    // 4 m long, half a metre off the wall, on the screen-up side (plan y smaller).
    expect(Math.hypot(dim!.lineB[0] - dim!.lineA[0], dim!.lineB[1] - dim!.lineA[1])).toBeCloseTo(
      4000,
    )
    expect(dim!.a[1] - dim!.lineA[1]).toBeCloseTo(500)
    const text = back.texts.find((t) => t.text === 'BF-150')!
    // Turned a quarter clockwise on screen, as in the plan.
    expect(text.angle).toBeCloseTo(Math.PI / 2)
    expect(text.height).toBeCloseTo(100)
  })
})

test('layers by kind', () => {
  expect(layerForKind('wall')).toBe('MURI')
  expect(layerForKind('horeca:tavolo')).toBe('ATTREZZATURE')
  expect(layerForKind('horeca:rilievo')).toBe('RILIEVO')
  expect(layerForKind('qualcosa')).toBe('ALTRO')
})

test('wall lines are cut where an opening masks them', () => {
  const wall = {
    points: [
      [0, -0.15],
      [6, -0.15],
    ] as [number, number][],
    closed: false,
  }
  const door: [number, number][] = [
    [1.05, 0.15],
    [1.95, 0.15],
    [1.95, -0.15],
    [1.05, -0.15],
  ]
  const parts = cutWalls([wall], [door])
  expect(parts).toHaveLength(2)
  expect(parts[0]![1][0]).toBeCloseTo(1.05, 2)
  expect(parts[1]![0][0]).toBeCloseTo(1.95, 2)
  // A line away from the opening stays whole.
  expect(
    cutWalls(
      [
        {
          points: [
            [0, 1],
            [6, 1],
          ],
          closed: false,
        },
      ],
      [door],
    ),
  ).toHaveLength(1)
})

test('rooms get their name and area', () => {
  const nodes = {
    z: {
      type: 'zone',
      parentId: 'lv',
      name: 'Laboratorio',
      polygon: [
        [0, 0],
        [6, 0],
        [6, 4],
        [0, 4],
      ],
    },
    other: {
      type: 'zone',
      parentId: 'altro',
      name: 'Altrove',
      polygon: [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
    },
  }
  const [entry, ...rest] = zoneLabelEntries(nodes, 'lv')
  expect(rest).toHaveLength(0)
  const texts = entry!.annotations!.kind === 'group' ? entry!.annotations!.children : []
  expect(texts.map((t) => (t.kind === 'text' ? t.text : ''))).toEqual(['Laboratorio', '24,00 m²'])
  expect(texts[0]!.kind === 'text' && [texts[0]!.x, texts[0]!.y]).toEqual([3, 2])
})
