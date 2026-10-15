import { describe, expect, test } from 'bun:test'
import type { SceneGraph } from '@pascal-app/editor'
import { asTemplateName, fromTemplateName, graphFromTemplate, isTemplateName } from './templates'

describe('project templates', () => {
  test('names', () => {
    expect(isTemplateName('Modello – Gelateria')).toBe(true)
    expect(isTemplateName('modello gelateria')).toBe(true)
    expect(isTemplateName('Modellone')).toBe(false)
    expect(isTemplateName('Progetto #3')).toBe(false)
    expect(asTemplateName(' Gelateria 30 m² ')).toBe('Modello – Gelateria 30 m²')
    expect(asTemplateName('Modello – X')).toBe('Modello – X')
    expect(fromTemplateName('Modello – Gelateria')).toBe('Gelateria')
    expect(fromTemplateName('Modello - Gelateria')).toBe('Gelateria')
    expect(fromTemplateName('Modello')).toBe('Progetto senza nome')
  })

  test('a copy keeps everything but the CRM link, and leaves the template untouched', () => {
    const graph = {
      nodes: {
        site_a: {
          id: 'site_a',
          type: 'site',
          metadata: { crm: { drawing_id: 'x' }, controlli: { passaggio: 1 } },
        },
        horeca_b: { id: 'horeca_b', type: 'horeca:lavello', metadata: { product: { code: 'L' } } },
      },
      rootNodeIds: ['site_a'],
    } as unknown as SceneGraph
    const copy = graphFromTemplate(graph) as unknown as {
      nodes: Record<string, { metadata: Record<string, unknown> }>
    }
    expect(copy.nodes.site_a!.metadata).toEqual({ controlli: { passaggio: 1 } })
    expect(copy.nodes.horeca_b!.metadata).toEqual({ product: { code: 'L' } })
    expect(
      (graph.nodes as Record<string, { metadata: Record<string, unknown> }>).site_a!.metadata.crm,
    ).toBeDefined()
  })
})
