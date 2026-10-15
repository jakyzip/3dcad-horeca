import type { AnyNodeId } from '@pascal-app/core'

/**
 * Which CRM drawing, customer and deal this scene is sent to. It lives in the scene (metadata of
 * the site node, else the building) so it travels with the project, as the Rust CAD keeps it in
 * the DWG. `drawing_id` is ours: the CRM files the distinta under it, so re-sending updates the
 * same drawing instead of adding one.
 */

export const CRM_LINK_KEY = 'crm'

export type CrmLink = {
  drawing_id: string
  account_id: string
  account_name: string
  deal_id: string
  deal_name: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const LABEL_MAX = 200

type HostNode = { id: string; type: string; parentId?: string | null; metadata?: unknown }

/** The node that carries the link: the site, else a building, else a top-level node. */
export function crmLinkHostId(nodes: Readonly<Record<string, unknown>>): AnyNodeId | null {
  const list = Object.values(nodes) as HostNode[]
  const host =
    list.find((n) => n.type === 'site') ??
    list.find((n) => n.type === 'building') ??
    list.find((n) => !n.parentId)
  return (host?.id as AnyNodeId | undefined) ?? null
}

export function readCrmLink(metadata: unknown): CrmLink | null {
  const raw = (metadata as Record<string, unknown> | undefined)?.[CRM_LINK_KEY]
  if (!raw || typeof raw !== 'object') return null
  const v = raw as Record<string, unknown>
  const id = (key: string) => (typeof v[key] === 'string' ? (v[key] as string).toLowerCase() : '')
  const label = (key: string) => (typeof v[key] === 'string' ? (v[key] as string) : '')
  const link = {
    drawing_id: id('drawing_id'),
    account_id: id('account_id'),
    account_name: label('account_name'),
    deal_id: id('deal_id'),
    deal_name: label('deal_name'),
  }
  return UUID.test(link.drawing_id) && UUID.test(link.account_id) && UUID.test(link.deal_id)
    ? link
    : null
}

/**
 * The link after choosing a customer and deal. The drawing keeps its CRM id while the customer
 * stays the same; a drawing reused for another customer becomes a new CRM drawing.
 */
export function relink(
  previous: CrmLink | null,
  account: { id: string; name: string },
  deal: { id: string; title: string },
  newId: () => string = () => crypto.randomUUID(),
): CrmLink {
  const accountId = account.id.toLowerCase()
  return {
    drawing_id:
      previous && previous.account_id === accountId ? previous.drawing_id : newId().toLowerCase(),
    account_id: accountId,
    account_name: account.name.slice(0, LABEL_MAX),
    deal_id: deal.id.toLowerCase(),
    deal_name: deal.title.slice(0, LABEL_MAX),
  }
}

/** The host's metadata with the link set. */
export const withCrmLink = (metadata: unknown, link: CrmLink): Record<string, unknown> => ({
  ...((metadata as Record<string, unknown> | undefined) ?? {}),
  [CRM_LINK_KEY]: link,
})

/** Same customer and deal, but a new CRM drawing: for a copy of a project that must stay apart. */
export const asNewDrawing = (
  link: CrmLink,
  newId: () => string = () => crypto.randomUUID(),
): CrmLink => ({
  ...link,
  drawing_id: newId().toLowerCase(),
})
