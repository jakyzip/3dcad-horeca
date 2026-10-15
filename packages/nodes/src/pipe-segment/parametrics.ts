import type { ParametricDescriptor } from '@pascal-app/core'
import { findAutomaticRunEndCapIds } from '../shared/automatic-run-end-cap'
import { fittingDeletionPlansForRun } from '../shared/fitting-deletion-cleanup'
import type { PipeSegmentNode } from './schema'

export const pipeSegmentParametrics: ParametricDescriptor<PipeSegmentNode> = {
  derive: (next) =>
    next.autoHangers
      ? {
          hangerStyle: next.hangerStyle ?? 'single',
          hangerSpacing: next.hangerSpacing ?? 1.5,
          hangerMaxReach: next.hangerMaxReach ?? 2,
        }
      : {},
  onDelete: (pipe, nodes, _pendingDeleteIds, requestedDeleteIds) =>
    fittingDeletionPlansForRun(pipe, nodes, requestedDeleteIds, true).flatMap(
      (plan) => plan.updates,
    ),
  onDeleteCascade: (pipe, nodes, _pendingDeleteIds, requestedDeleteIds) => [
    ...findAutomaticRunEndCapIds(pipe.id, nodes, 'pipe-fitting'),
    ...fittingDeletionPlansForRun(pipe, nodes, requestedDeleteIds, false).flatMap((plan) =>
      plan.deleteFitting ? [plan.fittingId, ...plan.cascadeDeleteIds] : [],
    ),
  ],
  trailingSection: () => import('../shared/run-hanger-inspector'),
  groups: [
    {
      label: 'Staffe',
      fields: [
        { key: 'autoHangers', label: 'Staffe automatiche', kind: 'boolean' },
        {
          key: 'hangerStyle',
          label: 'File di staffe',
          kind: 'enum',
          options: ['single', 'double'],
          display: 'segmented',
          visibleIf: (n) => !!n.autoHangers,
        },
        {
          key: 'hangerSpacing',
          label: 'Interasse',
          kind: 'number',
          unit: 'm',
          min: 0.05,
          max: 1000,
          step: 0.1,
          visibleIf: (n) => !!n.autoHangers,
        },
        {
          key: 'hangerMaxReach',
          label: 'Distanza massima',
          kind: 'number',
          unit: 'm',
          min: 0.01,
          max: 1000,
          step: 0.1,
          visibleIf: (n) => !!n.autoHangers,
        },
      ],
    },
    {
      label: 'Scarico',
      fields: [
        {
          key: 'system',
          kind: 'enum',
          options: ['waste', 'vent'],
          display: 'segmented',
        },
        {
          key: 'diameter',
          kind: 'number',
          unit: 'in',
          min: 1.25,
          max: 6,
          step: 0.25,
        },
      ],
    },
    {
      label: 'Costruzione',
      fields: [
        {
          key: 'pipeMaterial',
          kind: 'enum',
          options: ['pvc', 'abs', 'cast-iron'],
        },
      ],
    },
  ],
}
