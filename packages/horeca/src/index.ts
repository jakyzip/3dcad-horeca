import type { Plugin } from '@pascal-app/core'
import type { EditorHostPanel } from '@pascal-app/editor'
import { EQUIPMENT_DEFINITIONS, EQUIPMENT_KINDS } from './definitions'
import { HORECA_PLUGIN_ID } from './schema'

/** The Ho.Re.Ca node pack. Load it with `extendPluginDiscovery(async () => [horecaPlugin])`. */
export const horecaPlugin: Plugin = {
  id: HORECA_PLUGIN_ID,
  apiVersion: 1,
  nodes: EQUIPMENT_DEFINITIONS,
}

/**
 * Sidebar panel of the pack. Registering it with `defaultInstalled` also installs the plugin in
 * new scenes, which is what enables its kinds (see `isNodeKindEnabled`).
 */
export const horecaHostPanel: EditorHostPanel = {
  id: 'horeca',
  label: 'Ho.Re.Ca',
  icon: { kind: 'url', src: '/icons/horeca/banco-frigo.svg' },
  component: () => import('./panel'),
  kinds: EQUIPMENT_KINDS,
  pluginId: HORECA_PLUGIN_ID,
  defaultInstalled: true,
  description: 'Attrezzature Ho.Re.Ca e distinta materiali per il CRM.',
  summary: 'Attrezzature e distinta',
}

export {
  bancoFrigoDefinition,
  cellaFrigoDefinition,
  EQUIPMENT_DEFINITIONS,
  EQUIPMENT_KINDS,
  lavelloDefinition,
} from './definitions'
export {
  buildDistinta,
  type Distinta,
  type DistintaNode,
  type DistintaRow,
  type DrawingRef,
  distintaCsv,
  distintaHash,
  type InviaDistintaPayload,
  inviaDistintaPayload,
  MAX_QUANTITY,
  MAX_ROWS,
} from './distinta'
export { PRODUCT_METADATA_KEY, type ProductRead, ProductRef, readProductRef } from './product'
export { equipmentSchedule } from './schedule'
export {
  BANCO_FRIGO,
  BancoFrigoNode,
  CELLA_FRIGO,
  CellaFrigoNode,
  type EquipmentNode,
  HORECA_PLUGIN_ID,
  LAVELLO,
  LavelloNode,
} from './schema'
