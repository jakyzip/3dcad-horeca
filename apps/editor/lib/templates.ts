import type { SceneGraph } from '@pascal-app/editor'

/**
 * Project templates are ordinary projects whose name starts with "Modello": edited like any
 * project, listed apart on the home page, copied into a new project on request.
 */
export const TEMPLATE_PREFIX = 'Modello – '

const TEMPLATE_NAME = /^modello\b\s*[–-]?\s*/i

export const isTemplateName = (name: string) => TEMPLATE_NAME.test(name.trim())

export function asTemplateName(name: string): string {
  return isTemplateName(name) ? name.trim() : `${TEMPLATE_PREFIX}${name.trim()}`
}

/** The name without the prefix, else "Progetto senza nome" when nothing is left. */
export function fromTemplateName(name: string): string {
  return name.trim().replace(TEMPLATE_NAME, '').trim() || 'Progetto senza nome'
}

/** Per-drawing data a copy must not inherit: the CRM link (a new project is a new drawing). */
const DRAWING_METADATA = ['crm']

/** A copy of the template's graph for a new project. */
export function graphFromTemplate(graph: SceneGraph): SceneGraph {
  const copy = structuredClone(graph)
  for (const node of Object.values(copy.nodes) as Array<{ metadata?: Record<string, unknown> }>) {
    if (!node.metadata) continue
    for (const key of DRAWING_METADATA) delete node.metadata[key]
  }
  return copy
}
