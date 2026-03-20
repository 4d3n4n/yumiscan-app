/**
 * Tests i18n : validité des JSON, parité des clés FR/EN, présence des clés critiques utilisées dans l'app.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { blogArticles } from '../../data/blog'

const LOCALES_DIR = join(process.cwd(), 'i18n', 'locales')
const LOCALE_CODES = ['fr', 'en'] as const
const LOCALE_FILES = ['common.json', 'home.json', 'onboarding.json', 'auth.json', 'scan.json', 'account.json', 'legal.json', 'blog.json', 'about.json', 'pricing.json']

type MessageRecord = Record<string, unknown>

/** Retourne toutes les clés "chemin" d'un objet (ex: common.footer.rights, home.pricing.intro_spans.0). */
function getAllKeyPaths(obj: unknown, prefix = ''): string[] {
  if (obj === null || obj === undefined) return []
  if (Array.isArray(obj)) {
    const keys: string[] = []
    for (let i = 0; i < obj.length; i++) {
      const indexKey = prefix ? `${prefix}.${i}` : `${i}`
      keys.push(indexKey)
      keys.push(...getAllKeyPaths(obj[i], indexKey))
    }
    return keys
  }
  if (typeof obj === 'object') {
    let keys: string[] = []
    for (const [k, v] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${k}` : k
      keys.push(fullKey)
      keys = keys.concat(getAllKeyPaths(v, fullKey))
    }
    return keys
  }
  return []
}

function loadLocaleMessages(locale: string): MessageRecord {
  const merged: MessageRecord = {}
  for (const file of LOCALE_FILES) {
    const filePath = join(LOCALES_DIR, locale, file)
    try {
      const raw = readFileSync(filePath, 'utf-8')
      const data = JSON.parse(raw) as MessageRecord
      Object.assign(merged, data)
    } catch (err) {
      throw new Error(`Failed to load ${filePath}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return merged
}

describe('i18n — fichiers de traduction', () => {
  it('charge tous les JSON FR et EN sans erreur', () => {
    for (const code of LOCALE_CODES) {
      const messages = loadLocaleMessages(code)
      expect(Object.keys(messages).length).toBeGreaterThan(0)
    }
  })

  it('FR et EN ont la même structure de clés (pas de clé manquante)', () => {
    const frMessages = loadLocaleMessages('fr')
    const enMessages = loadLocaleMessages('en')
    const frKeys = new Set(getAllKeyPaths(frMessages))
    const enKeys = new Set(getAllKeyPaths(enMessages))
    const missingInEn = [...frKeys].filter((k) => !enKeys.has(k))
    const missingInFr = [...enKeys].filter((k) => !frKeys.has(k))
    expect(
      missingInEn,
      `Clés présentes en FR mais absentes en EN. Compléter en/ : ${missingInEn.slice(0, 20).join(', ')}${missingInEn.length > 20 ? '...' : ''}`,
    ).toHaveLength(0)
    expect(
      missingInFr,
      `Clés présentes en EN mais absentes en FR. Compléter fr/ : ${missingInFr.slice(0, 20).join(', ')}${missingInFr.length > 20 ? '...' : ''}`,
    ).toHaveLength(0)
  })

  it('les clés critiques (footer, home, common) existent dans les deux langues', () => {
    const criticalPaths = [
      'common.footer.rights',
      'common.footer.version',
      'common.footer.links.blog',
      'common.footer.links.contact',
      'common.footer.links.about',
      'common.footer.links.cgv',
      'common.footer.links.legal',
      'common.footer.links.privacy',
      'common.footer.links.cgu',
      'common.footer.links.health',
      'common.footer.links.cookies',
      'common.footer.credit',
      'common.language_switch',
      'common.cookie_banner.title',
      'home.seo.title',
      'home.seo.description',
      'home.intro.badge',
      'home.intro.title_scannez',
      'home.intro.title_protegez',
      'home.faq.title',
      'home.faq.items.q1',
      'home.faq.items.a1',
      'home.faq.items.q10',
      'home.faq.items.a10',
      'home.reviews.title',
      'home.reviews.items.fb.quote',
      'home.pricing.title',
      'home.cta_banner.title',
      'home.cta_banner.desc',
      'home.pricing.intro_spans.0',
      'home.steps.title',
      'home.steps.phase_0',
      'onboarding.skip',
      'onboarding.slides.slide_1.title',
      'onboarding.slides.slide_4.desktop.step_1',
      'account.dashboard.meta_title',
      'account.dashboard.header_history',
      'account.dashboard.empty_title',
      'account.dashboard.delete_modal.title',
      'legal.privacy.meta_title',
      'about.meta_title',
      'about.story_title',
      'about.cta.guest.button',
      'about.cta.user.button',
      'terms.meta_title',
      'terms.company_title',
      'terms.support_p1',
      'blog.signup_cta.guest.title',
      'blog.signup_cta.guest.button',
      'blog.signup_cta.user.title',
      'blog.signup_cta.user.button',
      'scan.scan.progress.hints.decision_reading.title',
      'scan.scan.progress.hints.final_verdict.description',
    ]
    for (const code of LOCALE_CODES) {
      const messages = loadLocaleMessages(code)
      const allPaths = new Set(getAllKeyPaths(messages))
      for (const path of criticalPaths) {
        expect(allPaths.has(path), `[${code}] Clé manquante: ${path}`).toBe(true)
      }
    }
  })

  it('toutes les clés i18n littérales utilisées dans les vues existent', () => {
    const vueRoots = ['pages', 'components', 'layouts']
    const keyPatterns = [
      /\b(?:t|tm|\$t)\(\s*['"]([^'"]+)['"]/g,
      /<i18n-t[^>]*keypath="([^"]+)"/g,
      /<i18n-t[^>]*keypath='([^']+)'/g,
    ]

    function collectVueFiles(dir: string): string[] {
      const out: string[] = []
      for (const entry of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
        const filePath = join(process.cwd(), dir, entry.name)
        if (entry.isDirectory()) out.push(...collectVueFiles(join(dir, entry.name)))
        else if (entry.isFile() && entry.name.endsWith('.vue')) out.push(filePath)
      }
      return out
    }

    function hasPath(obj: Record<string, unknown>, key: string): boolean {
      return key.split('.').every((segment) => {
        if (obj && typeof obj === 'object' && segment in obj) {
          obj = obj[segment] as Record<string, unknown>
          return true
        }
        return false
      })
    }

    const usedKeys = new Map<string, string>()
    for (const root of vueRoots) {
      for (const filePath of collectVueFiles(root)) {
        const raw = readFileSync(filePath, 'utf-8')
        for (const pattern of keyPatterns) {
          for (const match of raw.matchAll(pattern)) {
            const key = match[1]
            if (!key || key.includes('${')) continue
            usedKeys.set(key, filePath)
          }
        }
      }
    }

    for (const code of LOCALE_CODES) {
      const messages = loadLocaleMessages(code)
      const missing = [...usedKeys.entries()]
        .filter(([key]) => !hasPath(messages, key))
        .map(([key, filePath]) => `${key} :: ${filePath.replace(`${process.cwd()}/`, '')}`)

      expect(
        missing,
        `[${code}] Clés utilisées dans les vues mais absentes des locales: ${missing.slice(0, 20).join(', ')}${missing.length > 20 ? '...' : ''}`,
      ).toHaveLength(0)
    }
  })

  it('chaque article de blog a ses messages et paragraphes dans les deux langues', () => {
    function getPath(obj: Record<string, unknown>, key: string): unknown {
      return key.split('.').reduce<unknown>((acc, segment) => {
        if (acc && typeof acc === 'object' && segment in (acc as Record<string, unknown>)) {
          return (acc as Record<string, unknown>)[segment]
        }
        return undefined
      }, obj)
    }

    for (const code of LOCALE_CODES) {
      const messages = loadLocaleMessages(code)
      for (const article of blogArticles) {
        const basePath = `blog.articles.${article.slug}`
        for (const suffix of ['title', 'metaTitle', 'metaDescription', 'excerpt', 'body']) {
          expect(getPath(messages, `${basePath}.${suffix}`), `[${code}] Champ blog manquant: ${basePath}.${suffix}`).toBeTruthy()
        }

        const body = getPath(messages, `${basePath}.body`)
        const bodyEntries = Array.isArray(body)
          ? body
          : body && typeof body === 'object'
            ? Object.values(body as Record<string, unknown>)
            : []

        expect(bodyEntries.length, `[${code}] Article sans paragraphes: ${basePath}.body`).toBeGreaterThan(0)
        expect(
          bodyEntries.every((entry) => typeof entry === 'string' && entry.length > 0),
          `[${code}] Article avec paragraphe vide/invalide: ${basePath}.body`,
        ).toBe(true)

        for (const tagKey of article.tags) {
          expect(getPath(messages, `${basePath}.tags.${tagKey}`), `[${code}] Tag blog manquant: ${basePath}.tags.${tagKey}`).toBeTruthy()
        }
      }
    }
  })
})
