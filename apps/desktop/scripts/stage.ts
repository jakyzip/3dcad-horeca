/**
 * Builds the editor as a standalone server and stages it in `build/runtime`, the folder the
 * installers carry. Same staging as the CLI's portable runtime (`packages/cli/scripts/web-runtime.ts`).
 *
 * Run from apps/desktop: `bun run stage`
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stageWebRuntime } from '../../../packages/cli/scripts/web-runtime'

const desktopDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const editorDirectory = path.resolve(desktopDirectory, '../editor')

const build = spawnSync('bun', ['run', 'build'], {
  cwd: editorDirectory,
  stdio: 'inherit',
  env: { ...process.env, PASCAL_PORTABLE_BUILD: '1' },
})
if (build.status !== 0) process.exit(build.status ?? 1)

await stageWebRuntime(editorDirectory, path.join(desktopDirectory, 'build/runtime'))
console.log('Runtime pronto in apps/desktop/build/runtime')
