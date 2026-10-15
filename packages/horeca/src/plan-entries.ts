import { type AnyNodeId, useScene } from '@pascal-app/core'
import { collectSheetGeometry, useFloorplanAnnotationVisibility } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { type DxfExportEntry, zoneLabelEntries } from './dxf-export'
import { RILIEVO } from './rilievo-schema'

/**
 * A level's plan as the editor draws it for documents (the sheet export's collection), plus room
 * names: what the DXF export writes and the CRM preview shows.
 */
export function levelPlanEntries(
  levelId: AnyNodeId,
  withRilievo = false,
  /** Annotation switches to force, e.g. the automatic dimensions on for the customer's sheet. */
  visibility: Partial<
    ReturnType<typeof useFloorplanAnnotationVisibility.getState>['visibility']
  > = {},
): DxfExportEntry[] {
  const { nodes } = useScene.getState()
  const entries = collectSheetGeometry({
    nodes: nodes as never,
    levelId,
    drawingType: 'floor-plan',
    annotationVisibility: {
      ...useFloorplanAnnotationVisibility.getState().visibility,
      ...visibility,
    },
    unit: 'metric',
    metricNotation: useViewer.getState().metricNotation,
    // The walkthrough's spawn point is an editor aid, not part of the drawing.
    accept: (node) =>
      (node.type as string) !== 'spawn' && (withRilievo || (node.type as string) !== RILIEVO),
  })
  return [...entries, ...zoneLabelEntries(nodes, levelId)]
}
