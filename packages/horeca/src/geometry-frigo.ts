import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  type Material,
  Mesh,
  MeshStandardMaterial,
} from 'three'
import { addBox, GASKET, PANEL_WHITE, STAINLESS, STAINLESS_DARK } from './geometry-base'
import type { EquipmentNode } from './schema'

/**
 * The refrigeration plant: condensing unit, unit cooler, compressor rack and control panel, drawn
 * as they look on a site: painted casings, round fan guards, finned coils, copper service valves.
 * Local frame as everywhere: x across the front, z towards the user (front at +depth/2), y up from
 * the unit's underside.
 */

const CASING = { color: '#d4d6d9', metalness: 0.3, roughness: 0.5 }
const FINS = { color: '#a3a8ae', metalness: 0.6, roughness: 0.4 }
const COPPER = { color: '#b87333', metalness: 0.9, roughness: 0.3 }
const COMPRESSOR = { color: '#3f4a52', metalness: 0.4, roughness: 0.5 }
const INSULATION = { color: '#1f2226', metalness: 0, roughness: 0.9 }
const DISPLAY = { color: '#1d2430', metalness: 0.3, roughness: 0.25 }
const LED = { color: '#22c55e', emissive: '#22c55e', emissiveIntensity: 0.8 }

type Unit = Pick<EquipmentNode, 'width' | 'depth' | 'height'>

function cylinder(
  group: Group,
  radius: number,
  length: number,
  material: Material,
  name: string,
  at: { x?: number; y: number; z?: number },
  axis: 'x' | 'y' | 'z',
) {
  const mesh = new Mesh(new CylinderGeometry(radius, radius, length, 32), material)
  if (axis === 'x') mesh.rotation.z = Math.PI / 2
  if (axis === 'z') mesh.rotation.x = Math.PI / 2
  mesh.position.set(at.x ?? 0, at.y, at.z ?? 0)
  mesh.name = name
  mesh.castShadow = true
  group.add(mesh)
  return mesh
}

/**
 * A fan behind its guard, on a face looking along +z (or -z with `facing` -1): the dark opening,
 * a guard ring, spokes and the motor hub.
 */
function fan(
  group: Group,
  m: { dark: Material; steel: Material },
  x: number,
  y: number,
  z: number,
  diameter: number,
  facing: 1 | -1,
) {
  const r = diameter / 2
  cylinder(group, r, 0.01, m.dark, 'ventola', { x, y, z: z + facing * 0.005 }, 'z')
  const ring = new Mesh(new CylinderGeometry(r + 0.012, r + 0.012, 0.014, 40, 1, true), m.steel)
  ring.rotation.x = Math.PI / 2
  ring.position.set(x, y, z + facing * 0.007)
  ring.name = 'ventola-griglia'
  group.add(ring)
  for (let i = 0; i < 4; i++) {
    const spoke = new Mesh(new BoxGeometry(diameter, 0.008, 0.006), m.steel)
    spoke.rotation.z = (i * Math.PI) / 4
    spoke.position.set(x, y, z + facing * 0.014)
    spoke.name = 'ventola-griglia'
    group.add(spoke)
  }
  cylinder(group, r * 0.22, 0.03, m.steel, 'ventola-mozzo', { x, y, z: z + facing * 0.016 }, 'z')
}

/** Vertical fins across a face of the coil, `facing` +1 for the front, -1 for the back. */
function batteria(group: Group, material: Material, W: number, y: number, h: number, z: number) {
  const fins = Math.max(8, Math.round(W / 0.02))
  for (let i = 0; i < fins; i++) {
    const x = -W / 2 + (W * (i + 0.5)) / fins
    addBox(group, { w: 0.003, h, d: 0.02, x, y, z }, material, 'batteria')
  }
}

/** Fans along the width: one per `pitch` metres, as big as the face allows. */
function fanRow(W: number, H: number, pitch: number) {
  const count = Math.max(1, Math.round(W / pitch))
  const diameter = Math.min(H * 0.78, (W / count) * 0.82)
  return { count, diameter, x: (i: number) => -W / 2 + (W * (i + 0.5)) / count }
}

/**
 * Condensing unit: a painted casing on rubber feet, the fans blowing out of the front, the
 * condenser coil across the back, and the compressor bay on the right with louvres and the two
 * copper service valves the lineset joins.
 */
