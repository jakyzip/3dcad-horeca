import { expect, test } from 'bun:test'
import { asNewDrawing, crmLinkHostId, readCrmLink, relink, withCrmLink } from './crm-link'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const D = '33333333-3333-4333-8333-333333333333'
const N = '44444444-4444-4444-8444-444444444444'

test('the link lives on the site, else the building', () => {
  expect(
    crmLinkHostId({
      l: { id: 'l', type: 'level', parentId: 'b' },
      b: { id: 'b', type: 'building', parentId: 's' },
      s: { id: 's', type: 'site', parentId: null },
    }),
  ).toBe('s')
  expect(crmLinkHostId({ b: { id: 'b', type: 'building', parentId: null } })).toBe('b')
  expect(crmLinkHostId({})).toBeNull()
})

test('same customer keeps the CRM drawing; another customer starts a new one', () => {
  const first = relink(null, { id: A, name: 'Bar Rossi' }, { id: D, title: 'Laboratorio' }, () => N)
  expect(first.drawing_id).toBe(N)
  const sameCustomer = relink(
    first,
    { id: A, name: 'Bar Rossi' },
    { id: D, title: 'Altra' },
    () => B,
  )
  expect(sameCustomer.drawing_id).toBe(N)
  const other = relink(first, { id: B, name: 'Gelateria' }, { id: D, title: 'X' }, () => B)
  expect(other.drawing_id).toBe(B)
})

test('reads back what it stores, and ignores broken links', () => {
  const link = relink(null, { id: A.toUpperCase(), name: 'Bar' }, { id: D, title: 'T' }, () => N)
  const metadata = withCrmLink({ altro: 1 }, link)
  expect(metadata.altro).toBe(1)
  expect(readCrmLink(metadata)).toEqual({ ...link, account_id: A })
  expect(readCrmLink({ crm: { ...link, deal_id: 'x' } })).toBeNull()
  expect(readCrmLink(undefined)).toBeNull()
})

test('a new CRM drawing keeps customer and deal', () => {
  const link = relink(null, { id: A, name: 'Bar' }, { id: D, title: 'T' }, () => N)
  const copy = asNewDrawing(link, () => B.toUpperCase())
  expect(copy).toEqual({ ...link, drawing_id: B })
})
