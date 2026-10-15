import type { Plugin } from '@pascal-app/core'
import type { EditorHostPanel } from '@pascal-app/editor'
import { EQUIPMENT_DEFINITIONS, EQUIPMENT_KINDS } from './definitions'
import { RILIEVO, rilievoDefinition } from './rilievo'
import { HORECA_PLUGIN_ID } from './schema'

/** The Ho.Re.Ca node pack. Load it with `extendPluginDiscovery(async () => [horecaPlugin])`. */
export const horecaPlugin: Plugin = {
  id: HORECA_PLUGIN_ID,
  apiVersion: 1,
  nodes: [...EQUIPMENT_DEFINITIONS, rilievoDefinition],
}

const panel = (name: 'AttrezzaturePanel' | 'ImpiantiPanel' | 'CrmPanel' | 'DocumentiPanel') => () =>
  import('./panel').then((m) => ({ default: m[name] }))

const shared = {
  pluginId: HORECA_PLUGIN_ID,
  defaultInstalled: true,
  description: 'Attrezzature Ho.Re.Ca e distinta materiali per il CRM.',
  summary: 'Attrezzature e distinta',
} as const

/**
 * Sidebar panels of the pack, one rail icon each. Registering them with `defaultInstalled` also
 * installs the plugin in new scenes, which is what enables its kinds (see `isNodeKindEnabled`).
 */
export const horecaHostPanels: EditorHostPanel[] = [
  {
    ...shared,
    id: 'horeca',
    label: 'Attrezzature',
    icon: { kind: 'url', src: '/icons/horeca/banco-frigo.svg' },
    component: panel('AttrezzaturePanel'),
    kinds: EQUIPMENT_KINDS,
  },
  {
    ...shared,
    id: 'horeca-impianti',
    label: 'Impianti e controlli',
    icon: { kind: 'iconify', name: 'lucide:plug-zap' },
    component: panel('ImpiantiPanel'),
  },
  {
    ...shared,
    id: 'horeca-crm',
    label: 'CRM e distinta',
    icon: { kind: 'iconify', name: 'lucide:clipboard-list' },
    component: panel('CrmPanel'),
  },
  {
    ...shared,
    id: 'horeca-documenti',
    label: 'Rilievo e documenti',
    icon: { kind: 'iconify', name: 'lucide:file-text' },
    component: panel('DocumentiPanel'),
    kinds: [RILIEVO],
  },
]

export { type CatalogArticle, type CatalogParseResult, parseCatalogFile } from './catalog'
export { placementFor, type ShapeMap, shapeForCategory, useHorecaCatalog } from './catalog-store'
export {
  bancoFrigoDefinition,
  cellaFrigoDefinition,
  EQUIPMENT_DEFINITIONS,
  EQUIPMENT_KINDS,
  genericoDefinition,
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
export { parseDxfRilievo, type RilievoData } from './dxf-import'
export { PRODUCT_METADATA_KEY, type ProductRead, ProductRef, readProductRef } from './product'
export { RILIEVO, RilievoNode, rilievoDefinition } from './rilievo'
export { equipmentSchedule } from './schedule'
export {
  ABBATTITORE,
  BANCO_FRIGO,
  BancoFrigoNode,
  CELLA_FRIGO,
  CellaFrigoNode,
  type EquipmentNode,
  FRIGORIFERO,
  GENERICO,
  GenericoNode,
  HORECA_PLUGIN_ID,
  LAVAMANI,
  LAVASTOVIGLIE,
  LAVELLO,
  LavelloNode,
  MANTECATORE,
  PASTORIZZATORE,
  PENSILE,
  TAVOLO,
  TRAMOGGIA,
} from './schema'
export { TILE_SPECS, type TileSpec, tileMaterials } from './tiles'
