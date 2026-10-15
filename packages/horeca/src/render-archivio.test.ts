import { describe, expect, test } from 'bun:test'
import {
  idProgettoDaUrl,
  nomeFile,
  ordina,
  type RenderSalvato,
  zipDeiRender,
} from './render-archivio'

const render = (id: string, creato: string): RenderSalvato => ({
  id,
  progetto: 'p',
  creato,
  png: new Blob([id]),
  width: 10,
  height: 5,
  nellaTavola: true,
})

describe('render archive', () => {
  test('reads the project id from the editor address', () => {
    expect(idProgettoDaUrl('/project/6d4ba6f4f79e')).toBe('6d4ba6f4f79e')
    expect(idProgettoDaUrl('/project/abc?x=1')).toBe('abc')
    expect(idProgettoDaUrl('/')).toBeNull()
  })

  test('oldest first, numbered file names', () => {
    const list = ordina([render('b', '2026-10-15T10:00:00Z'), render('a', '2026-10-15T09:00:00Z')])
    expect(list.map((r) => r.id)).toEqual(['a', 'b'])
    expect(nomeFile(0)).toBe('render-01.png')
    expect(nomeFile(11)).toBe('render-12.png')
  })

  test('the zip holds the renders in order', async () => {
    const blob = await zipDeiRender([
      render('uno', '2026-10-15T09:00:00Z'),
      render('due', '2026-10-15T10:00:00Z'),
    ])
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const text = new TextDecoder().decode(bytes)
    expect(text.indexOf('render-01.png')).toBeLessThan(text.indexOf('render-02.png'))
    expect(text).toContain('uno')
    expect(text).toContain('due')
  })
})