export function buildMotocondensanteGeometry(node: Unit): Group {
  const group = new Group()
  const { width: W, depth: D, height: H } = node
  const m = {
    casing: new MeshStandardMaterial(CASING),
    dark: new MeshStandardMaterial(GASKET),
    steel: new MeshStandardMaterial(STAINLESS_DARK),
    fins: new MeshStandardMaterial(FINS),
    copper: new MeshStandardMaterial(COPPER),
  }
  const foot = 0.05
  for (const x of [-W / 2 + 0.06, W / 2 - 0.06])
    addBox(group, { w: 0.08, h: foot, d: D - 0.04, x, y: foot / 2 }, m.dark, 'moto-piede')
  const body = H - foot
  addBox(group, { w: W, h: body, d: D, y: foot + body / 2 }, m.casing, 'moto-body')
  // The fan section takes the left part; the compressor bay the right quarter.
  const bay = Math.min(0.35, W * 0.28)
  const fanW = W - bay
  const fans = fanRow(fanW, body, 0.6)
  for (let i = 0; i < fans.count; i++)
    fan(group, m, -W / 2 + fans.x(i) + fanW / 2, foot + body / 2, D / 2, fans.diameter, 1)
  batteria(group, m.fins, W - 0.04, foot + body / 2, body - 0.06, -D / 2 - 0.01)
  // Louvres on the compressor bay.
  const louvres = Math.max(4, Math.round(body / 0.06))
  for (let i = 0; i < louvres; i++) {
    const y = foot + 0.05 + ((body - 0.1) * (i + 0.5)) / louvres
    addBox(
      group,
      { w: bay - 0.06, h: 0.012, d: 0.012, x: W / 2 - bay / 2, y, z: D / 2 + 0.006 },
      m.steel,
      'moto-feritoie',
    )
  }
  // Service valves on the right side, low down.
  for (const [i, r] of [0.012, 0.018].entries())
    cylinder(
      group,
      r,
      0.06,
      m.copper,
      'moto-rubinetto',
      { x: W / 2 + 0.03, y: foot + body * 0.18, z: D * (0.05 + i * 0.2) },
      'x',
    )
  return group
}

/**
 * Unit cooler hung under the ceiling: a white casing, the fans on the front blowing into the
 * room, the finned coil at the back, a drip tray underneath and the connections on the right.
 */
export function buildEvaporatoreGeometry(node: Unit): Group {
  const group = new Group()
  const { width: W, depth: D, height: H } = node
  const m = {
    casing: new MeshStandardMaterial(PANEL_WHITE),
    dark: new MeshStandardMaterial(GASKET),
    steel: new MeshStandardMaterial(STAINLESS_DARK),
    fins: new MeshStandardMaterial(FINS),
    copper: new MeshStandardMaterial(COPPER),
  }
  const tray = Math.min(0.05, H * 0.15)
  addBox(group, { w: W, h: H - tray, d: D, y: tray + (H - tray) / 2 }, m.casing, 'evap-body')
  addBox(group, { w: W - 0.02, h: tray, d: D - 0.04, y: tray / 2 }, m.steel, 'evap-bacinella')
  cylinder(group, 0.015, 0.06, m.dark, 'evap-scarico', { x: -W / 2 + 0.08, y: -0.03, z: 0 }, 'y')
  const fans = fanRow(W, H - tray, 0.45)
  for (let i = 0; i < fans.count; i++)
    fan(group, m, fans.x(i), tray + (H - tray) / 2, D / 2, fans.diameter, 1)
  batteria(group, m.fins, W - 0.04, tray + (H - tray) / 2, H - tray - 0.04, -D / 2 - 0.01)
  for (const [i, r] of [0.01, 0.016].entries())
    cylinder(
      group,
      r,
      0.08,
      m.copper,
      'evap-attacco',
      { x: W / 2 + 0.04, y: H * 0.55, z: -D * (0.1 + i * 0.15) },
      'x',
    )
  return group
}

/** How many compressors a rack of this width carries, and where. */
export function compressoriDi(W: number) {
  const count = Math.min(6, Math.max(2, Math.round((W - 0.4) / 0.55)))
  const span = W - 0.5
  return { count, x: (i: number) => -W / 2 + 0.1 + (span * (i + 0.5)) / count }
}

/**
 * Compressor rack: a steel frame, compressors in a row on the base, the liquid receiver behind
 * them, the insulated suction and the liquid manifolds along the top, and the electrical panel
 * at the right end. The linesets to the cold rooms leave from the top of the manifolds.
 */
