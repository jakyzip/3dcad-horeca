import { describe, expect, test } from 'bun:test'
import { parseCatalogFile } from './catalog'

const A = 'a0000000-0000-4000-8000-000000000001'

describe('parseCatalogFile: CSV', () => {
  test('reads Italian headers, semicolons and decimal commas', () => {
    const csv = [
      'Codice;Nome;Categoria;Larghezza mm;Profondità mm;Altezza mm;ID CRM',
      `BF-150;Banco frigo 150;Banchi refrigerati;1500;700;850;${A}`,
      'FRY-1;Friggitrice;Cottura;400,5;600;850;',
    ].join('\r\n')
    expect(parseCatalogFile('listino.csv', csv)).toEqual({
      articles: [
        {
          item_id: A,
          code: 'BF-150',
          name: 'Banco frigo 150',
          category: 'Banchi refrigerati',
          width_mm: 1500,
          depth_mm: 700,
          height_mm: 850,
          source: 'file',
        },
        {
          item_id: '',
          code: 'FRY-1',
          name: 'Friggitrice',
          category: 'Cottura',
          width_mm: 400.5,
          depth_mm: 600,
          height_mm: 850,
          source: 'file',
        },
      ],
      errors: [],
    })
  })

  test('reads English headers with commas and quoted fields', () => {
    const csv =
      'code,name,category,width_mm,depth_mm,height_mm\n"T-1","Tavolo, inox",Tavoli,1200,700,900\n'
    const { articles, errors } = parseCatalogFile('x.csv', csv)
    expect(errors).toEqual([])
    expect(articles[0]).toMatchObject({ code: 'T-1', name: 'Tavolo, inox', width_mm: 1200 })
  })

  test('reports bad rows by line and keeps the good ones', () => {
    const csv = [
      'codice;nome;larghezza_mm;profondita_mm;altezza_mm;item_id',
      ';Senza codice;1000;600;900;',
      'X;Misura sbagliata;abc;600;900;',
      'Y;ID sbagliato;1000;600;900;123',
      'Z;Buono;1000;600;900;',
      'Z;Doppio;1000;600;900;',
    ].join('\n')
    const { articles, errors } = parseCatalogFile('x.csv', csv)
    expect(articles.map((a) => a.code)).toEqual(['Z'])
    expect(errors).toEqual([
      'Riga 2: manca il codice.',
      'Riga 3: larghezza non valida ("abc").',
      'Riga 4: ID CRM non valido ("123").',
      'Riga 6: codice Z ripetuto, tengo la prima riga.',
    ])
  })

  test('missing sizes are allowed: the shape uses its own defaults', () => {
    const { articles } = parseCatalogFile('x.csv', 'codice;nome\nL-1;Lavello\n')
    expect(articles[0]).toMatchObject({
      code: 'L-1',
      width_mm: null,
      depth_mm: null,
      height_mm: null,
    })
  })

  test('a file without a code column is refused as a whole', () => {
    expect(parseCatalogFile('x.csv', 'nome;prezzo\nA;1\n')).toEqual({
      articles: [],
      errors: ['Il file non ha una colonna "codice" (o "code").'],
    })
  })
})

describe('parseCatalogFile: JSON', () => {
  test('reads an array of CRM-like catalog rows', () => {
    const json = JSON.stringify([
      {
        id: A,
        code: 'BF-150',
        name: 'Banco frigo',
        category: 'Banchi',
        width_mm: 1500,
        depth_mm: 700,
        height_mm: 850,
      },
      { code: 'X', name: 'Senza misure' },
    ])
    const { articles, errors } = parseCatalogFile('catalogo.json', json)
    expect(errors).toEqual([])
    expect(articles.map((a) => [a.item_id, a.code, a.width_mm])).toEqual([
      [A, 'BF-150', 1500],
      ['', 'X', null],
    ])
  })

  test('also accepts { items: [...] } and reports broken JSON', () => {
    expect(parseCatalogFile('c.json', '{"items":[{"code":"A"}]}').articles).toHaveLength(1)
    expect(parseCatalogFile('c.json', '{oops').errors).toEqual(['Il file JSON non è leggibile.'])
  })
})
