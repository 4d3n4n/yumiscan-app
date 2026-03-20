<script setup lang="ts">
import { PhSpinnerGap } from '@phosphor-icons/vue'
import { validatePassword } from '~/utils/password'
import { shouldShowRecoveryForm, AUTH_RECOVERY_KEY } from '~/utils/auth-recovery'
import { EMOJI_MAP, APP_EMOJI } from '~/utils/emojis'
import { useI18n } from 'vue-i18n'

definePageMeta({ middleware: ['guest'] })

const router = useRouter()
const route = useRoute()
const supabase = useSupabase()

const { t } = useI18n()

useHead({
  title: computed(() => t('auth.login.meta_title')),
  meta: [
    { name: 'description', content: computed(() => t('auth.login.meta_description')) }
  ],
})

const redirectPath = computed(() => {
  const r = route.query.redirect as string | undefined
  return r || '/app/dashboard'
})

const showSetNewPassword = ref(false)
const newPassword = ref('')
const newPasswordLoading = ref(false)
const newPasswordError = ref<string | null>(null)
const newPasswordSuccess = ref(false)
/** Message si le lien de réinit dans l’URL est expiré ou invalide (hash error_code=otp_expired) */
const recoveryLinkExpiredError = ref<string | null>(null)

function parseHashParams(hash: string): Record<string, string> {
  const q = hash.replace(/^#/, '')
  if (!q) return {}
  return Object.fromEntries(new URLSearchParams(q))
}

onMounted(() => {
  if (import.meta.server) return
  const hash = globalThis.window.location.hash || ''
  const params = parseHashParams(hash)
  if (params.error_code === 'otp_expired' || (params.error === 'access_denied' && (params.error_description?.includes('expired') || params.error_description?.includes('invalid')))) {
    recoveryLinkExpiredError.value = t('auth.reset_password.link_expired')
    showSetNewPassword.value = true
    return
  }
  const isRecovery = shouldShowRecoveryForm({
    hash,
    search: globalThis.window.location.search || '',
    getStorageItem: (key) => {
      try { return sessionStorage.getItem(key) } catch { return null }
    },
  })
  if (isRecovery) {
    showSetNewPassword.value = true
    try { sessionStorage.removeItem(AUTH_RECOVERY_KEY) } catch { /* ignore */ }
  }
})

const onLoginSuccess = (path: string) => {
  router.push(path)
}

const newPasswordValidation = computed(() => validatePassword(newPassword.value))

const handleSetNewPassword = async (e: Event) => {
  e.preventDefault()
  if (!newPasswordValidation.value.valid) {
    newPasswordError.value = newPasswordValidation.value.errors.join(', ')
    return
  }
  newPasswordError.value = null
  newPasswordLoading.value = true

  const { error } = await supabase.auth.updateUser({ password: newPassword.value })

  if (error) {
    newPasswordError.value = error.message
    newPasswordLoading.value = false
    return
  }

  newPasswordSuccess.value = true
  newPasswordLoading.value = false
  if (typeof globalThis.window !== 'undefined') {
    globalThis.window.history.replaceState(null, '', route.path + (route.query.redirect ? `?redirect=${route.query.redirect}` : ''))
  }
  setTimeout(() => router.push(redirectPath.value), 1500)
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-background">
    <div id="main-content" class="flex-1 flex items-center justify-center px-4 py-16">
      <div
        class="w-full max-w-md bg-card p-8"
        style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius-lg); box-shadow: var(--bold-shadow-lg);"
      >
        <!-- Étape : définir nouveau mot de passe (après clic sur lien email) -->
        <template v-if="showSetNewPassword">
          <div class="space-y-1 mb-6">
            <h1 class="text-2xl font-black font-heading tracking-tight">{{ t('auth.reset_password.title') }}</h1>
            <p class="text-sm text-muted-foreground">{{ t('auth.reset_password.desc') }}</p>
          </div>

          <!-- Lien expiré ou invalide -->
          <div
            v-if="recoveryLinkExpiredError"
            class="p-3 flex flex-col gap-3 text-sm font-medium"
            style="border: 2px solid hsl(var(--destructive) / 0.3); border-radius: var(--bold-radius-sm); background: hsl(var(--destructive) / 0.1); color: hsl(var(--destructive));"
          >
            <span class="leading-snug">{{ recoveryLinkExpiredError }}</span>
            <NuxtLink :to="$localePath('/forgot-password')" class="bold-btn bold-btn--secondary bold-btn--sm bold-btn--pill w-fit">
              {{ t('auth.reset_password.btn_forgot') }}
            </NuxtLink>
          </div>

          <form v-else-if="!newPasswordSuccess" @submit.prevent="handleSetNewPassword" class="space-y-4">
            <div
              v-if="newPasswordError"
              class="p-3 flex items-center gap-3 text-sm font-medium"
              style="border: 2px solid hsl(var(--destructive) / 0.3); border-radius: var(--bold-radius-sm); background: hsl(var(--destructive) / 0.1); color: hsl(var(--destructive));"
            >
              <img
                :src="EMOJI_MAP[APP_EMOJI.loginError]"
                alt=""
                width="24"
                height="24"
                class="shrink-0 w-10 h-10 object-contain select-none emoji-error"
              />
              <span class="leading-snug">{{ newPasswordError }}</span>
            </div>
            <div class="space-y-1.5">
              <UiLabel for="new-password" class="font-bold text-sm">{{ t('auth.reset_password.lbl_new_password') }}</UiLabel>
              <UiPasswordInput
                id="new-password"
                v-model="newPassword"
                autocomplete="new-password"
                :minlength="12"
                :invalid="newPassword.length > 0 && !newPasswordValidation.valid"
              />
              <p v-if="newPassword.length > 0 && !newPasswordValidation.valid" class="text-xs text-destructive font-medium">
                {{ t('auth.reset_password.req_error', { errors: newPasswordValidation.errors.join(', ') }) }}
              </p>
            </div>
            <button
              type="submit"
              :disabled="newPasswordLoading || !newPasswordValidation.valid"
              class="bold-btn bold-btn--primary bold-btn--lg bold-btn--pill w-full"
            >
              <PhSpinnerGap v-if="newPasswordLoading" class="h-5 w-5 animate-spin" />
              {{ newPasswordLoading ? t('auth.reset_password.btn_loading') : t('auth.reset_password.btn_submit') }}
            </button>
          </form>
          <p v-else-if="!recoveryLinkExpiredError" class="text-sm font-medium text-primary">
            {{ t('auth.reset_password.success') }}
          </p>
        </template>

        <!-- Connexion classique -->
        <template v-else>
          <div class="space-y-1 mb-6">
            <h1 class="text-2xl font-black font-heading tracking-tight">{{ t('auth.login.title') }}</h1>
            <p class="text-sm text-muted-foreground">{{ t('auth.login.subtitle') }}</p>
          </div>

          <AuthLoginForm
            :redirect-to="redirectPath"
            email-id="login-email"
            password-id="login-password"
            @success="onLoginSuccess"
          />

          <p class="mt-6 text-center text-sm text-muted-foreground font-medium">
            {{ t('auth.login.no_account') }}
            <NuxtLink
              :to="'/signup' + (route.query.redirect ? '?redirect=' + encodeURIComponent(route.query.redirect as string) : '')"
              class="text-primary font-bold hover:underline"
            >
              {{ t('auth.login.btn_signup') }}
            </NuxtLink>
          </p>
        </template>
      </div>
    </div>
  </div>
</template>
