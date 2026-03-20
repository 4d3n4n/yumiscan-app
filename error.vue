<script setup lang="ts">
import type { NuxtError } from '#app'
import { EMOJI_MAP, APP_EMOJI } from '~/utils/emojis'
import { isExpectedError } from '~/utils/sentry-expected-errors'

const props = defineProps<{ error: NuxtError }>()

const is404 = computed(() => props.error?.statusCode === 404)
const isExpected = computed(() => isExpectedError(props.error))
const showReportButton = computed(() => !is404.value && !isExpected.value && !!lastEventId.value)

const lastEventId = ref<string | null>(null)
onMounted(() => {
  if (import.meta.client) {
    import('@sentry/vue').then((Sentry) => {
      lastEventId.value = Sentry.lastEventId() ?? null
    })
  }
})

const emojiName = computed(() => (is404.value ? APP_EMOJI.notFound : APP_EMOJI.serverError))
const title = computed(() => (is404.value ? 'Page introuvable' : 'Oups, quelque chose a cassé'))
const description = computed(() =>
  is404.value
    ? "La page que vous cherchez n'existe pas ou a été déplacée."
    : "Une erreur inattendue s'est produite. Réessayez ou retournez à l'accueil."
)

function goHome() {
  clearError({ redirect: '/' })
}

function openReportDialog() {
  if (import.meta.client && lastEventId.value) {
    import('@sentry/vue').then((Sentry) => {
      Sentry.showReportDialog({ eventId: lastEventId.value! })
    })
  }
}
</script>

<template>
  <NuxtLayout>
    <div class="min-h-screen flex flex-col pt-20 pb-24 md:pt-24 md:pb-safe bg-background">
      <AppNavigation />
      <main class="flex-1 container mx-auto px-4 py-12 flex flex-col items-center justify-center text-center max-w-md">
        <div
          class="w-24 h-24 flex items-center justify-center mb-6 rounded-2xl overflow-hidden"
          style="border: 2.5px solid var(--bold-border-color); box-shadow: var(--bold-shadow-md); background: hsl(var(--card));"
        >
          <img
            :src="EMOJI_MAP[emojiName]"
            alt=""
            width="80"
            height="80"
            class="w-20 h-20 object-contain select-none"
          >
        </div>
        <h1 class="text-2xl font-black font-heading tracking-tight mb-2">
          {{ title }}
        </h1>
        <p class="text-muted-foreground font-medium mb-8 leading-relaxed">
          {{ description }}
        </p>
        <div class="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button type="button" class="bold-btn bold-btn--primary bold-btn--lg bold-btn--pill" @click="goHome">
            Retour à l'accueil
          </button>
          <button
            v-if="showReportButton"
            type="button"
            class="bold-btn bold-btn--outline bold-btn--lg bold-btn--pill"
            @click="openReportDialog"
          >
            Signaler ce problème
          </button>
        </div>
      </main>
    </div>
  </NuxtLayout>
</template>
