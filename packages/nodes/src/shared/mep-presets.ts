import type { PipeSegmentNode } from '@pascal-app/core'

export type PipePreset = {
  id: string
  label: string
  system: PipeSegmentNode['system']
  pipeMaterial: PipeSegmentNode['pipeMaterial']
  diameter: number
  sloped: boolean
}

export const PIPE_PRESETS: readonly PipePreset[] = [
  {
    id: 'pvc-waste',
    label: 'Scarico · PVC · in pendenza',
    system: 'waste',
    pipeMaterial: 'pvc',
    diameter: 2,
    sloped: true,
  },
  {
    id: 'abs-waste',
    label: 'Scarico · ABS · in pendenza',
    system: 'waste',
    pipeMaterial: 'abs',
    diameter: 2,
    sloped: true,
  },
  {
    id: 'cast-iron-waste',
    label: 'Scarico · ghisa · in pendenza',
    system: 'waste',
    pipeMaterial: 'cast-iron',
    diameter: 3,
    sloped: true,
  },
  {
    id: 'pvc-vent',
    label: 'Ventilazione · PVC · in piano',
    system: 'vent',
    pipeMaterial: 'pvc',
    diameter: 2,
    sloped: false,
  },
]