export function buildCentraleFrigoGeometry(node: Unit): Group {
  const group = new Group()
  const { width: W, depth: D, height: H } = node
  const m = {
    frame: new MeshStandardMaterial(STAINLESS_DARK),
    compressor: new MeshStandardMaterial(COMPRESSOR),
    copper: new MeshStandardMaterial(COPPER),
    insulation: new MeshStandardMaterial(INSULATION),
    panel: new MeshStandardMaterial(CASING),
    display: new MeshStandardMaterial(DISPLAY),
    led: new MeshStandardMaterial(LED),
    steel: new MeshStandardMaterial(STAINLESS),
  }
  const t = 0.05
  // Base rails and the upright frame.
  // The base frame carries the unit's footprint: its front rail is the body the plugin measures.
  addBox(group, { w: W, h: t, d: t, y: t / 2, z: D / 2 - t / 2 }, m.frame, 'centrale-body')
  addBox(group, { w: W, h: t, d: t, y: t / 2, z: -D / 2 + t / 2 }, m.frame, 'centrale-telaio')
  for (const x of [-W / 2 + t / 2, W / 2 - t / 2])
    addBox(group, { w: t, h: t, d: D, x, y: t / 2 }, m.frame, 'centrale-telaio')
  for (const x of [-W / 2 + t / 2, W / 2 - t / 2])
    for (const z of [-D / 2 + t / 2, D / 2 - t / 2])
      addBox(group, { w: t, h: H, d: t, x, y: H / 2, z }, m.frame, 'centrale-telaio')
  for (const z of [-D / 2 + t / 2, D / 2 - t / 2])
    addBox(group, { w: W, h: t, d: t, y: H - t / 2, z }, m.frame, 'centrale-telaio')
  // Compressors on a deck plate.
  addBox(group, { w: W - 2 * t, h: 0.02, d: D - 2 * t, y: t + 0.01 }, m.frame, 'centrale-piano')
  const comp = compressoriDi(W)
  const r = Math.min(0.16, D * 0.2, (W - 0.5) / comp.count / 2.6)
  for (let i = 0; i < comp.count; i++) {
    const x = comp.x(i)
    cylinder(
      group,
      r,
      D * 0.55,
      m.compressor,
      'centrale-compressore',
      { x, y: t + 0.02 + r, z: D * 0.08 },
      'z',
    )
    addBox(
      group,
      { w: r * 1.6, h: r * 0.9, d: r * 1.3, x, y: t + 0.02 + 2 * r + r * 0.45, z: D * 0.08 },
      m.compressor,
      'centrale-testata',
    )
    cylinder(
      group,
      0.014,
      H - (t + 0.02 + 2.9 * r) - 0.12,
      m.copper,
      'centrale-mandata',
      { x: x + r * 0.5, y: (H - 0.12 + t + 0.02 + 2.9 * r) / 2, z: -D / 2 + 0.16 },
      'y',
    )
  }
  // Liquid receiver at the back, low.
  cylinder(
    group,
    Math.min(0.1, D * 0.12),
    (W - 0.5) * 0.8,
    m.steel,
    'centrale-ricevitore',
    { x: -0.2, y: t + 0.14, z: -D / 2 + 0.14 },
    'x',
  )
  // Manifolds along the top: insulated suction, bare liquid.
  cylinder(
    group,
    0.04,
    W - 0.5,
    m.insulation,
    'centrale-collettore',
    { x: -0.2, y: H - 0.12, z: -D / 2 + 0.16 },
    'x',
  )
  cylinder(
    group,
    0.015,
    W - 0.5,
    m.copper,
    'centrale-collettore',
    { x: -0.2, y: H - 0.2, z: -D / 2 + 0.26 },
    'x',
  )
  // Electrical panel at the right end.
  const panelW = 0.4
  addBox(
    group,
    { w: panelW, h: H * 0.75, d: 0.25, x: W / 2 - panelW / 2 - t, y: H * 0.5, z: D / 2 - 0.15 },
    m.panel,
    'centrale-quadro',
  )
  addBox(
    group,
    { w: 0.12, h: 0.07, d: 0.01, x: W / 2 - panelW / 2 - t, y: H * 0.7, z: D / 2 - 0.02 },
    m.display,
    'centrale-display',
  )
  addBox(
    group,
    { w: 0.02, h: 0.02, d: 0.01, x: W / 2 - panelW / 2 - t + 0.09, y: H * 0.7, z: D / 2 - 0.02 },
    m.led,
    'centrale-led',
  )
  return group
}

/** Refrigeration control panel on the wall: a box with its door, the controller and a lock. */
export function buildQuadroFrigoGeometry(node: Unit): Group {
  const group = new Group()
  const { width: W, depth: D, height: H } = node
  const panel = new MeshStandardMaterial(CASING)
  const display = new MeshStandardMaterial(DISPLAY)
  const led = new MeshStandardMaterial(LED)
  const dark = new MeshStandardMaterial(GASKET)
  addBox(group, { w: W, h: H, d: D - 0.01, y: H / 2, z: -0.005 }, panel, 'quadro-body')
  addBox(
    group,
    { w: W - 0.02, h: H - 0.02, d: 0.01, y: H / 2, z: D / 2 - 0.005 },
    panel,
    'quadro-anta',
  )
  addBox(
    group,
    { w: W * 0.45, h: H * 0.16, d: 0.008, y: H * 0.7, z: D / 2 + 0.004 },
    display,
    'quadro-display',
  )
  for (const [i, x] of [-0.06, 0, 0.06].entries())
    addBox(
      group,
      { w: 0.025, h: 0.025, d: 0.008, x: x * W * 2, y: H * 0.5, z: D / 2 + 0.004 },
      i === 1 ? led : dark,
      'quadro-tasto',
    )
  cylinder(
    group,
    0.012,
    0.012,
    dark,
    'quadro-serratura',
    { x: W / 2 - 0.05, y: H * 0.5, z: D / 2 + 0.006 },
    'z',
  )
  return group
}
