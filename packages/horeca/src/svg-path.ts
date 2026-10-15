/**
 * SVG path data (`d`) → polylines, for the DXF export: every command (absolute and relative M L H
 * V C S Q T A Z), curves split into short straight steps. Points stay in the path's own units.
 */

export type Polyline = { points: Array<[number, number]>; closed: boolean }

const STEPS = 16

const TOKEN = /([MLHVCSQTAZmlhvcsqtaz])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g

/** Commands as `{ cmd }`, numbers kept as written so packed arc flags ("011") can be split. */
function tokenize(d: string): Array<{ cmd: string } | string> {
  const out: Array<{ cmd: string } | string> = []
  for (const m of d.matchAll(TOKEN)) out.push(m[1] ? { cmd: m[1] } : m[2]!)
  return out
}

export function pathToPolylines(d: string): Polyline[] {
  const tokens = tokenize(d)
  const lines: Polyline[] = []
  // Assigned inside `lineTo`: the cast keeps TypeScript from narrowing it to null.
  let current = null as Polyline | null
  let x = 0
  let y = 0
  let startX = 0
  let startY = 0
  // Last control point, for the smooth curve commands S and T.
  let lastCtrl: [number, number] | null = null
  let lastCmd = ''
  let i = 0
  let cmd = ''

  const num = () => {
    const t = tokens[i++]
    return typeof t === 'string' ? Number(t) : Number.NaN
  }
  // Arc flags are single digits and may be packed with what follows ("011-1"): split them off.
  const flag = () => {
    const t = tokens[i]
    if (typeof t !== 'string') return 0
    if (t.length > 1 && /^[01]\d/.test(t)) {
      tokens[i] = t.slice(1)
      return Number(t[0])
    }
    i++
    return Number(t) ? 1 : 0
  }
  const lineTo = (nx: number, ny: number) => {
    if (!current) {
      current = { points: [[x, y]], closed: false }
      lines.push(current)
    }
    current.points.push([nx, ny])
    x = nx
    y = ny
  }

  while (i < tokens.length) {
    const t = tokens[i]
    if (typeof t === 'object') {
      cmd = t.cmd
      i++
    } else if (!cmd) {
      i++
      continue
    }
    const rel = cmd === cmd.toLowerCase()
    const ox = rel ? x : 0
    const oy = rel ? y : 0
    const C = cmd.toUpperCase()
    if (C === 'Z') {
      if (current) {
        current.closed = true
        current = null
      }
      x = startX
      y = startY
      lastCtrl = null
      lastCmd = C
      continue
    }
    if (C === 'M') {
      x = ox + num()
      y = oy + num()
      startX = x
      startY = y
      current = null
      // Further pairs after a moveto are linetos.
      cmd = rel ? 'l' : 'L'
      lastCtrl = null
      lastCmd = 'M'
      continue
    }
    if (C === 'L') lineTo(ox + num(), oy + num())
    else if (C === 'H') lineTo(ox + num(), y)
    else if (C === 'V') lineTo(x, oy + num())
    else if (C === 'C' || C === 'S') {
      let c1: [number, number]
      if (C === 'C') c1 = [ox + num(), oy + num()]
      else
        c1 = lastCtrl && /[CS]/.test(lastCmd) ? [2 * x - lastCtrl[0], 2 * y - lastCtrl[1]] : [x, y]
      const c2: [number, number] = [ox + num(), oy + num()]
      const end: [number, number] = [ox + num(), oy + num()]
      const [x0, y0] = [x, y]
      for (let s = 1; s <= STEPS; s++) {
        const u = s / STEPS
        const v = 1 - u
        lineTo(
          v * v * v * x0 + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u * u * u * end[0],
          v * v * v * y0 + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u * u * u * end[1],
        )
      }
      lastCtrl = c2
      lastCmd = C
      continue
    } else if (C === 'Q' || C === 'T') {
      let c: [number, number]
      if (C === 'Q') c = [ox + num(), oy + num()]
      else
        c = lastCtrl && /[QT]/.test(lastCmd) ? [2 * x - lastCtrl[0], 2 * y - lastCtrl[1]] : [x, y]
      const end: [number, number] = [ox + num(), oy + num()]
      const [x0, y0] = [x, y]
      for (let s = 1; s <= STEPS; s++) {
        const u = s / STEPS
        const v = 1 - u
        lineTo(
          v * v * x0 + 2 * v * u * c[0] + u * u * end[0],
          v * v * y0 + 2 * v * u * c[1] + u * u * end[1],
        )
      }
      lastCtrl = c
      lastCmd = C
      continue
    } else if (C === 'A') {
      const rx = num()
      const ry = num()
      const phi = num()
      const large = flag()
      const sweep = flag()
      const ex = ox + num()
      const ey = oy + num()
      for (const p of arcPoints(x, y, rx, ry, phi, large, sweep, ex, ey)) lineTo(p[0], p[1])
    } else {
      // Unknown command: skip its token to avoid looping forever.
      i++
    }
    lastCtrl = null
    lastCmd = C
  }
  return lines.filter((l) => l.points.length > 1 && l.points.every((p) => p.every(Number.isFinite)))
}

/** Endpoint arc parameters → points along it (SVG spec, appendix B.2.4). */
function arcPoints(
  x1: number,
  y1: number,
  rxIn: number,
  ryIn: number,
  phiDeg: number,
  large: number,
  sweep: number,
  x2: number,
  y2: number,
): Array<[number, number]> {
  let rx = Math.abs(rxIn)
  let ry = Math.abs(ryIn)
  if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) return [[x2, y2]]
  const phi = (phiDeg * Math.PI) / 180
  const cos = Math.cos(phi)
  const sin = Math.sin(phi)
  const dx = (x1 - x2) / 2
  const dy = (y1 - y2) / 2
  const x1p = cos * dx + sin * dy
  const y1p = -sin * dx + cos * dy
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
  if (lambda > 1) {
    rx *= Math.sqrt(lambda)
    ry *= Math.sqrt(lambda)
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
  const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den))
  const cxp = (k * rx * y1p) / ry
  const cyp = (-k * ry * x1p) / rx
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2
  const angle = (ux: number, uy: number, vx: number, vy: number) =>
    Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
  const t1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
  let dt = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
  if (!sweep && dt > 0) dt -= 2 * Math.PI
  if (sweep && dt < 0) dt += 2 * Math.PI
  const steps = Math.max(4, Math.ceil((Math.abs(dt) / (Math.PI / 2)) * STEPS))
  const out: Array<[number, number]> = []
  for (let s = 1; s <= steps; s++) {
    const t = t1 + (dt * s) / steps
    const px = rx * Math.cos(t)
    const py = ry * Math.sin(t)
    out.push([cos * px - sin * py + cx, sin * px + cos * py + cy])
  }
  out[out.length - 1] = [x2, y2]
  return out
}
