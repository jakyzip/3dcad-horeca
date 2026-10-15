import { spawn } from 'node:child_process'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fileSha256 } from '../src/runtime-download.js'
import { createRuntimeArchive } from '../src/tar.js'
import { formatMegabytes, stageWebRuntime } from './web-runtime.js'

const packageDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = path.resolve(packageDirectory, '../..')
const appDirectory = path.join(repositoryRoot, 'apps/editor')
const standaloneAppDirectory = path.join(appDirectory, '.next/standalone/apps/editor')
/**
 * The web runtime is a release asset, not part of the npm package: it is staged and archived
 * under `build/`, while `dist/` only gains the MCP service and the digest of that archive.
 */
const buildDirectory = path.join(packageDirectory, 'build')
const outputDirectory = path.join(buildDirectory, 'runtime')
const releaseAssetBaseUrl = 'https://github.com/pascalorg/editor/releases/download'

const packageJson = JSON.parse(
  await readFile(path.join(packageDirectory, 'package.json'), 'utf8'),
) as {
  version: string
}

const archiveName = `pascal-web-runtime-${packageJson.version}.tar.gz`
const archiveFile = path.join(buildDirectory, archiveName)
const assetUrl = `${releaseAssetBaseUrl}/@pascal-app/cli@${packageJson.version}/${archiveName}`

await chmod(path.join(packageDirectory, 'dist/bin/pascal.js'), 0o755)
await bundleMcpServer(
  path.join(packageDirectory, 'dist/services/pascal-mcp.mjs'),
  packageJson.version,
)
await bundleMcpServer(
  path.join(packageDirectory, 'dist/services/geometry-script-worker.js'),
  packageJson.version,
  'packages/mcp/src/tools/geometry-script-worker.ts',
)
await assertFile(path.join(standaloneAppDirectory, 'server.js'))
await stageWebRuntime(appDirectory, outputDirectory)

await writeFile(
  path.join(outputDirectory, 'runtime-manifest.json'),
  `${JSON.stringify(
    { schemaVersion: 2, version: packageJson.version, entrypoint: 'apps/editor/server.js' },
    null,
    2,
  )}\n`,
)

const archive = await createRuntimeArchive(outputDirectory, archiveFile)
const sha256 = await fileSha256(archiveFile)
await writeFile(`${archiveFile}.sha256`, `${sha256}  ${archiveName}\n`)
await writeFile(
  path.join(packageDirectory, 'dist/runtime-source.json'),
  `${JSON.stringify(
    { version: packageJson.version, url: assetUrl, sha256, size: archive.size },
    null,
    2,
  )}\n`,
)

console.log(`Staged Pascal web runtime ${packageJson.version} at ${outputDirectory}`)
console.log(
  `Archived ${archive.entryCount} entries to ${archiveFile} (${formatMegabytes(archive.size)} MB)`,
)
console.log(`Digest ${sha256}`)
console.log(`Release asset ${assetUrl}`)

async function bundleMcpServer(
  output: string,
  version: string,
  entry = 'packages/mcp/src/bin/pascal-mcp.ts',
): Promise<void> {
  await mkdir(path.dirname(output), { recursive: true })
  const child = spawn(
    process.execPath,
    [
      'build',
      path.join(repositoryRoot, entry),
      '--outfile',
      output,
      '--target',
      'node',
      '--format',
      'esm',
      '--define',
      `process.env.PASCAL_MCP_VERSION=${JSON.stringify(version)}`,
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  )
  const stderr: Buffer[] = []
  child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk))
  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code) => resolve(code ?? 1))
  })
  if (exitCode !== 0) {
    throw new Error(`Unable to bundle the Pascal MCP server: ${Buffer.concat(stderr).toString()}`)
  }
}

async function assertFile(filePath: string): Promise<void> {
  try {
    await readFile(filePath)
  } catch {
    throw new Error(
      `standalone editor build not found at ${filePath}; run PASCAL_PORTABLE_BUILD=1 bun run build from apps/editor first`,
    )
  }
}
