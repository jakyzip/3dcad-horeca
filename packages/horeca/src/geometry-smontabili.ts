import { CylinderGeometry, Group, type Material, Mesh, MeshStandardMaterial } from 'three'
import { addBox, GASKET, STAINLESS, STAINLESS_DARK } from './geometry-base'
import type { EquipmentNode, Vasche } from './schema'
import { pianoLavello, type Riquadro } from './smontabili'

/**
 * The open stainless line (tables and sinks on legs), drawn as it is built: square 40 × 40 legs
 * on adjustable feet, channel rails under the worktop, a 40 mm worktop edge, a welded upstand
 * at the back and, low down, a shelf or rails. Local frame as everywhere: x across the front,
 * z towards the user (front at +depth/2), y up from the floor.
 */

/** What these builders read of a unit: its size and the line's options. */
type Unit = Pick<EquipmentNode, 'width' | 'depth' | 'height'> &
  Partial<
    Pick<
      EquipmentNode,
      'alzatina' | 'ripiano' | 'vasche' | 'vascaLarghezza' | 'vascaProfondita' | 'vascaAltezza'
    >
  >

const TOP = 0.04
const LEG = 0.04
const FOOT = 0.03
/** Legs stand this far in from the outline, and this much more at the back behind an upstand. */
const INSET = 0.01
const ALZATINA_RIENTRO = 0.05
const ALZATINA_H = 0.1
const ALZATINA_T = 0.012
const BASSO = 0.2
const SHEET = 0.008

function materials() {
  return {
    steel: new MeshStandardMaterial(STAINLESS),
    dark: new MeshStandardMaterial(STAINLESS_DARK),
    rubber: new MeshStandardMaterial(GASKET),
  }
}

function foot(group: Group, material: Material, x: number, z: number) {
  const mesh = new Mesh(new CylinderGeometry(0.017, 0.02, FOOT, 16), material)
  mesh.position.set(x, FOOT / 2, z)
  mesh.name = 'giorno-foot'
  mesh.castShadow = true
  group.add(mesh)
}

/** Legs, feet, rails under the top, upstand, and the shelf or the low rails. */
function telaio(
  group: Group,
  node: Unit,
  m: ReturnType<typeof materials>,
  options: { ripiano: boolean },
) {
  const { width: W, depth: D, height: H } = node
  const alzatina = node.alzatina === true
  const x = W / 2 - LEG / 2 - INSET
  const front = D / 2 - LEG / 2 - INSET
  const back = -D / 2 + LEG / 2 + INSET + (alzatina ? ALZATINA_RIENTRO : 0)
  const legH = H - TOP - FOOT
  for (const lx of [-x, x]) {
    for (const lz of [front, back]) {
      addBox(
        group,
        { w: LEG, h: legH, d: LEG, x: lx, y: FOOT + legH / 2, z: lz },
        m.steel,
        'giorno-leg',
      )
      foot(group, m.rubber, lx, lz)
    }
    // Channel rail under the worktop, bolted to the legs of each side.
    addBox(
      group,
      { w: 0.02, h: 0.07, d: D - 2 * INSET - 0.02, x: lx, y: H - TOP - 0.035 },
      m.steel,
      'giorno-rail-top',
    )
  }
  const span = front - back + LEG
  const centreZ = (front + back) / 2
  if (options.ripiano) {
    addBox(
      group,
      { w: 2 * x + LEG, h: 0.03, d: span, y: BASSO, z: centreZ },
      m.steel,
      'giorno-shelf',
    )
  } else {
    for (const lx of [-x, x])
      addBox(
        group,
        { w: 0.03, h: 0.03, d: span - LEG, x: lx, y: BASSO, z: centreZ },
        m.steel,
        'giorno-rail',
      )
    addBox(group, { w: 2 * x - LEG, h: 0.03, d: 0.03, y: BASSO, z: back }, m.steel, 'giorno-rail')
  }
  if (alzatina) {
    addBox(
      group,
      { w: W, h: ALZATINA_H, d: ALZATINA_T, y: H + ALZATINA_H / 2, z: -D / 2 + ALZATINA_T / 2 },
      m.steel,
      'giorno-alzatina',
    )
  }
}

/** Stainless table on legs: plain, with upstand (A), shelf (R) or both (AR). */
export function buildTavoloGeometry(node: Unit): Group {
  const group = new Group()
  const { width: W, depth: D, height: H } = node
  const m = materials()
  addBox(group, { w: W, h: TOP, d: D, y: H - TOP / 2 }, m.steel, 'tavolo-body')
  telaio(group, node, m, { ripiano: node.ripiano !== false })
  return group
}

