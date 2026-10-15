// The `dxf` package (MIT) ships no types: just the parts the survey import reads.
declare module 'dxf' {
  export type DxfEntity = { type: string; layer?: string; [key: string]: unknown }
  export type DxfLayer = { name: string; colorNumber?: number; flags?: number }
  export type DxfParsed = {
    header: { insUnits?: number; [key: string]: unknown }
    tables: { layers: Record<string, DxfLayer> }
    blocks: Array<{ name: string; x?: number; y?: number; entities: DxfEntity[] }>
    entities: DxfEntity[]
  }
  export type DxfTransform = Record<string, number | undefined>
  export function parseString(text: string): DxfParsed
  export function denormalise(parsed: DxfParsed): Array<DxfEntity & { transforms: DxfTransform[] }>
}

declare module 'dxf/lib/entityToPolyline' {
  const entityToPolyline: (entity: unknown) => Array<[number, number]>
  export default entityToPolyline
}

declare module 'dxf/lib/applyTransforms' {
  const applyTransforms: (
    polyline: Array<[number, number]>,
    transforms: Array<Record<string, number | undefined>>,
  ) => Array<[number, number]>
  export default applyTransforms
}
