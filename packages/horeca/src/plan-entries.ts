import { type AnyNodeId, useScene } from '@pascal-app/core'
import { collectSheetGeometry, useFloorplanAnnotationVisibility } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { type DxfExportEntry, zoneLabelEntries } from './dxf-export'
import { RILIEVO } from './rilievo-schema'

/**
 * A level's plan as the editor draws it for documents (the sheet export's collection), plus room
 * names: what the DXF export writes and the CRM preview shows.
 */
export function levelPlanEntries(levelId: AnyNodeId, withRilievo = false): DxfExportEntry[] {
  const { nodes } = useScene.getState()
  const entries = collectSheetGeometry({
    nodes: nodes as never,
    levelId,
    drawingType: 'floor-plan',
    annotationVisibility: useFloorplanAnnotationVisibility.getState().visibility,
    unit: 'metric',
    metricNotation: useViewer.getState().metricNotation,
    accept: (node) => withRilievo || (node.type as string) !== RILIEVO,
  })
  return [...entries, ...zoneLabelEntries(nodes, levelId)]
}
