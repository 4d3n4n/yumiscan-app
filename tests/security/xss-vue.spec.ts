/**
 * Test de non-régression : aucune utilisation de v-html dans les fichiers Vue.
 * v-html rend du HTML brut non échappé → risque XSS si le contenu vient de l’utilisateur ou de l’API.
 * Vue échappe déjà tout ce qui est dans {{ }} ; v-html est la principale faille côté template.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const ROOT = process.cwd()
const IGNORE_DIRS = new Set(['node_modules', '.nuxt', 'dist', '.git'])

function* getVueFiles(dir: string, base = ''): Generator<string> {
  const fullPath = base ? join(dir, base) : dir
  const entries = readdirSync(fullPath, { withFileTypes: true })
  for (const entry of entries) {
    const rel = base ? join(base, entry.name) : entry.name
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) {
        yield* getVueFiles(dir, rel)
      }
    } else if (entry.isFile() && entry.name.endsWith('.vue')) {
      yield join(dir, rel)
    }
  }
}

describe('Sécurité XSS (Vue)', () => {
  it('aucun fichier .vue ne doit utiliser v-html (HTML non échappé = risque XSS)', () => {
    const violations: string[] = []
    for (const filePath of getVueFiles(ROOT)) {
      const content = readFileSync(filePath, 'utf-8')
      if (content.includes('v-html')) {
        const rel = filePath.replace(ROOT + '/', '')
        violations.push(rel)
      }
    }
    expect(
      violations,
      violations.length
        ? `Fichiers avec v-html (risque XSS) : ${violations.join(', ')}. Utilisez {{ }} pour le contenu dynamique.`
        : undefined
    ).toHaveLength(0)
  })
})
