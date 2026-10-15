import type { QuickMeasurementReport, SlabNode } from '@pascal-app/core'
import {
  polygonBoundaryLength,
  polygonReportAnchor,
  polygonSurfaceArea,
} from '../shared/quick-measurement'

export function slabQuickMeasurement(node: SlabNode): QuickMeasurementReport | null {
  if (node.polygon.length < 3) return null
  const elevation = node.elevation ?? 0.05
  const thickness = node.thickness ?? 0.05

  return {
    title: node.name ?? 'Solaio',
    kindLabel: 'Solaio',
    anchor: polygonReportAnchor(node.polygon, elevation + 0.04),
    metrics: [
      {
        key: 'area',
        label: 'Superficie',
        abbreviation: 'A',
        quantity: 'area',
        value: polygonSurfaceArea(node.polygon, node.holes),
      },
      {
        key: 'perimeter',
        label: 'Perimetro',
        abbreviation: 'P',
        quantity: 'length',
        value: polygonBoundaryLength(node.polygon),
      },
      {
        key: 'thickness',
        label: 'Spessore',
        abbreviation: 'T',
        quantity: 'length',
        value: thickness,
      },
    ],
    note: node.holes.length > 0 ? 'La superficie esclude le aperture del solaio.' : undefined,
  }
}
