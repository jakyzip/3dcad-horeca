import { area, difference, intersection, union } from '../../lib/polygon-boolean'
import { segmentsIntersect } from '../../lib/polygon-relations'
import type { WallNode, ZoneNode } from '../../schema'
import { calculateLevelMiters, getWallPlanFootprint } from '../../systems/wall/wall-footprint'
import { mezzanineElevationConflict } from './mezzanine-content'
import { type Point, roomFace, type StructureConflict, type StructureNodes } from './shared'

export function mezzanineHostClearance(nodes: StructureNodes, host: ZoneNode) {
  const face = roomFace(nodes, host)
  if (!face) return []
  const walls = Object.values(nodes).filter(
    (node): node is WallNode => node.type === 'wall' && node.parentId === host.parentId,
  )
  const miters = calculateLevelMiters(walls)
  return difference(
    { outer: face.referencePolygon, holes: face.holes },
    union(walls.map((wall) => getWallPlanFootprint(wall, miters).map(({ x, y }): Point => [x, y]))),
  )
}

export function validateMezzanine(
  nodes: StructureNodes,
  zone: ZoneNode,
  excludeId?: string,
): StructureConflict | undefined {
  const fail = (code: string, message: string, nodeIds = [zone.id as string]) => ({
    code,
    message,
    nodeIds,
  })
  const polygon = zone.polygon
  if (polygon.length < 3 || !polygon.flat().every(Number.isFinite))
    return fail('too-small', 'Un soppalco deve avere un contorno valido di almeno 1 m².')
  if (
    polygon.some((start, i) =>
      polygon.some(
        (other, j) =>
          j > i + 1 &&
          !(i === 0 && j === polygon.length - 1) &&
          segmentsIntersect(
            start,
            polygon[(i + 1) % polygon.length]!,
            other,
            polygon[(j + 1) % polygon.length]!,
          ),
      ),
    )
  )
    return fail('self-intersecting', 'I lati del soppalco non devono incrociarsi.')
  if (area([{ outer: polygon, holes: zone.holes }]) < 1)
    return fail('too-small', 'Un soppalco deve avere almeno 1 m² di pavimento.')
  // Intent may reach wall reference lines; the structure kernel clips derived plates to wall faces.
  const host = nodes[zone.hostZoneId ?? '']
  const face = host?.type === 'zone' ? roomFace(nodes, host) : undefined
  if (
    host?.type !== 'zone' ||
    host.floor?.support === 'open' ||
    host.parentId !== zone.parentId ||
    !face ||
    area(
      difference(
        { outer: polygon, holes: zone.holes },
        { outer: face.referencePolygon, holes: face.holes },
      ),
    ) > 1e-6
  )
    return fail(
      'outside-host',
      'Il soppalco deve restare dentro il contorno della stanza che lo ospita.',
    )
  const overlapping = Object.values(nodes).filter(
    (node) =>
      node.type === 'zone' &&
      node.id !== excludeId &&
      node.floor?.support === 'open' &&
      node.parentId === zone.parentId &&
      area(
        intersection(
          { outer: polygon, holes: zone.holes },
          { outer: node.polygon, holes: node.holes },
        ),
      ) > 1e-6,
  )
  if (overlapping.length)
    return fail(
      'overlaps-mezzanine',
      'I soppalchi non devono sovrapporsi.',
      overlapping.map((node) => node.id),
    )
  return mezzanineElevationConflict(nodes, zone)
}
