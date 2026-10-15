import type { ElevatorNode, ParametricDescriptor } from '@pascal-app/core'

export const elevatorParametrics: ParametricDescriptor<ElevatorNode> = {
  groups: [
    {
      label: 'Posizione',
      fields: [
        { key: 'position', kind: 'vec3' },
        {
          key: 'rotation',
          kind: 'number',
          label: 'Rotazione (rad)',
          min: -Math.PI,
          max: Math.PI,
          step: Math.PI / 36,
        },
      ],
    },
    {
      label: 'Cabina',
      fields: [
        { key: 'width', kind: 'number', unit: 'm', min: 0.8, max: 1000, step: 0.05 },
        { key: 'depth', kind: 'number', unit: 'm', min: 0.8, max: 1000, step: 0.05 },
        { key: 'cabHeight', kind: 'number', unit: 'm', min: 1.8, max: 1000, step: 0.05 },
      ],
    },
    {
      label: 'Vano',
      fields: [
        {
          key: 'shaftWallThickness',
          kind: 'number',
          label: 'Spessore delle pareti',
          unit: 'm',
          min: 0.04,
          max: 1000,
          step: 0.01,
        },
        {
          key: 'shaftStyle',
          kind: 'enum',
          options: ['solid', 'glass'],
          display: 'segmented',
        },
      ],
    },
    {
      label: 'Porte',
      fields: [
        { key: 'doorWidth', kind: 'number', unit: 'm', min: 0.45, max: 1000, step: 0.05 },
        { key: 'doorHeight', kind: 'number', unit: 'm', min: 1.2, max: 1000, step: 0.05 },
        {
          key: 'doorStyle',
          kind: 'enum',
          options: ['center-opening', 'single-left', 'single-right'],
        },
        {
          key: 'doorPanelStyle',
          kind: 'enum',
          label: 'Stile dei pannelli',
          options: ['glass-frame', 'solid-panel', 'segmented-panel'],
        },
      ],
    },
    {
      label: 'Piani',
      fields: [
        { key: 'fromLevelId', kind: 'ref', label: 'Dal piano', refKind: 'level' },
        { key: 'toLevelId', kind: 'ref', label: 'Al piano', refKind: 'level' },
        { key: 'defaultLevelId', kind: 'ref', label: 'Piano predefinito', refKind: 'level' },
      ],
    },
    {
      label: 'Movimento',
      fields: [
        { key: 'speed', kind: 'number', unit: 'm/s', min: 0.5, max: 8, step: 0.1 },
        {
          key: 'doorDurationMs',
          kind: 'number',
          label: 'Tempo delle porte',
          unit: 'ms',
          min: 300,
          max: 2200,
          step: 50,
        },
        {
          key: 'dwellMs',
          kind: 'number',
          label: 'Sosta',
          unit: 'ms',
          min: 300,
          max: 5000,
          step: 100,
        },
      ],
    },
  ],
  derive: (next) => ({
    doorHeight: Math.min(next.doorHeight, Math.max(1.2, next.cabHeight - 0.1)),
    doorWidth: Math.min(next.doorWidth, Math.max(0.45, next.width - 0.1)),
  }),
  customPanel: () => import('./panel'),
}
