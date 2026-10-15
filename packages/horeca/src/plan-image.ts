import type { FloorplanPoint } from '@pascal-app/core'
import { DIM_TEXT, type DxfExportEntry, drawPlan, type PlanWriter, TICK } from './dxf-export'

/**
 * A picture of the plan for the CRM (the preview next to the distinta): the same drawing as the
 * DXF export, as SVG, then rasterised to PNG in the browser. 2400 × 1600 with a 5% margin, like
 * the Rust CAD's preview.
 */

export const PREVIEW_SIZE: [number, number] = [2400, 1600]

const COLORS: Record<string, string> = {
  MURI: '#111827',
  APERTURE: '#0e7490',
  AMBIENTI: '#9ca3af',
  ATTREZZATURE: '#1d4ed8',
  IMPIANTI: '#ea580c',
  ARREDI: '#7c3aed',
  QUOTE: '#b91c1c',
  TESTI: '#374151',
  RILIEVO: '#9ca3af',
}
const color = (layer: string) => COLORS[layer] ?? '#4b5563'

const xmlText = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const n = (v: number) => Number(v.toFixed(4))

export function planToSvg(
  entries: readonly DxfExportEntry[],
  [width, height]: [number, number] = PREVIEW_SIZE,
): string | null {
  const parts: string[] = []
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  const grow = ([x, y]: FloorplanPoint) => {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  const stroke = (layer: string, w = 2) =>
    `fill="none" stroke="${color(layer)}" stroke-width="${w}" vector-effect="non-scaling-stroke"`
  const line = (layer: string, a: FloorplanPoint, b: FloorplanPoint, w?: number) => {
    grow(a)
    grow(b)
    parts.push(
      `<line x1="${n(a[0])}" y1="${n(a[1])}" x2="${n(b[0])}" y2="${n(b[1])}" ${stroke(layer, w)}/>`,
    )
  }
  const text: PlanWriter['text'] = (layer, at, size, value, angle, anchor, baseline) => {
    const clean = value.replace(/\s+/g, ' ').trim()
    if (!clean) return
    grow(at)
    parts.push(
      `<text transform="translate(${n(at[0])} ${n(at[1])}) rotate(${n((angle * 180) / Math.PI)})" font-size="${n(size)}" font-family="Helvetica, Arial, sans-serif" fill="${color(layer)}" text-anchor="${anchor ?? 'start'}" dominant-baseline="${baseline ?? 'alphabetic'}">${xmlText(clean)}</text>`,
    )
  }

  const writer: PlanWriter = {
    mask: (points) =>
      parts.push(
        `<polygon points="${points.map((p) => `${n(p[0])},${n(p[1])}`).join(' ')}" fill="#ffffff"/>`,
      ),
    line: (layer, a, b) => line(layer, a, b, layer === 'MURI' ? 3 : 2),
    polyline: (layer, points, closed) => {
      if (points.length < 2) return
      for (const p of points) grow(p)
      const tag = closed ? 'polygon' : 'polyline'
      parts.push(
        `<${tag} points="${points.map((p) => `${n(p[0])},${n(p[1])}`).join(' ')}" ${stroke(layer, layer === 'MURI' ? 3 : 2)}/>`,
      )
    },
    circle: (layer, c, r) => {
      grow([c[0] - r, c[1] - r])
      grow([c[0] + r, c[1] + r])
      parts.push(`<circle cx="${n(c[0])}" cy="${n(c[1])}" r="${n(r)}" ${stroke(layer)}/>`)
    },
    text,
    dimension: (a, b, lineA, lineB, value, overshoot, layer = 'QUOTE') => {
      const dx = lineB[0] - lineA[0]
      const dy = lineB[1] - lineA[1]
      const length = Math.hypot(dx, dy)
      if (length < 1e-6) return
      const ux = dx / length
      const uy = dy / length
      for (const [from, to] of [
        [a, lineA],
        [b, lineB],
      ] as const) {
        const ex = to[0] - from[0]
        const ey = to[1] - from[1]
        const el = Math.hypot(ex, ey)
        if (el > 1e-6)
          line(layer, from, [to[0] + (ex / el) * overshoot, to[1] + (ey / el) * overshoot], 1)
      }
      line(layer, lineA, lineB, 1)
      const tx = ((ux - uy) * TICK) / 2 / Math.SQRT2
      const ty = ((uy + ux) * TICK) / 2 / Math.SQRT2
      for (const p of [lineA, lineB]) line(layer, [p[0] - tx, p[1] - ty], [p[0] + tx, p[1] + ty], 2)
      let nx = uy
      let ny = -ux
      if (ny > 0 || (ny === 0 && nx < 0)) {
        nx = -nx
        ny = -ny
      }
      let angle = Math.atan2(uy, ux)
      if (angle > Math.PI / 2) angle -= Math.PI
      if (angle <= -Math.PI / 2) angle += Math.PI
      const mid: FloorplanPoint = [
        (lineA[0] + lineB[0]) / 2 + nx * DIM_TEXT * 0.6,
        (lineA[1] + lineB[1]) / 2 + ny * DIM_TEXT * 0.6,
      ]
      text(layer, mid, DIM_TEXT, value, angle, 'middle', 'central')
    },
  }

  drawPlan(entries, writer)
  if (!Number.isFinite(minX)) return null
  const w = Math.max(maxX - minX, 0.1)
  const h = Math.max(maxY - minY, 0.1)
  const margin = Math.max(w, h) * 0.05
  const box = [minX - margin, minY - margin, w + 2 * margin, h + 2 * margin].map(n).join(' ')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${box}" preserveAspectRatio="xMidYMid meet"><rect x="${n(minX - margin * 50)}" y="${n(minY - margin * 50)}" width="${n((w + 2 * margin) * 100)}" height="${n((h + 2 * margin) * 100)}" fill="#ffffff"/>${parts.join('')}</svg>`
}

/** SVG → PNG in the browser (an `<img>` drawn on a canvas). */
export function svgToPng(
  svg: string,
  [width, height]: [number, number] = PREVIEW_SIZE,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        URL.revokeObjectURL(url)
        reject(new Error('Il browser non sa disegnare l’immagine della pianta.'))
        return
      }
      context.drawImage(image, 0, 0, width, height)
      URL.revokeObjectURL(url)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Immagine della pianta non creata.'))),
        'image/png',
      )
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Immagine della pianta non creata.'))
    }
    image.src = url
  })
}
