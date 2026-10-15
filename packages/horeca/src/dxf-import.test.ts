import { describe, expect, test } from 'bun:test'
import { DxfWriter, point2d, point3d, Units } from '@tarikjabiri/dxf'
import { guessUnit, parseDxfRilievo, plainText } from './dxf-import'

/** A 4 × 3 m room drawn in millimetres, with a door swing, a label and two dimensions. */
function sampleDxf(units: Units | null = Units.Millimeters) {
  const dxf = new DxfWriter()
  if (units !== null) dxf.setUnits(units)
  dxf.addLayer('MURI', 7)
  dxf.addLayer('TESTI', 3)
  dxf.addLayer('QUOTE', 1)
  dxf.addLayer('SPENTO', -2)
  dxf.addRectangle(point2d(0, 3000), point2d(4000, 0), { layerName: 'MURI' })
  dxf.addArc(point3d(1000, 0, 0), 800, 0, 90, { layerName: 'MURI' })
  dxf.addLine(point3d(0, 0, 0), point3d(10, 10, 0), { layerName: 'SPENTO' })
  dxf.addText(point3d(2000, 1500, 0), 200, 'Cucina', { layerName: 'TESTI' })
  dxf.addAlignedDim(point3d(0, 0, 0), point3d(4000, 0, 0), { offset: -500, layerName: 'QUOTE' })
  dxf.addLinearDim(point3d(4000, 0, 0), point3d(4000, 3000, 0), {
    offset: 600,
    angle: 90,
    layerName: 'QUOTE',
  })
  return dxf.stringify()
}

describe('parseDxfRilievo', () => {
  const data = parseDxfRilievo(sampleDxf())

  test('reads the unit from the header', () => {
    expect(data.unit).toBe(0.001)
    expect(data.unitGuessed).toBe(false)
  })

  test('groups lines by layer and honours layers that are off', () => {
    const names = data.layers.map((l) => l.name)
    expect(names).toEqual(['MURI', 'QUOTE', 'SPENTO', 'TESTI'])
    const muri = data.layers.find((l) => l.name === 'MURI')!
    // 4 rectangle sides plus the arc split into short segments.
    expect(muri.segments.length / 4).toBeGreaterThan(8)
    expect(data.layers.find((l) => l.name === 'SPENTO')!.visible).toBe(false)
    expect(muri.visible).toBe(true)
  })

  test('centres the drawing and flips y into plan axes', () => {
    const muri = data.layers.find((l) => l.name === 'MURI')!.segments
    const xs = muri.filter((_, i) => i % 2 === 0)
    const ys = muri.filter((_, i) => i % 2 === 1)
    // The room straddles the centre.
    expect(Math.min(...xs)).toBeLessThan(0)
    expect(Math.max(...xs)).toBeGreaterThan(0)
    // Paper "up" (the room's top edge, y = 3000) is plan "up" (negative y).
    const text = data.texts[0]!
    expect(text.text).toBe('Cucina')
    expect(Math.min(...ys)).toBeLessThan(text.y)
  })

  test('linear and aligned dimensions keep their measured points', () => {
    expect(data.dimensions).toHaveLength(2)
    const lengths = data.dimensions
      .map((d) => Math.round(Math.hypot(d.lineB[0] - d.lineA[0], d.lineB[1] - d.lineA[1])))
      .sort((a, b) => a - b)
    expect(lengths).toEqual([3000, 4000])
    for (const d of data.dimensions) {
      // The dimension line is offset from the measured points.
      expect(Math.hypot(d.lineA[0] - d.a[0], d.lineA[1] - d.a[1])).toBeGreaterThan(100)
    }
  })

  test('guesses the unit when the file does not say it', () => {
    const guessed = parseDxfRilievo(sampleDxf(null))
    expect(guessed.unitGuessed).toBe(true)
    expect(guessed.unit).toBe(0.001)
    expect(guessUnit(12)).toBe(1)
    expect(guessUnit(850)).toBe(0.01)
  })

  test('rejects what is not a drawing', () => {
    expect(() => parseDxfRilievo('ciao')).toThrow()
  })
})

test('plainText strips MTEXT formatting', () => {
  expect(plainText('{\\fArial|b1;Banco}\\Pfrigo %%c50')).toBe('Banco frigo Ø50')
  expect(plainText('\\H2.5x;Altezza 150%%d')).toBe('Altezza 150°')
})
