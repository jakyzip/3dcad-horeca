import { BaseNode, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'

export const HORECA_PLUGIN_ID = 'horeca:attrezzature'

export const BANCO_FRIGO = 'horeca:banco-frigo'
export const CELLA_FRIGO = 'horeca:cella-frigo'
export const LAVELLO = 'horeca:lavello'

/**
 * Floor-placed equipment shared by every Ho.Re.Ca kind: `position` is level-local meters with y at
 * the base, `rotation` is yaw radians, and the body is a width × depth × height box in meters.
 * The catalog article lives in `metadata.product` (see `product.ts`), not in the schema, so the
 * same kinds can stand for any article of the CRM catalog.
 */
const equipmentShape = <K extends string>(kind: K, size: { max: number; maxHeight: number }) =>
  BaseNode.extend({
    id: objectId('horeca'),
    type: nodeType(kind),
    position: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
    rotation: z.number().default(0),
    // Persisted slab-support host, as on the built-in floor-placed kinds.
    supportSlabId: z.string().optional(),
    width: z.number().min(0.2).max(size.max),
    depth: z.number().min(0.2).max(size.max),
    height: z.number().min(0.2).max(size.maxHeight),
  })

export const BancoFrigoNode = equipmentShape(BANCO_FRIGO, { max: 6, maxHeight: 2.5 })
export type BancoFrigoNode = z.infer<typeof BancoFrigoNode>

export const CellaFrigoNode = equipmentShape(CELLA_FRIGO, { max: 12, maxHeight: 4 })
export type CellaFrigoNode = z.infer<typeof CellaFrigoNode>

export const LavelloNode = equipmentShape(LAVELLO, { max: 4, maxHeight: 1.5 })
export type LavelloNode = z.infer<typeof LavelloNode>

export type EquipmentNode = BancoFrigoNode | CellaFrigoNode | LavelloNode
