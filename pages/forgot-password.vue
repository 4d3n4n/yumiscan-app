<script setup lang="ts">
import { PhEnvelope, PhArrowLeft, PhSpinnerGap } from '@phosphor-icons/vue'
import { buildRedirectTo } from '~/utils/password-reset'
import AppEmoji from '~/components/ui/AppEmoji.vue'
import { EMOJI_MAP, APP_EMOJI } from '~/utils/emojis'
import { useI18n } from 'vue-i18n'

definePageMeta({ middleware: ['guest'] })

const supabase = useSupabase()
const route = useRoute()
const localePath = useLocalePath()

const { t } = useI18n()

const email = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const success = ref(false)

useHead({
  title: computed(() => t('auth.forgot_password.title') + ' — YumiScan'),
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

const config = useRuntimeConfig()

const handleSubmit = async (e: Event) => {
  e.preventDefault()
  if (!email.value.trim()) return
  loading.value = true
  error.value = null

  // En prod : utiliser SITE_URL (runtimeConfig.public.appUrl) pour que le lien dans l’email ne soit jamais localhost.
  const redirectTo = buildRedirectTo({
    appUrl: (config.public.appUrl as string) ?? undefined,
    windowOrigin: globalThis.window === undefined ? null : globalThis.window.location.origin,
    fallbackOrigin: 'https://yumiscan.com',
    redirectQuery: route.query.redirect as string | undefined,
  })

  // Supabase Auth envoie l’email de réinitialisation (pas d’Edge Function nécessaire).
  const { error: err } = await supabase.auth.resetPasswordForEmail(email.value.trim(), {
    redirectTo,
  })

  if (err) {
    error.value = err.message
    loading.value = false
    return
  }

  success.value = true
  loading.value = false
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-background">
    <div class="flex-1 flex items-center justify-center px-4 py-16">
      <div
        class="w-full max-w-md bg-card p-8"
        style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius-lg); box-shadow: var(--bold-shadow-lg);"
      >
        <NuxtLink
          v-if="!success"
          :to="localePath('/login')"
          class="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground mb-6"
        >
          <PhArrowLeft :size="18" />
          {{ t('auth.forgot_password.back_login') }}
        </NuxtLink>

        <template v-if="!success">
          <div class="space-y-1 mb-6">
            <h1 class="text-2xl font-black font-heading tracking-tight">{{ t('auth.forgot_password.title') }}</h1>
            <p class="text-sm text-muted-foreground">
              {{ t('auth.forgot_password.desc') }}
            </p>
          </div>

          <form class="space-y-4" @submit.prevent="handleSubmit">
            <div
              v-if="error"
              class="p-3 flex items-center gap-3 text-sm font-medium"
              style="border: 2px solid hsl(var(--destructive) / 0.3); border-radius: var(--bold-radius-sm); background: hsl(var(--destructive) / 0.1); color: hsl(var(--destructive));"
            >
              <img
                :src="EMOJI_MAP[APP_EMOJI.loginError]"
                alt=""
                width="24"
                height="24"
                class="shrink-0 w-10 h-10 object-contain select-none emoji-error"
              >
              <span class="leading-snug">{{ error }}</span>
            </div>

            <div class="space-y-1.5">
              <UiLabel for="forgot-email" class="font-bold text-sm">{{ t('auth.forgot_password.email_label') }}</UiLabel>
              <div class="relative">
                <PhEnvelope class="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none z-10" />
                <UiInput
                  id="forgot-email"
                  v-model="email"
                  type="email"
                  :placeholder="t('auth.forgot_password.email_placeholder')"
                  required
                  class="pl-10"
                  autocomplete="email"
                />
              </div>
            </div>

            <button
              type="submit"
              :disabled="loading"
              class="bold-btn bold-btn--primary bold-btn--lg bold-btn--pill w-full"
            >
              <PhSpinnerGap v-if="loading" class="h-5 w-5 animate-spin" />
              {{ loading ? t('auth.forgot_password.loading') : t('auth.forgot_password.submit') }}
            </button>
          </form>
        </template>

        <div v-else class="text-center space-y-4">
          <div class="w-14 h-14 flex items-center justify-center mx-auto rounded-full bg-primary/10 text-primary">
            <AppEmoji :name="APP_EMOJI.success" :size="36" />
          </div>
          <h2 class="text-xl font-black font-heading tracking-tight">{{ t('auth.forgot_password.success_title') }}</h2>
          <p class="text-sm text-muted-foreground">
            {{ t('auth.forgot_password.success_desc', { email: email }) }}
          </p>
          <NuxtLink :to="$localePath('/login')" class="bold-btn bold-btn--secondary bold-btn--pill inline-flex px-4 py-2">
            {{ t('auth.forgot_password.back_login') }}
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