/**
 * The worktop around the openings, as strips: one in front of them, one behind, and the pieces
 * between them along the width. The openings share their depth band (see `pianoLavello`).
 */
export function pianoForato(
  group: Group,
  W: number,
  D: number,
  y: number,
  openings: readonly Riquadro[],
  material: Material,
  name: string,
) {
  if (!openings.length) {
    addBox(group, { w: W, h: TOP, d: D, y }, material, name)
    return
  }
  const { z, d } = openings[0]!
  const frontD = D / 2 - (z + d / 2)
  const backD = z - d / 2 + D / 2
  addBox(group, { w: W, h: TOP, d: frontD, y, z: D / 2 - frontD / 2 }, material, name)
  addBox(group, { w: W, h: TOP, d: backD, y, z: -D / 2 + backD / 2 }, material, name)
  let from = -W / 2
  for (const o of [...openings].sort((a, b) => a.x - b.x)) {
    const to = o.x - o.w / 2
    if (to - from > 1e-4)
      addBox(group, { w: to - from, h: TOP, d, x: (from + to) / 2, y, z }, material, name)
    from = o.x + o.w / 2
  }
  if (W / 2 - from > 1e-4)
    addBox(group, { w: W / 2 - from, h: TOP, d, x: (from + W / 2) / 2, y, z }, material, name)
}

/** A sunken bowl under an opening, rim at `top`: four walls and a floor, the drain, the overflow. */
export function vasca(
  group: Group,
  o: Riquadro,
  top: number,
  depth: number,
  m: { steel: Material; dark: Material },
) {
  const floor = top - depth
  const wallY = floor + depth / 2
  addBox(group, { w: o.w, h: SHEET, d: o.d, x: o.x, y: floor, z: o.z }, m.steel, 'vasca-fondo')
  for (const side of [-1, 1]) {
    addBox(
      group,
      { w: SHEET, h: depth, d: o.d, x: o.x + (side * (o.w - SHEET)) / 2, y: wallY, z: o.z },
      m.steel,
      'vasca-parete',
    )
    addBox(
      group,
      { w: o.w, h: depth, d: SHEET, x: o.x, y: wallY, z: o.z + (side * (o.d - SHEET)) / 2 },
      m.steel,
      'vasca-parete',
    )
  }
  const drain = new Mesh(new CylinderGeometry(0.035, 0.035, 0.006, 24), m.dark)
  drain.position.set(o.x, floor + SHEET, o.z)
  drain.name = 'vasca-piletta'
  group.add(drain)
  // Overflow standpipe in the back left corner, as drawn in the price list.
  const pipe = new Mesh(new CylinderGeometry(0.018, 0.018, depth - 0.02, 16), m.dark)
  pipe.position.set(o.x - o.w / 2 + 0.05, floor + (depth - 0.02) / 2, o.z - o.d / 2 + 0.05)
  pipe.name = 'vasca-troppopieno'
  pipe.castShadow = true
  group.add(pipe)
}

/** Ribs pressed into the worktop beside the bowl, along the depth, sloping water to the bowl. */
export function gocciolatoio(group: Group, r: Riquadro, top: number, material: Material) {
  const ribs = Math.max(3, Math.round(r.w / 0.025))
  for (let i = 0; i < ribs; i++) {
    const x = r.x - r.w / 2 + (r.w * (i + 0.5)) / ribs
    addBox(
      group,
      { w: 0.006, h: 0.004, d: r.d - 0.04, x, y: top + 0.002, z: r.z },
      material,
      'gocciolatoio',
    )
  }
}

export function bowlsOf(node: Unit) {
  return pianoLavello(node.width, node.depth, (node.vasche ?? '1 vasca') as Vasche, {
    w: node.vascaLarghezza ?? 0.5,
    d: node.vascaProfondita ?? 0.4,
  })
}

/** Sink on legs: worktop with its bowls (and drainer), the open frame with rails low down. */
export function buildLavelloAGiorno(node: Unit): Group {
  const group = new Group()
  const { width: W, depth: D, height: H } = node
  const m = materials()
  const { bowls, drainer } = bowlsOf(node)
  pianoForato(group, W, D, H - TOP / 2, bowls, m.steel, 'lavello-top')
  const depth = Math.min(node.vascaAltezza ?? 0.25, H - BASSO - 0.1)
  for (const b of bowls) vasca(group, b, H, depth, m)
  if (drainer) gocciolatoio(group, drainer, H, m.dark)
  telaio(group, node, m, { ripiano: false })
  return group
}
