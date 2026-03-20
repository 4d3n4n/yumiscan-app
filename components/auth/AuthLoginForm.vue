<script setup lang="ts">
import { PhEnvelope, PhSignIn, PhSpinnerGap } from '@phosphor-icons/vue'
import { EMOJI_MAP, APP_EMOJI } from '~/utils/emojis'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const localePath = useLocalePath()

const props = defineProps<{
  redirectTo?: string
  emailId?: string
  passwordId?: string
}>()

const emit = defineEmits<{
  success: [redirectPath: string]
  forgotPassword: []
}>()

const supabase = useSupabase()

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref<string | null>(null)

const emailInputId = computed(() => props.emailId ?? 'auth-login-email')
const passwordInputId = computed(() => props.passwordId ?? 'auth-login-password')

const forgotPasswordUrl = computed(() => {
  const redirect = props.redirectTo?.trim()
  return localePath({
    path: '/forgot-password',
    query: redirect ? { redirect } : {},
  })
})

const handleLogin = async (e: Event) => {
  e.preventDefault()
  loading.value = true
  error.value = null

  const { error: err } = await supabase.auth.signInWithPassword({
    email: email.value.trim(),
    password: password.value,
  })

  if (err) {
    error.value = err.message
    loading.value = false
    return
  }

  loading.value = false
  const redirect = props.redirectTo ?? '/app/dashboard'
  emit('success', redirect)
}

function clearError() {
  error.value = null
}

function handleForgotPasswordClick() {
  emit('forgotPassword')
}
</script>

<template>
  <form @submit.prevent="handleLogin" class="space-y-4">
    <div
      v-if="error"
      class="bold-card--static p-3 flex items-center gap-3 text-sm font-medium"
      style="background: hsl(var(--destructive) / 0.1); color: hsl(var(--destructive)); border-color: hsl(var(--destructive) / 0.3);"
    >
      <img
        :src="EMOJI_MAP[APP_EMOJI.loginError]"
        alt=""
        width="24"
        height="24"
        class="shrink-0 w-10 h-10 object-contain select-none emoji-error"
      />
      <span class="leading-snug">{{ error }}</span>
    </div>

    <div class="space-y-1.5">
      <UiLabel :for="emailInputId" class="font-bold text-sm">{{ t('auth.login.email_label') }}</UiLabel>
      <div class="relative">
        <PhEnvelope class="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none z-10" />
        <UiInput
          :id="emailInputId"
          v-model="email"
          type="email"
          :placeholder="t('auth.signup.email_placeholder')"
          required
          class="pl-10"
          autocomplete="username"
          @input="clearError"
        />
      </div>
    </div>

    <div class="space-y-1.5">
      <div class="flex items-center justify-between gap-2">
        <UiLabel :for="passwordInputId" class="font-bold text-sm">{{ t('auth.login.password_label') }}</UiLabel>
        <NuxtLink
          :to="forgotPasswordUrl"
          class="text-xs font-semibold text-primary hover:underline"
          @click="handleForgotPasswordClick"
        >
          {{ t('auth.login.forgot_password') }}
        </NuxtLink>
      </div>
      <UiPasswordInput
        :id="passwordInputId"
        v-model="password"
        autocomplete="current-password"
        @input="clearError()"
      />
    </div>

    <button
      type="submit"
      :disabled="loading"
      class="bold-btn bold-btn--primary bold-btn--lg bold-btn--pill w-full"
    >
      <PhSpinnerGap v-if="loading" class="h-5 w-5 animate-spin shrink-0" />
      <PhSignIn v-else :size="18" weight="bold" class="shrink-0" />
      {{ loading ? t('auth.login.loading') : t('auth.login.submit') }}
    </button>

    <slot />
  </form>
</template>
