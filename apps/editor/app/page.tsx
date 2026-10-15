import { Settings } from 'lucide-react'
import Link from 'next/link'
import { AppHeader, AppShell, ICON_BUTTON, ProductMark } from '@/components/app-shell'
import { CreateProjectButton } from '@/components/create-project-button'
import { SceneCard, type SceneCardData } from '@/components/scene-card'
import { getSceneOperations } from '@/lib/scene-store-server'
import { sceneThumbnailUrl } from '@/lib/scene-thumbnails'
import { isTemplateName } from '@/lib/templates'

export const dynamic = 'force-dynamic'

const dateFormat = new Intl.DateTimeFormat('it-IT', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

async function fetchScenes(): Promise<SceneCardData[]> {
  const operations = await getSceneOperations()
  const scenes = await operations.listScenes({ limit: 50 })
  return Promise.all(
    scenes.map(async (scene) => ({
      id: scene.id,
      name: scene.name,
      version: scene.version,
      nodeCount: scene.nodeCount,
      thumbnailUrl: scene.thumbnailUrl ?? (await sceneThumbnailUrl(scene.id)),
      updatedAt: scene.updatedAt,
      updatedLabel: dateFormat.format(new Date(scene.updatedAt)),
    })),
  )
}

/** `Progetto #n`: one past the highest number still in use, never below the count. Older scenes were named `Project #n`. */
function nextProjectNumber(names: string[]): number {
  const highest = names.reduce((max, name) => {
    const match = /^(?:Progetto|Project) #(\d+)$/.exec(name.trim())
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  return Math.max(highest, names.length) + 1
}

export default async function HomePage() {
  const scenes = await fetchScenes()
  const nextNumber = nextProjectNumber(scenes.map((scene) => scene.name))
  const templates = scenes.filter((scene) => isTemplateName(scene.name))
  const projects = scenes.filter((scene) => !isTemplateName(scene.name))

  return (
    <AppShell>
      <AppHeader>
        <CreateProjectButton nextNumber={nextNumber} />
        <Link
          aria-label="Impostazioni"
          className={ICON_BUTTON}
          href="/settings"
          title="Impostazioni"
        >
          <Settings className="h-4 w-4" />
        </Link>
      </AppHeader>

      <main className="mx-auto max-w-6xl px-6 py-10">
        {scenes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-32 text-center">
            <ProductMark className="h-10 w-10" />
            <p className="max-w-xs text-muted-foreground text-sm">
              Qui trovi i tuoi progetti. Creane uno per iniziare a disegnare.
            </p>
            <CreateProjectButton nextNumber={nextNumber} />
          </div>
        ) : (
          <>
            {templates.length > 0 && (
              <section className="mb-10">
                <h1 className="mb-1 font-semibold text-lg">Modelli</h1>
                <p className="mb-6 text-muted-foreground text-sm">
                  Punti di partenza: “Nuovo progetto da questo modello” ne fa una copia.
                </p>
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {templates.map((scene) => (
                    <SceneCard key={scene.id} nextNumber={nextNumber} scene={scene} template />
                  ))}
                </ul>
              </section>
            )}
            <h1 className="mb-6 font-semibold text-lg">Progetti</h1>
            {projects.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Nessun progetto: creane uno nuovo o parti da un modello.
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {projects.map((scene) => (
                  <SceneCard key={scene.id} nextNumber={nextNumber} scene={scene} />
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </AppShell>
  )
}
