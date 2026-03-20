<script setup lang="ts">
/**
 * Page de test Sentry + Discord : un bouton erreur front (Nuxt), un bouton erreur back (Edge Function).
 * Accès réservé aux utilisateurs admin (user_profiles.is_admin).
 */
import * as Sentry from '@sentry/nuxt'
import { PhBug } from '@phosphor-icons/vue'
import { getSentryDisabledMessage, resolveSentryReporting } from '~/utils/sentry-reporting'
import { getAuthenticatedHeaders } from '~/utils/supabase-auth'

definePageMeta({ middleware: ['admin'] })

useHead({
  title: 'Test Sentry & Discord — YumiScan',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

const config = useRuntimeConfig()
const supabase = useSupabase()
const loading = ref(false)
const frontMessage = ref<string | null>(null)
const backMessage = ref<string | null>(null)
const sentryReporting = resolveSentryReporting({
  dsn: config.public.sentry?.dsn,
  environment: config.public.sentry?.environment,
  forceEnable: config.public.sentry?.forceEnable,
})

function triggerErrorFront() {
  frontMessage.value = null

  if (!sentryReporting.enabled) {
    frontMessage.value = getSentryDisabledMessage(sentryReporting)
    return
  }

  const err = new Error('[Test] Erreur front — page example-error')
  Sentry.captureException(err)
  frontMessage.value = 'Erreur de test envoyée à Sentry (area: front). Vérifiez Discord.'
}

async function triggerErrorBack() {
  loading.value = true
  backMessage.value = null
  try {
    const url = `${config.public.supabaseUrl}/functions/v1/sentry-test-error`
    const headers = await getAuthenticatedHeaders(supabase, config.public.supabaseKey)
    if (!headers) {
      backMessage.value = 'Session invalide. Reconnecte-toi pour tester l’erreur back.'
      return
    }
    const res = await fetch(url, { method: 'POST', headers })
    const data = await res.json().catch(() => ({}))
    backMessage.value = data.message ?? data.error ?? (res.ok ? `Réponse inattendue (pas d'erreur).` : `HTTP ${res.status}`)
  } catch (e) {
    backMessage.value = e instanceof Error ? e.message : 'Erreur réseau ou CORS.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-background pt-4 pb-24 md:pt-20 md:pb-0">
    <main id="main-content" class="flex-1 container mx-auto px-4 py-8 max-w-lg">
      <div class="flex items-center gap-2 mb-6">
        <PhBug :size="24" weight="duotone" class="text-primary" />
        <h1 class="text-xl font-black font-heading tracking-tight uppercase">Test Sentry & Discord</h1>
      </div>

      <p class="text-xs text-muted-foreground font-medium mb-6">
        Déclencher une erreur <strong>front</strong> (Nuxt, tag area: front) ou <strong>back</strong> (Edge Function, tag area: back) et vérifier la notification sur Discord.
      </p>

      <section
        class="bold-card--static p-6 mb-6"
        style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius); box-shadow: var(--bold-shadow-sm);"
      >
        <div class="flex flex-wrap gap-3">
          <AppButton
            id="errorBtnFront"
            variant="primary"
            size="md"
            pill
            @click="triggerErrorFront"
          >
            Erreur front
          </AppButton>
          <AppButton
            id="errorBtnBack"
            variant="secondary"
            size="md"
            pill
            :disabled="loading"
            @click="triggerErrorBack"
          >
            {{ loading ? 'Envoi…' : 'Erreur back' }}
          </AppButton>
        </div>
        <p v-if="frontMessage" class="mt-4 text-sm text-muted-foreground">
          {{ frontMessage }}
        </p>
        <p v-if="backMessage" class="mt-2 text-sm text-muted-foreground">
          {{ backMessage }}
        </p>
      </section>

      <AppButton to="/app/admin" variant="ghost" size="sm" pill>
        ← Retour au back-office
      </AppButton>
    </main>
  </div>
</template>
