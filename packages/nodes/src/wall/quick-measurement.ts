import {
  getWallCurveFrameAt,
  getWallCurveLength,
  getWallThickness,
  type QuickMeasurementReport,
  useScene,
  type WallNode,
} from '@pascal-app/core'
import { resolveWallOpeningCeiling } from '../shared/wall-opening-ceiling'

export function wallQuickMeasurement(node: WallNode): QuickMeasurementReport {
  const length = getWallCurveLength(node)
  const height = resolveWallOpeningCeiling(node, useScene.getState().nodes)
  const frame = getWallCurveFrameAt(node, 0.5)

  return {
    title: node.name ?? 'Muro',
    kindLabel: 'Muro',
    anchor: [frame.point.x, height * 0.55, frame.point.y],
    metrics: [
      { key: 'length', label: 'Lunghezza', abbreviation: 'L', quantity: 'length', value: length },
      { key: 'height', label: 'Altezza', abbreviation: 'H', quantity: 'length', value: height },
      {
        key: 'surface',
        label: 'Superficie',
        abbreviation: 'A',
        quantity: 'area',
        value: length * height,
      },
      {
        key: 'thickness',
        label: 'Spessore',
        abbreviation: 'T',
        quantity: 'length',
        value: getWallThickness(node),
      },
    ],
    note: 'Superficie lorda della faccia, aperture comprese.',
  }
}
