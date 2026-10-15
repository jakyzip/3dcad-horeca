import type { MaterialCatalogItem } from '@pascal-app/core'

/**
 * Tile finishes for walls and floors, drawn by our own script (`scripts/genera-piastrelle.ts`), so
 * any size and colour is possible and no third-party texture is involved. Each texture holds a
 * whole number of tiles; with the editor's world-scale UVs (1 UV unit = 1 m) `repeat` is the number
 * of textures per metre.
 */

export type TileSpec = {
  id: string
  label: string
  /** Tile size in centimetres, width × height as laid. */
  tile: [number, number]
  /** Tiles across and down in one texture. */
  count: [number, number]
  /** Grout width in millimetres. */
  grout: number
  color: string
  groutColor: string
  /** Subtle tone variation between tiles, 0–1. */
  variation: number
  roughness: number
  surfaces: Array<'wall' | 'floor'>
}

export const TILE_SPECS: readonly TileSpec[] = [
  {
    id: 'piastrella-10-bianca',
    label: 'Piastrella 10×10 bianca',
    tile: [10, 10],
    count: [8, 8],
    grout: 2,
    color: '#f2f1ee',
    groutColor: '#d6d3cd',
    variation: 0.03,
    roughness: 0.18,
    surfaces: ['wall'],
  },
  {
    id: 'piastrella-10-rossa',
    label: 'Piastrella 10×10 rosso bordeaux',
    tile: [10, 10],
    count: [8, 8],
    grout: 2,
    color: '#8e1b22',
    groutColor: '#f0eeea',
    variation: 0.06,
    roughness: 0.15,
    surfaces: ['wall'],
  },
  {
    id: 'piastrella-10-blu',
    label: 'Piastrella 10×10 blu',
    tile: [10, 10],
    count: [8, 8],
    grout: 2,
    color: '#24508f',
    groutColor: '#eceae6',
    variation: 0.06,
    roughness: 0.15,
    surfaces: ['wall'],
  },
  {
    id: 'piastrella-20-bianca',
    label: 'Piastrella 20×20 bianca',
    tile: [20, 20],
    count: [5, 5],
    grout: 2,
    color: '#f2f1ee',
    groutColor: '#d1cec8',
    variation: 0.03,
    roughness: 0.18,
    surfaces: ['wall', 'floor'],
  },
  {
    id: 'piastrella-20-grigia',
    label: 'Piastrella 20×20 grigia',
    tile: [20, 20],
    count: [5, 5],
    grout: 2,
    color: '#9c9ea0',
    groutColor: '#d8d6d2',
    variation: 0.05,
    roughness: 0.3,
    surfaces: ['wall', 'floor'],
  },
  {
    id: 'piastrella-10x20-bianca',
    label: 'Piastrella 10×20 bianca (diamantata)',
    tile: [20, 10],
    count: [5, 10],
    grout: 2,
    color: '#f4f3f0',
    groutColor: '#cfccc6',
    variation: 0.03,
    roughness: 0.15,
    surfaces: ['wall'],
  },
  {
    id: 'piastrella-30-chiara',
    label: 'Pavimento 30×30 chiaro',
    tile: [30, 30],
    count: [4, 4],
    grout: 3,
    color: '#e9e6df',
    groutColor: '#b9b5ad',
    variation: 0.04,
    roughness: 0.45,
    surfaces: ['floor'],
  },
  {
    id: 'piastrella-30-grigia',
    label: 'Pavimento 30×30 grigio',
    tile: [30, 30],
    count: [4, 4],
    grout: 3,
    color: '#8f9193',
    groutColor: '#6e7072',
    variation: 0.05,
    roughness: 0.5,
    surfaces: ['floor'],
  },
  {
    id: 'piastrella-30x60-antracite',
    label: 'Pavimento 30×60 antracite',
    tile: [60, 30],
    count: [2, 4],
    grout: 3,
    color: '#4a4c4f',
    groutColor: '#3a3c3e',
    variation: 0.04,
    roughness: 0.55,
    surfaces: ['floor'],
  },
]

/** Texture side in metres, across and down. */
export const textureSize = (spec: TileSpec): [number, number] => [
  (spec.tile[0] * spec.count[0]) / 100,
  (spec.tile[1] * spec.count[1]) / 100,
]

export const tileTexturePath = (spec: TileSpec, map: 'albedo' | 'normal' | 'thumb') =>
  `/material/horeca/${spec.id}-${map}.png`

/** Library entries for the tiles, registered by the host at start-up. */
export function tileMaterials(): MaterialCatalogItem[] {
  return TILE_SPECS.map((spec) => {
    const [w, h] = textureSize(spec)
    return {
      id: `horeca-${spec.id}`,
      label: spec.label,
      category: 'tile',
      surfaces: spec.surfaces,
      description: `Piastrella ${spec.tile[0]}×${spec.tile[1]} cm, fuga ${spec.grout} mm`,
      previewThumbnailUrl: tileTexturePath(spec, 'thumb'),
      previewColor: spec.color,
      preset: {
        maps: {
          albedoMap: tileTexturePath(spec, 'albedo'),
          normalMap: tileTexturePath(spec, 'normal'),
        },
        mapProperties: {
          color: '#ffffff',
          roughness: spec.roughness,
          metalness: 0,
          repeatX: 1 / w,
          repeatY: 1 / h,
          rotation: 0,
          wrapS: 'Repeat',
          wrapT: 'Repeat',
          normalScaleX: 1,
          normalScaleY: 1,
          emissiveIntensity: 1,
          displacementScale: 0,
          transparent: false,
          flipY: true,
          bumpScale: 1,
          emissiveColor: '#000000',
          aoMapIntensity: 1,
          side: 0,
          opacity: 1,
          lightMapIntensity: 1,
        },
      },
    }
  })
}
