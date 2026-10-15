import { z } from 'zod'

/**
 * The catalog article a node stands for, kept in `node.metadata.product`. Same fields the CRM's
 * `invia_distinta` takes for a row: `item_id` is the CRM catalog id (`catalog_items.id`), `code`
 * and `name` are copies for display, so a drawing reads well without the catalog at hand.
 */
export const ProductRef = z.object({
  // Empty for an article not (yet) in the CRM catalog, e.g. one imported from a file.
  item_id: z.string().default(''),
  code: z.string().default(''),
  name: z.string().default(''),
})
export type ProductRef = z.infer<typeof ProductRef>

export const PRODUCT_METADATA_KEY = 'product'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ProductRead =
  | { kind: 'article'; ref: ProductRef }
  /** An article with a code but no CRM id: drawn and listed, never sent to the CRM. */
  | { kind: 'local'; ref: ProductRef }
  /** Product data is there but unusable (e.g. an id edited by hand): reported, never counted. */
  | { kind: 'invalid' }
  | { kind: 'none' }

/** Read and validate a node's article. Mirrors the Rust CAD's `article_of`. */
export function readProductRef(metadata: Record<string, unknown> | undefined): ProductRead {
  const raw = metadata?.[PRODUCT_METADATA_KEY]
  if (raw === undefined || raw === null) return { kind: 'none' }
  const parsed = ProductRef.safeParse(raw)
  if (!parsed.success) return { kind: 'invalid' }
  const item_id = parsed.data.item_id.trim()
  const code = parsed.data.code.trim()
  const name = parsed.data.name.trim()
  if (!item_id)
    return code ? { kind: 'local', ref: { item_id: '', code, name } } : { kind: 'invalid' }
  if (!UUID.test(item_id)) return { kind: 'invalid' }
  return { kind: 'article', ref: { item_id: item_id.toLowerCase(), code, name } }
}
