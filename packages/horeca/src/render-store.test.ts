import { expect, test } from 'bun:test'
import { requestRender, useHorecaRender } from './render-store'
import { rilievoDefinition } from './rilievo'

test('one render at a time, answered by the canvas', async () => {
  const first = requestRender(1920, false)
  await expect(requestRender(3840, true)).rejects.toThrow('già un render')
  const request = useHorecaRender.getState().request!
  expect(request.width).toBe(1920)
  const png = new Blob(['png'], { type: 'image/png' })
  request.resolve(png)
  useHorecaRender.setState({ request: null })
  expect(await first).toBe(png)
})

test('the render helper is mounted with the pack', () => {
  expect(rilievoDefinition.system).toBeDefined()
})
