import { BaseNode, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'

export const HORECA_PLUGIN_ID = 'horeca:attrezzature'

export const BANCO_FRIGO = 'horeca:banco-frigo'
export const CELLA_FRIGO = 'horeca:cella-frigo'
export const LAVELLO = 'horeca:lavello'
/** Any catalog article whose category has no shape of its own: a block with the article's sizes. */
export const GENERICO = 'horeca:generico'

/**
 * Floor-placed equipment shared by every Ho.Re.Ca kind: `position` is level-local meters with y at
 * the base, `rotation` is yaw radians, and the body is a width × depth × height box in meters.
 * The catalog article lives in `metadata.product` (see `product.ts`), not in the schema, so the
 * same kinds can stand for any article of the CRM catalog.
 */
const equipmentShape = <K extends string>(kind: K) =>
  BaseNode.extend({
    id: objectId('horeca'),
    type: nodeType(kind),
    position: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
    rotation: z.number().default(0),
    // Persisted slab-support host, as on the built-in floor-placed kinds.
    supportSlabId: z.string().optional(),
    // Wide bounds: catalog sizes come from the CRM and must never make placement fail.
    width: z.number().min(0.05).max(30),
    depth: z.number().min(0.05).max(30),
    height: z.number().min(0.05).max(8),
  })

export const BancoFrigoNode = equipmentShape(BANCO_FRIGO)
export type BancoFrigoNode = z.infer<typeof BancoFrigoNode>

export const CellaFrigoNode = equipmentShape(CELLA_FRIGO)
export type CellaFrigoNode = z.infer<typeof CellaFrigoNode>

export const LavelloNode = equipmentShape(LAVELLO)
export type LavelloNode = z.infer<typeof LavelloNode>

export const GenericoNode = equipmentShape(GENERICO)
export type GenericoNode = z.infer<typeof GenericoNode>

export type EquipmentNode = BancoFrigoNode | CellaFrigoNode | LavelloNode | GenericoNode
