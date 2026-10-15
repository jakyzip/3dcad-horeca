export interface TestFile {
  name: string
  label: string
  detail: string
  description: string
  /**
   * Served from `examplesBaseUrl` instead of the repo's `public/` folder.
   * The large IFC samples (tens of MB each) aren't committed to keep the
   * open-source repo lean; they're hosted externally and fetched at
   * runtime. Marked entries only appear once a base URL is configured.
   */
  remote?: boolean
  /** Shown as a caution on the example card (e.g. heavy models that can
   * tax the browser when rendered). */
  warning?: string
}

// No default host: upstream fetched the large samples from Pascal's Supabase
// bucket. Set NEXT_PUBLIC_IFC_EXAMPLES_BASE_URL to serve your own copies.
export const examplesBaseUrl = (process.env.NEXT_PUBLIC_IFC_EXAMPLES_BASE_URL ?? '').replace(
  /\/$/,
  '',
)

// Empty on purpose: the upstream samples have no documented license (see
// docs/progetto/AUDIT_LICENZE.md). Add files only with a row in ASSETS.md.
export const testFiles: TestFile[] = []

/** Resolve where to fetch a given example from. */
export function exampleFileUrl(file: TestFile): string {
  return file.remote ? `${examplesBaseUrl}/${file.name}` : `/test-ifc-files/${file.name}`
}

/**
 * Examples to show in the picker: the committed local ones always, plus
 * the remote ones once a base URL is configured (so a fresh clone with
 * no env doesn't surface examples that would 404).
 */
export function availableTestFiles(): TestFile[] {
  if (examplesBaseUrl) return testFiles
  return testFiles.filter((f) => !f.remote)
}
