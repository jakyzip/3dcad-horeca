import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { TILE_SPECS, textureSize, tileMaterials } from './tiles'

const publicDir = join(import.meta.dir, '../../../apps/editor/public')

describe('tile materials', () => {
  test('every material has its generated images (run scripts/genera-piastrelle.ts)', () => {
    for (const material of tileMaterials()) {
      const maps = [
        material.previewThumbnailUrl,
        material.preset.maps.albedoMap,
        material.preset.maps.normalMap,
      ]
      for (const path of maps) expect(existsSync(join(publicDir, path!))).toBe(true)
    }
  })

  test('repeat gives real tile sizes with 1 UV unit = 1 m', () => {
    for (const spec of TILE_SPECS) {
      const material = tileMaterials().find((m) => m.id === `horeca-${spec.id}`)!
      const [w, h] = textureSize(spec)
      // One tile spans (1 / repeat) / count metres.
      expect(1 / material.preset.mapProperties.repeatX! / spec.count[0]).toBeCloseTo(
        spec.tile[0] / 100,
        6,
      )
      expect(1 / material.preset.mapProperties.repeatY! / spec.count[1]).toBeCloseTo(
        spec.tile[1] / 100,
        6,
      )
      expect(w).toBeGreaterThan(0)
      expect(h).toBeGreaterThan(0)
    }
  })

  test('ids are unique and namespaced', () => {
    const ids = tileMaterials().map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => id.startsWith('horeca-piastrella-'))).toBe(true)
  })
})
