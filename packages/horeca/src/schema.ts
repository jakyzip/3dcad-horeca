import { BaseNode, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'

export const HORECA_PLUGIN_ID = 'horeca:attrezzature'

export const BANCO_FRIGO = 'horeca:banco-frigo'
export const CELLA_FRIGO = 'horeca:cella-frigo'
export const LAVELLO = 'horeca:lavello'
/** Any catalog article whose category has no shape of its own: a block with the article's sizes. */
export const GENERICO = 'horeca:generico'
export const TAVOLO = 'horeca:tavolo'
export const PENSILE = 'horeca:pensile'
export const LAVAMANI = 'horeca:lavamani'
export const LAVASTOVIGLIE = 'horeca:lavastoviglie'
export const ABBATTITORE = 'horeca:abbattitore'
export const MANTECATORE = 'horeca:mantecatore'
export const PASTORIZZATORE = 'horeca:pastorizzatore'
export const FRIGORIFERO = 'horeca:frigorifero'
export const TRAMOGGIA = 'horeca:tramoggia'

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
    // Height of the underside above the floor: 0 for floor-standing units, set for wall-hung ones
    // (wall cabinets, hand basins). Optional so scenes saved before it load unchanged.
    elevation: z.number().min(0).max(4).default(0),
  })

export const BancoFrigoNode = equipmentShape(BANCO_FRIGO)
export type BancoFrigoNode = z.infer<typeof BancoFrigoNode>

export const CellaFrigoNode = equipmentShape(CELLA_FRIGO)
export type CellaFrigoNode = z.infer<typeof CellaFrigoNode>

export const LavelloNode = equipmentShape(LAVELLO)
export type LavelloNode = z.infer<typeof LavelloNode>

export const GenericoNode = equipmentShape(GENERICO)
export type GenericoNode = z.infer<typeof GenericoNode>

export const TavoloNode = equipmentShape(TAVOLO).extend({
  /** Lower shelf between the legs. */
  ripiano: z.boolean().default(true),
})
export type TavoloNode = z.infer<typeof TavoloNode>

export const PensileNode = equipmentShape(PENSILE).extend({
  /** Open bottom with a drying rack (pensile gocciolatoio), drips into the sink below. */
  gocciolatoio: z.boolean().default(false),
})
export type PensileNode = z.infer<typeof PensileNode>

export const LavamaniNode = equipmentShape(LAVAMANI)
export type LavamaniNode = z.infer<typeof LavamaniNode>

export const LavastoviglieNode = equipmentShape(LAVASTOVIGLIE)
export type LavastoviglieNode = z.infer<typeof LavastoviglieNode>

export const AbbattitoreNode = equipmentShape(ABBATTITORE)
export type AbbattitoreNode = z.infer<typeof AbbattitoreNode>

export const MantecatoreNode = equipmentShape(MANTECATORE)
export type MantecatoreNode = z.infer<typeof MantecatoreNode>

export const PastorizzatoreNode = equipmentShape(PASTORIZZATORE)
export type PastorizzatoreNode = z.infer<typeof PastorizzatoreNode>

export const FrigoriferoNode = equipmentShape(FRIGORIFERO)
export type FrigoriferoNode = z.infer<typeof FrigoriferoNode>

export const TramoggiaNode = equipmentShape(TRAMOGGIA)
export type TramoggiaNode = z.infer<typeof TramoggiaNode>

/** Every equipment node shares the base fields; kind-specific options are optional here. */
export type EquipmentNode = BancoFrigoNode & {
  type: string
  ripiano?: boolean
  gocciolatoio?: boolean
}
