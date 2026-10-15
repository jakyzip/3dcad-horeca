import { type ParametricDescriptor, planStairRiseEdit, type StairNode } from '@pascal-app/core'
import { StairConstructionField } from './construction-controls'
import { StairRailingField } from './railing-controls'

export const stairParametrics: ParametricDescriptor<StairNode> = {
  groups: [
    {
      label: 'Costruzione',
      fields: [
        {
          key: 'construction',
          kind: 'custom',
          component: StairConstructionField,
        },
      ],
    },
    {
      label: 'Tipo',
      fields: [
        {
          key: 'stairType',
          kind: 'enum',
          options: ['straight', 'curved', 'spiral'],
          display: 'segmented',
        },
      ],
    },
    {
      label: 'Apertura',
      fields: [
        { key: 'fromLevelId', kind: 'ref', label: 'Dal piano', refKind: 'level' },
        { key: 'toLevelId', kind: 'ref', label: 'Al piano', refKind: 'level' },
        {
          key: 'slabOpeningMode',
          kind: 'enum',
          label: 'Taglio automatico del solaio',
          options: ['none', 'destination'],
          display: 'segmented',
        },
        {
          key: 'openingOffset',
          kind: 'number',
          label: 'Scostamento dell’apertura',
          unit: 'm',
          step: 0.01,
          visibleIf: (node) => node.slabOpeningMode === 'destination',
        },
      ],
    },
    {
      label: 'Geometria',
      fields: [
        {
          key: 'width',
          kind: 'number',
          unit: 'm',
          min: 0.001,
          step: 0.05,
          visibleIf: (node) => node.stairType !== 'straight',
        },
        {
          key: 'stepCount',
          kind: 'number',
          label: 'Gradini',
          min: 2,
          step: 1,
          visibleIf: (node) => node.stairType !== 'straight',
        },
        {
          key: 'fillToFloor',
          kind: 'boolean',
          label: 'Riempimento fino al pavimento',
          visibleIf: (node) => node.stairType === 'curved',
        },
        {
          key: 'thickness',
          kind: 'number',
          unit: 'm',
          min: 0.001,
          step: 0.01,
          visibleIf: (node) => node.stairType === 'spiral' || !node.fillToFloor,
        },
        {
          key: 'innerRadius',
          kind: 'number',
          label: 'Raggio interno',
          unit: 'm',
          min: 0.001,
          step: 0.05,
          visibleIf: (node) => node.stairType !== 'straight',
        },
        {
          key: 'sweepAngle',
          kind: 'number',
          label: 'Ampiezza (rad)',
          step: Math.PI / 180,
          visibleIf: (node) => node.stairType !== 'straight',
        },
        {
          key: 'showCenterColumn',
          kind: 'boolean',
          label: 'Colonna centrale',
          visibleIf: (node) => node.stairType === 'spiral',
        },
        {
          key: 'showStepSupports',
          kind: 'boolean',
          label: 'Supporti dei gradini',
          visibleIf: (node) => node.stairType === 'spiral',
        },
        {
          key: 'topLandingMode',
          kind: 'enum',
          label: 'Pianerottolo d’arrivo',
          options: ['none', 'integrated'],
          display: 'segmented',
          visibleIf: (node) => node.stairType === 'spiral',
        },
        {
          key: 'topLandingDepth',
          kind: 'number',
          label: 'Profondità del pianerottolo',
          unit: 'm',
          min: 0.001,
          step: 0.05,
          visibleIf: (node) => node.stairType === 'spiral' && node.topLandingMode === 'integrated',
        },
      ],
    },
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
      label: 'Ringhiera',
      fields: [
        {
          key: 'railingStyle',
          kind: 'enum',
          options: ['balusters', 'post-and-rail', 'cable', 'boards', 'glass', 'metal'],
        },
        {
          key: 'railingPath',
          kind: 'custom',
          label: 'Disposizione della ringhiera e corrimano',
          component: StairRailingField,
        },
        {
          key: 'railingMode',
          kind: 'enum',
          options: ['none', 'left', 'right', 'both'],
        },
        {
          key: 'railingHeight',
          kind: 'number',
          label: 'Altezza della ringhiera',
          unit: 'm',
          min: 0.001,
          step: 0.02,
          visibleIf: (node) => node.railingMode !== 'none',
        },
      ],
    },
  ],
  derive: (next, patch, previous) =>
    patch.stairType === 'spiral' && previous?.stairType !== 'spiral'
      ? {
          position: [next.position[0], 0, next.position[2]],
          sweepAngle: (400 * Math.PI) / 180,
        }
      : {},
  reconcile: (previous, next, nodes) =>
    next.totalRise !== previous.totalRise && next.totalRise !== undefined
      ? planStairRiseEdit(next, next.totalRise, nodes).slice(1)
      : [],
  customPanel: () => import('./panel'),
}
