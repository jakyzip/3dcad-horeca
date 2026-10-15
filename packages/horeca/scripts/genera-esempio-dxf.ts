/**
 * Writes `docs/progetto/esempio-rilievo.dxf`: an invented 7 × 5 m gelato lab drawn in millimetres
 * (walls with thickness, a door, a window, labels and dimensions on separate layers), to try the
 * survey import without a real drawing.
 *
 * Run from the repository root: `bun packages/horeca/scripts/genera-esempio-dxf.ts`
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DxfWriter, point2d, point3d, Units } from '@tarikjabiri/dxf'

const dxf = new DxfWriter()
dxf.setUnits(Units.Millimeters)
dxf.addLayer('MURI', 7)
dxf.addLayer('APERTURE', 4)
dxf.addLayer('TESTI', 3)
dxf.addLayer('QUOTE', 1)
dxf.addLayer('IMPIANTI', 6)

const W = 7000
const H = 5000
const T = 300
const muri = { layerName: 'MURI' }
// Outer and inner outline, with a 900 mm door gap in the bottom wall from x = 1000.
const outer: Array<[number, number]> = [
  [1000, -T],
  [-T, -T],
  [-T, H + T],
  [W + T, H + T],
  [W + T, -T],
  [1900, -T],
]
const inner: Array<[number, number]> = [
  [1000, 0],
  [0, 0],
  [0, H],
  [W, H],
  [W, 0],
  [1900, 0],
]
for (const outline of [outer, inner])
  dxf.addLWPolyline(
    outline.map(([x, y]) => ({ point: point2d(x, y) })),
    muri,
  )
dxf.addLine(point3d(1000, -T, 0), point3d(1000, 0, 0), muri)
dxf.addLine(point3d(1900, -T, 0), point3d(1900, 0, 0), muri)

// Door leaf and swing.
const aperture = { layerName: 'APERTURE' }
dxf.addLine(point3d(1000, 0, 0), point3d(1000, 900, 0), aperture)
dxf.addArc(point3d(1000, 0, 0), 900, 0, 90, aperture)
// Window in the top wall: two thin lines across the wall.
dxf.addLine(point3d(3000, H + 100, 0), point3d(4500, H + 100, 0), aperture)
dxf.addLine(point3d(3000, H + 200, 0), point3d(4500, H + 200, 0), aperture)

const testi = { layerName: 'TESTI' }
dxf.addText(point3d(2600, 2600, 0), 250, 'LABORATORIO GELATERIA', testi)
dxf.addText(point3d(2600, 2200, 0), 150, 'h = 300 cm', testi)
dxf.addText(point3d(1050, 450, 0), 120, 'P 90x210', testi)
dxf.addText(point3d(3300, H + 400, 0), 120, 'F 150x120', testi)

// Floor drain and water point.
const impianti = { layerName: 'IMPIANTI' }
dxf.addCircle(point3d(5200, 1500, 0), 120, impianti)
dxf.addText(point3d(5400, 1450, 0), 100, 'piletta', impianti)
dxf.addCircle(point3d(6800, 3500, 0), 60, impianti)
dxf.addText(point3d(6100, 3700, 0), 100, 'acqua', impianti)

const quote = { layerName: 'QUOTE' }
// Linear dimensions only: the writer misplaces the dimension line of its aligned ones.
dxf.addLinearDim(point3d(0, H, 0), point3d(W, H, 0), { offset: 900, ...quote })
dxf.addLinearDim(point3d(W, 0, 0), point3d(W, H, 0), { offset: 900, angle: 90, ...quote })
dxf.addLinearDim(point3d(0, 0, 0), point3d(1000, 0, 0), { offset: -800, ...quote })
dxf.addLinearDim(point3d(1000, 0, 0), point3d(1900, 0, 0), { offset: -800, ...quote })

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
writeFileSync(join(root, 'docs/progetto/esempio-rilievo.dxf'), dxf.stringify())
console.log('docs/progetto/esempio-rilievo.dxf')
