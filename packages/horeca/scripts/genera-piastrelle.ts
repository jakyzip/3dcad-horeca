/**
 * Draws the tile textures listed in `src/tiles.ts` into `apps/editor/public/material/horeca/`:
 * for each tile an albedo, a normal map (grout lines recessed) and a thumbnail, as PNG. Every pixel
 * comes from this script, so the images are ours (MIT) and need no third-party licence.
 *
 * Run from the repository root: `bun packages/horeca/scripts/genera-piastrelle.ts`
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'
import { TILE_SPECS, type TileSpec, textureSize, tileTexturePath } from '../src/tiles'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const publicDir = join(root, 'apps/editor/public')
const MAX_SIDE = 1024
const THUMB = 128

// ─── PNG (8-bit RGB, no filtering) ────────────────────────────────────────────

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type: string, data: Uint8Array): Buffer {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0)
  return Buffer.concat([head, data, crc])
}
function png(width: number, height: number, rgb: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: RGB
  const raw = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0 // filter: none
    raw.set(rgb.subarray(y * width * 3, (y + 1) * width * 3), y * (width * 3 + 1) + 1)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', new Uint8Array()),
  ])
}

// ─── Tile pattern ─────────────────────────────────────────────────────────────

const hex = (color: string): [number, number, number] => {
  const n = Number.parseInt(color.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Deterministic per-tile noise in [-1, 1], so the files are the same on every run. */
function noise(i: number, j: number, seed: number): number {
  let h = (i * 374761393 + j * 668265263 + seed * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return (((h ^ (h >>> 16)) >>> 0) / 4294967295) * 2 - 1
}

/**
 * Height in [0, 1] at a point of the texture (cm): 0 in the grout, 1 on the tile face, with a
 * rounded edge of ~1.5 mm, as on glazed tiles.
 */
function heightAt(spec: TileSpec, xCm: number, yCm: number): { h: number; i: number; j: number } {
  const [tw, th] = spec.tile
  const i = Math.floor(xCm / tw)
  const j = Math.floor(yCm / th)
  const half = spec.grout / 20 // grout mm → half width in cm
  const dx = Math.min(xCm - i * tw, (i + 1) * tw - xCm)
  const dy = Math.min(yCm - j * th, (j + 1) * th - yCm)
  const edge = Math.min(dx, dy) - half
  const bevel = 0.15
  const h = edge <= 0 ? 0 : edge >= bevel ? 1 : Math.sin((edge / bevel) * (Math.PI / 2))
  return { h, i, j }
}

function render(spec: TileSpec, width: number, height: number, coverCm: [number, number]) {
  const albedo = new Uint8Array(width * height * 3)
  const normal = new Uint8Array(width * height * 3)
  const tile = hex(spec.color)
  const grout = hex(spec.groutColor)
  const cmPerPx = coverCm[0] / width
  const seed = spec.id.length
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const xCm = (x + 0.5) * cmPerPx
      const yCm = (y + 0.5) * cmPerPx
      const { h, i, j } = heightAt(spec, xCm, yCm)
      // Each tile a shade lighter or darker, plus a faint diagonal sheen across it.
      const tone = 1 + noise(i, j, seed) * spec.variation
      const sheen = 1 + 0.015 * Math.sin((xCm + yCm) / 3 + noise(j, i, seed) * 3)
      const k = (x + y * width) * 3
      for (let c = 0; c < 3; c++) {
        const face = Math.min(255, tile[c]! * tone * sheen)
        albedo[k + c] = Math.round(grout[c]! + (face - grout[c]!) * Math.min(1, h * 1.2))
      }
      // Normal from the height gradient (tangent space, +z out of the wall).
      const step = cmPerPx
      const hx = heightAt(spec, xCm + step, yCm).h - heightAt(spec, xCm - step, yCm).h
      const hy = heightAt(spec, xCm, yCm + step).h - heightAt(spec, xCm, yCm - step).h
      const strength = 0.08 / step
      let nx = -hx * strength
      let ny = hy * strength
      let nz = 1
      const len = Math.hypot(nx, ny, nz)
      nx /= len
      ny /= len
      nz /= len
      normal[k] = Math.round((nx * 0.5 + 0.5) * 255)
      normal[k + 1] = Math.round((ny * 0.5 + 0.5) * 255)
      normal[k + 2] = Math.round((nz * 0.5 + 0.5) * 255)
    }
  }
  return { albedo, normal }
}

mkdirSync(join(publicDir, 'material/horeca'), { recursive: true })
for (const spec of TILE_SPECS) {
  const [wM, hM] = textureSize(spec)
  const scale = MAX_SIDE / Math.max(wM, hM)
  const width = Math.round(wM * scale)
  const height = Math.round(hM * scale)
  const { albedo, normal } = render(spec, width, height, [wM * 100, hM * 100])
  writeFileSync(join(publicDir, tileTexturePath(spec, 'albedo')), png(width, height, albedo))
  writeFileSync(join(publicDir, tileTexturePath(spec, 'normal')), png(width, height, normal))
  // Thumbnail: a 40 cm square, enough to read the tile size at a glance.
  const thumb = render(spec, THUMB, THUMB, [40, 40]).albedo
  writeFileSync(join(publicDir, tileTexturePath(spec, 'thumb')), png(THUMB, THUMB, thumb))
  console.log(`${spec.id}: ${width}×${height} px, ${wM}×${hM} m`)
}
