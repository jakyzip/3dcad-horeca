import { describe, expect, test } from 'bun:test'
import type { FloorplanGeometry } from '@pascal-app/core'
import {
  cartiglio,
  fit,
  INTESTAZIONE_VUOTA,
  rotatedBounds,
  scalaPerFinestra,
  tabella,
  tavolaPages,
} from './tavola'

const texts = (gs: readonly FloorplanGeometry[]): string[] =>
  gs.flatMap((g) => (g.kind === 'text' ? [g.text] : g.kind === 'group' ? texts(g.children) : []))

// A 10 × 8 m room.
const room: FloorplanGeometry = {
  kind: 'polygon',
  points: [
    [0, 0],
    [10, 0],
    [10, 8],
    [0, 8],
  ],
}

const info = {
  progetto: 'Gelateria Rossi',
  cliente: 'Rossi srl',
  data: '15/10/2026',
  revisione: 2,
  piano: 'Piano terra',
}

describe('plan on paper', () => {
  test('bounds, also turned by 90°', () => {
    expect(rotatedBounds([room], 0)).toEqual({ x: 0, y: 0, width: 10, height: 8 })
    const turned = rotatedBounds([room], 90)!
    expect(turned.width).toBeCloseTo(8)
    expect(turned.height).toBeCloseTo(10)
  })

  test('the largest usual scale that fits', () => {
    // 10 m at 1:50 is 7,87 in.
    expect(scalaPerFinestra(10, 8, { x: 0, y: 0, w: 10.5, h: 9 })).toBe(50)
    expect(scalaPerFinestra(10, 8, { x: 0, y: 0, w: 6, h: 6 })).toBe(75)
    expect(scalaPerFinestra(2, 1, { x: 0, y: 0, w: 10, h: 10 })).toBe(20)
  })
})

describe('title block and tables', () => {
  test('the title block names company, customer, project, date, scale, revision and sheet', () => {
    const out = texts(
      cartiglio(
        { x: 0, y: 0, w: 15, h: 1.3 },
        { ...INTESTAZIONE_VUOTA, nome: 'Donà Impianti', piva: '01234567890' },
        info,
        50,
        '1/1',
      ),
    )
    for (const t of [
      'Donà Impianti',
      'P.IVA 01234567890',
      'Rossi srl',
      'Gelateria Rossi',
      '15/10/2026',
      '1:50',
      '2',
      'Piano terra',
      '1/1',
    ])
      expect(out).toContain(t)
  })

  test('a table says how many rows did not fit instead of dropping them', () => {
    const rows = Array.from({ length: 40 }, (_, i) => [`C${i}`, `Articolo ${i}`, '1'])
    const { geometry, used } = tabella(
      { x: 0, y: 0, w: 5, h: 3 },
      'Attrezzature',
      [
        { label: 'Codice', weight: 2 },
        { label: 'Articolo', weight: 5 },
        { label: 'Q.tà', weight: 1, align: 'end' },
      ],
      rows,
    )
    expect(used).toBeLessThanOrEqual(3 + 1e-9)
    expect(texts(geometry).at(-1)).toMatch(/^… e altre \d+ righe$/)
  })

  test('long texts are cut with an ellipsis', () => {
    expect(fit('Abbattitore di temperatura 5 teglie', 1, 0.1)).toBe('Abbattitore di te…')
    expect(fit('Corto', 1, 0.1)).toBe('Corto')
  })
})

describe('sheets', () => {
  const contenuto = {
    pianta: { model: [room], annotations: [], rotationDeg: 0 },
    renders: [{ dataUrl: 'data:image/png;base64,AA==', aspect: 16 / 9 }],
    elenco: Array.from({ length: 60 }, (_, i) => ({
      item_id: '',
      code: `A${i}`,
      name: `Articolo ${i}`,
      quantity: 1,
    })),
    impianti: null,
  }

  test('A3: one sheet, the plan at a stated scale, the render and the list on the side', () => {
    const [page, ...rest] = tavolaPages('A3', contenuto, INTESTAZIONE_VUOTA, info)
    expect(rest).toHaveLength(0)
    expect(page!.widthIn).toBeCloseTo(16.535)
    expect(page!.windows).toHaveLength(1)
    expect(texts(page!.plate)).toContain('1:50')
    expect(page!.overlay.some((g) => g.kind === 'image')).toBe(true)
  })

  test('A4: plan, render, then the list over as many pages as it needs, numbered', () => {
    const pages = tavolaPages('A4', contenuto, INTESTAZIONE_VUOTA, info)
    expect(pages.map((p) => p.title).slice(0, 3)).toEqual(['Pianta', 'Vista 3D', 'Attrezzature'])
    expect(pages.length).toBeGreaterThan(3)
    expect(texts(pages.at(-1)!.plate)).toContain(`${pages.length}/${pages.length}`)
  })

  test('more renders: A3 adds a sheet for each after the first, A4 a page each', () => {
    const r = { dataUrl: 'data:image/png;base64,AA==', aspect: 4 / 3 }
    const tre = { ...contenuto, renders: [r, r, r] }
    const a3 = tavolaPages('A3', tre, INTESTAZIONE_VUOTA, info)
    expect(a3.map((p) => p.title)).toEqual([info.progetto, 'Vista 3D', 'Vista 3D'])
    expect(texts(a3[0]!.plate)).toContain('1/3')
    expect(texts(a3[2]!.plate)).toContain('3/3')
    const a4 = tavolaPages('A4', tre, INTESTAZIONE_VUOTA, info)
    expect(a4.map((p) => p.title).slice(0, 4)).toEqual([
      'Pianta',
      'Vista 3D',
      'Vista 3D',
      'Vista 3D',
    ])
  })

  test('no render: the A3 sheet keeps the plan and the list only', () => {
    const [page, ...rest] = tavolaPages(
      'A3',
      { ...contenuto, renders: [] },
      INTESTAZIONE_VUOTA,
      info,
    )
    expect(rest).toHaveLength(0)
    expect(page!.overlay.some((g) => g.kind === 'image')).toBe(false)
    expect(texts(page!.plate)).toContain('1/1')
  })
})
