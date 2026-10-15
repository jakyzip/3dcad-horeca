import type { RoofType } from '@pascal-app/core'

export type RoofFeatureIdentity = {
  id: string
  kind?: string
}

const ROOF_FOOTPRINT_SOURCES = [
  { label: 'Stanza', value: 'room' },
  { label: 'Muro', value: 'walls' },
  { label: 'Disegna', value: 'draw' },
] as const

export type RoofFootprintSource = (typeof ROOF_FOOTPRINT_SOURCES)[number]['value']

const CONICAL_ROOF_FOOTPRINT_SOURCES = [ROOF_FOOTPRINT_SOURCES[1]] as const
const STANDARD_ROOF_FOOTPRINT_SOURCES = [
  ROOF_FOOTPRINT_SOURCES[2],
  ROOF_FOOTPRINT_SOURCES[0],
] as const

export function getRoofFootprintSources(roofType: RoofType) {
  return roofType === 'conical' ? CONICAL_ROOF_FOOTPRINT_SOURCES : STANDARD_ROOF_FOOTPRINT_SOURCES
}

export function getRoofFootprintSource(roofType: RoofType, value: unknown): RoofFootprintSource {
  const sources = getRoofFootprintSources(roofType)
  return sources.some((source) => source.value === value)
    ? (value as RoofFootprintSource)
    : sources[0].value
}

export const ROOF_TYPE_OPTIONS: ReadonlyArray<{ label: string; value: RoofType }> = [
  { label: 'A padiglione', value: 'hip' },
  { label: 'A capanna', value: 'gable' },
  { label: 'A una falda', value: 'shed' },
  { label: 'Piano', value: 'flat' },
  { label: 'A capanna spezzata', value: 'gambrel' },
  { label: 'A padiglione con frontone', value: 'dutch' },
  { label: 'A mansarda', value: 'mansard' },
  { label: 'Conico', value: 'conical' },
]

export function getActiveRoofFeatureId(
  features: readonly RoofFeatureIdentity[],
  activeTool: string | null | undefined,
): string | null {
  if (!activeTool) return null
  return features.find((feature) => feature.kind === activeTool)?.id ?? null
}
