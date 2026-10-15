import { beforeEach, describe, expect, test } from 'bun:test'
import type { CatalogArticle } from './catalog'
import { placementFor, shapeForArticle, shapeForCategory, useHorecaCatalog } from './catalog-store'
import {
  ABBATTITORE,
  BANCO_FRIGO,
  CELLA_FRIGO,
  GENERICO,
  LAVAMANI,
  LAVASTOVIGLIE,
  LAVELLO,
  TAVOLO,
} from './schema'

const article = (over: Partial<CatalogArticle> = {}): CatalogArticle => ({
  item_id: '',
  code: 'BF-150',
  name: 'Banco frigo 150',
  category: 'Banchi refrigerati',
  width_mm: 1500,
  depth_mm: 700,
  height_mm: 850,
  source: 'file',
  ...over,
})

beforeEach(() =>
  useHorecaCatalog.setState({ articles: [], shapes: {}, crmSession: null, crmSince: null }),
)

describe('catalog store', () => {
  test('importing a file replaces the file articles and keeps the CRM ones', () => {
    const store = useHorecaCatalog.getState()
    store.importArticles([article({ code: 'CRM-1', source: 'crm' })])
    store.importArticles([article({ code: 'A' })])
    store.importArticles([article({ code: 'B' })])
    expect(useHorecaCatalog.getState().articles.map((a) => a.code)).toEqual(['CRM-1', 'B'])
  })

  test('categories map to shapes; unmapped ones fall back to the generic block', () => {
    useHorecaCatalog.getState().setShape('Banchi refrigerati', BANCO_FRIGO)
    const { shapes } = useHorecaCatalog.getState()
    expect(shapeForCategory(shapes, 'Banchi refrigerati')).toBe(BANCO_FRIGO)
    expect(shapeForCategory(shapes, ' banchi REFRIGERATI ')).toBe(BANCO_FRIGO)
    expect(shapeForCategory(shapes, 'Cottura')).toBe(GENERICO)
    useHorecaCatalog.getState().setShape('Banchi refrigerati', GENERICO)
    expect(shapeForCategory(useHorecaCatalog.getState().shapes, 'Banchi refrigerati')).toBe(
      GENERICO,
    )
  })
})

describe('shape guessed from the category name', () => {
  test('known words pick a shape; a manual choice wins; unknown words stay generic', () => {
    expect(shapeForCategory({}, 'Lavelli')).toBe(LAVELLO)
    expect(shapeForCategory({}, 'Lava-mani a parete')).toBe(LAVAMANI)
    expect(shapeForCategory({}, 'Lavastoviglie')).toBe(LAVASTOVIGLIE)
    expect(shapeForCategory({}, 'Tavoli inox')).toBe(TAVOLO)
    expect(shapeForCategory({}, 'Abbattitori')).toBe(ABBATTITORE)
    expect(shapeForCategory({}, 'Celle frigorifere')).toBe(CELLA_FRIGO)
    expect(shapeForCategory({}, 'Banchi refrigerati')).toBe(BANCO_FRIGO)
    expect(shapeForCategory({ lavelli: GENERICO }, 'Lavelli')).toBe(GENERICO)
    expect(shapeForCategory({}, 'Cottura')).toBe(GENERICO)
  })
})

test('a vague category falls back to the article name', () => {
  expect(shapeForArticle({}, { category: 'Refrigerazione', name: 'Abbattitore 5 teglie' })).toBe(
    ABBATTITORE,
  )
  expect(
    shapeForArticle(
      { refrigerazione: GENERICO },
      { category: 'Refrigerazione', name: 'Abbattitore' },
    ),
  ).toBe(GENERICO)
  expect(shapeForArticle({}, { category: '', name: 'Friggitrice' })).toBe(GENERICO)
})

describe('placementFor', () => {
  test('carries the article and its sizes in metres to the placement tool', () => {
    const shapes = { 'banchi refrigerati': BANCO_FRIGO }
    expect(placementFor(article(), shapes)).toEqual({
      kind: BANCO_FRIGO,
      defaults: {
        width: 1.5,
        depth: 0.7,
        height: 0.85,
        name: 'Banco frigo 150',
        metadata: { product: { item_id: '', code: 'BF-150', name: 'Banco frigo 150' } },
      },
    })
  })

  test('missing sizes keep the shape defaults', () => {
    const placement = placementFor(
      article({ category: 'Celle', width_mm: null, depth_mm: 2000, height_mm: null }),
      { celle: CELLA_FRIGO },
    )
    expect(placement.kind).toBe(CELLA_FRIGO)
    expect(placement.defaults).toMatchObject({ depth: 2 })
    expect(placement.defaults).not.toHaveProperty('width')
  })
})
