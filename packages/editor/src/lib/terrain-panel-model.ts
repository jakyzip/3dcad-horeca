'use client'

import { type SiteNode, type TerrainVerb, useScene } from '@pascal-app/core'
import useEditor from '../store/use-editor'
import type { PanelRow } from './panel-rows'
import { brushRadiusRange, flattenSite, resetSiteTerrain } from './terrain-sculpt'

const TERRAIN_VERBS: TerrainVerb[] = ['raise', 'lower', 'flatten', 'smooth']
const TERRAIN_VERB_LABELS: Record<TerrainVerb, string> = {
  raise: 'Alza',
  lower: 'Abbassa',
  flatten: 'Livella',
  smooth: 'Leviga',
}

export function useTerrainPanelRows(): PanelRow[] {
  const verb = useEditor((state) => state.terrainVerb)
  const setVerb = useEditor((state) => state.setTerrainVerb)
  const brush = useEditor((state) => state.terrainBrush)
  const setBrush = useEditor((state) => state.setTerrainBrush)
  const flattenTarget = useEditor((state) => state.terrainFlattenTarget)
  const setFlattenTarget = useEditor((state) => state.setTerrainFlattenTarget)
  const sampling = useEditor((state) => state.terrainSampling)
  const setSampling = useEditor((state) => state.setTerrainSampling)
  const site = useScene((state) => {
    const root = state.rootNodeIds[0]
    const node = root ? state.nodes[root] : undefined
    return node?.type === 'site' ? (node as SiteNode) : null
  })
  const [minRadius, maxRadius] = brushRadiusRange(site)
  const verbIndex = TERRAIN_VERBS.indexOf(verb)
  const cycleVerb = (direction: -1 | 1) => {
    const next =
      TERRAIN_VERBS[(verbIndex + direction + TERRAIN_VERBS.length) % TERRAIN_VERBS.length]
    if (next) setVerb(next)
  }

  const rows: PanelRow[] = [
    {
      id: 'terrain-verb',
      kind: 'cycle',
      label: 'Pennello',
      next: () => cycleVerb(1),
      previous: () => cycleVerb(-1),
      value: TERRAIN_VERB_LABELS[verb] ?? verb,
    },
    {
      id: 'terrain-radius',
      kind: 'stepper',
      label: 'Dimensione',
      max: maxRadius,
      min: minRadius,
      onChange: (radius) => setBrush({ radius }),
      step: 0.5,
      unit: 'm',
      value: Math.max(minRadius, Math.min(maxRadius, brush.radius)),
    },
    {
      id: 'terrain-strength',
      kind: 'stepper',
      label: 'Intensità',
      max: 1,
      min: 0.05,
      onChange: (strength) => setBrush({ strength }),
      step: 0.05,
      value: brush.strength,
    },
    {
      id: 'terrain-softness',
      kind: 'stepper',
      label: 'Morbidezza',
      max: 1,
      min: 0,
      onChange: (falloff) => setBrush({ falloff }),
      step: 0.05,
      value: brush.falloff,
    },
    {
      id: 'terrain-shape',
      kind: 'choice',
      label: 'Forma',
      onSelect: () => setBrush({ shape: brush.shape === 'round' ? 'square' : 'round' }),
      value: brush.shape === 'round' ? 'Rotondo' : 'Quadrato',
    },
    ...(verb === 'flatten'
      ? ([
          {
            id: 'terrain-target',
            kind: 'stepper',
            label: 'Quota obiettivo',
            max: 50,
            min: -50,
            onChange: setFlattenTarget,
            step: 0.1,
            unit: 'm',
            value: flattenTarget ?? 0,
          },
          {
            id: 'terrain-sampling',
            kind: 'choice',
            label: 'Preleva altezza',
            onSelect: () => setSampling(!sampling),
            value: sampling ? 'Attivo' : 'Disattivato',
          },
        ] satisfies PanelRow[])
      : []),
    {
      id: 'terrain-level-lot',
      kind: 'choice',
      label: 'Tutto il lotto',
      onSelect: site ? () => flattenSite(site, flattenTarget ?? 0) : undefined,
      value: 'Livella',
    },
    {
      id: 'terrain-clear',
      kind: 'choice',
      label: 'Terreno',
      onSelect: site?.terrain ? () => resetSiteTerrain(site) : undefined,
      value: site?.terrain ? 'Azzera' : 'Vuoto',
    },
  ]
  return rows
}
