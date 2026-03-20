<script setup lang="ts">
import type { EmailOtpType } from '@supabase/supabase-js'
import { PhSpinnerGap, PhCheckCircle, PhWarningCircle } from '@phosphor-icons/vue'
import { useI18n } from 'vue-i18n'

import { isSupportedAuthCallbackType, parseAuthCallbackParams } from '~/utils/auth-callback'
import { resolveAuthenticatedSession } from '~/utils/supabase-auth'

const route = useRoute()
const router = useRouter()
const supabase = useSupabase()
const localePath = useLocalePath()
const { t } = useI18n()

definePageMeta({ layout: 'minimal' })

type ConfirmState = 'ready' | 'loading' | 'success' | 'error'
type ConfirmKind = 'email_change' | 'email_change_current' | 'generic'
type ConfirmProcessMode = 'auto' | 'manual'

const state = ref<ConfirmState>('loading')
const kind = ref<ConfirmKind>('generic')
const requiresReauth = ref(false)
const detailMessage = ref('')
const isProcessing = ref(false)
const pendingManualVerification = ref(false)
const pendingSecondConfirmation = ref(false)

useHead({
  title: computed(() => t('auth.confirm.meta_title')),
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

function parseConfirmKind(value: unknown): ConfirmKind {
  if (value === 'email_change' || value === 'email_change_current') return value
  return 'generic'
}

function isManualEmailChangeType(value: string | null) {
  return value === 'email_change' || value === 'email_change_current'
}

function hydrateFromRouteQuery() {
  const status = route.query.status
  if (status !== 'success' && status !== 'error') return false

  state.value = status
  pendingManualVerification.value = false
  kind.value = parseConfirmKind(route.query.kind)
  requiresReauth.value = route.query.reauth === '1'
  pendingSecondConfirmation.value = route.query.pending === '1'
  detailMessage.value = typeof route.query.message === 'string' ? route.query.message : ''
  return true
}

async function replaceWithResolvedState(status: ConfirmState, message?: string, extras?: Record<string, string>) {
  await router.replace({
    path: localePath('/auth/confirm'),
    query: {
      status,
      kind: kind.value,
      ...(requiresReauth.value ? { reauth: '1' } : {}),
      ...(pendingSecondConfirmation.value ? { pending: '1' } : {}),
      ...(message ? { message } : {}),
      ...(extras ?? {}),
    },
    hash: '',
  })
}

function extractPendingEmail(candidate: unknown): string | null {
  if (!candidate || typeof candidate !== 'object') return null

  const pendingEmail = (candidate as { new_email?: unknown }).new_email
  return typeof pendingEmail === 'string' && pendingEmail.trim().length > 0
    ? pendingEmail.trim()
    : null
}

async function processCallback(mode: ConfirmProcessMode = 'auto') {
  if (isProcessing.value || hydrateFromRouteQuery()) return

  isProcessing.value = true
  state.value = 'loading'
  detailMessage.value = ''
  pendingSecondConfirmation.value = false

  const parsed = parseAuthCallbackParams({
    hash: import.meta.client ? globalThis.window.location.hash : '',
    search: import.meta.client ? globalThis.window.location.search : '',
  })

  if (parsed.error || parsed.errorCode) {
    state.value = 'error'
    detailMessage.value = parsed.errorDescription ?? parsed.error ?? parsed.errorCode ?? ''
    await replaceWithResolvedState('error', detailMessage.value)
    isProcessing.value = false
    return
  }

  try {
    if (parsed.code) {
      pendingManualVerification.value = false
      const { error } = await supabase.auth.exchangeCodeForSession(parsed.code)
      if (error) throw error
    } else if (parsed.tokenHash && isSupportedAuthCallbackType(parsed.type)) {
      kind.value = parseConfirmKind(parsed.type)
      if (mode === 'auto' && isManualEmailChangeType(parsed.type)) {
        pendingManualVerification.value = true
        state.value = 'ready'
        return
      }
      pendingManualVerification.value = false
      const { error } = await supabase.auth.verifyOtp({
        token_hash: parsed.tokenHash,
        type: parsed.type as EmailOtpType,
      })
      if (error) throw error
    } else {
      throw new Error('Missing auth callback token.')
    }

    if (parsed.type) {
      kind.value = parseConfirmKind(parsed.type)
    }

    const resolution = await resolveAuthenticatedSession(supabase)
    const resolvedUser = resolution.session?.user ?? null
    const pendingEmail = extractPendingEmail(resolvedUser)
    pendingSecondConfirmation.value = !!pendingEmail
    requiresReauth.value = !pendingSecondConfirmation.value && (resolution.state !== 'authenticated' || !resolvedUser)
    state.value = 'success'
    await replaceWithResolvedState('success')
  } catch (error: unknown) {
    pendingManualVerification.value = false
    state.value = 'error'
    detailMessage.value = error instanceof Error ? error.message : ''
    await replaceWithResolvedState('error', detailMessage.value)
  } finally {
    isProcessing.value = false
  }
}

async function handleManualConfirmation() {
  await processCallback('manual')
}

const title = computed(() => {
  if (state.value === 'loading') return t('auth.confirm.loading_title')
  if (state.value === 'ready') return t('auth.confirm.ready_title')
  if (state.value === 'error') return t('auth.confirm.error_title')
  if (pendingSecondConfirmation.value) return t('auth.confirm.email_change_pending_second_title')
  if (kind.value === 'email_change') return t('auth.confirm.email_change_success_title')
  return t('auth.confirm.generic_success_title')
})

const description = computed(() => {
  if (state.value === 'loading') return t('auth.confirm.loading_desc')
  if (state.value === 'ready') {
    return kind.value === 'email_change_current'
      ? t('auth.confirm.ready_current_desc')
      : t('auth.confirm.ready_email_change_desc')
  }
  if (state.value === 'error') return detailMessage.value || t('auth.confirm.error_desc')
  if (pendingSecondConfirmation.value) {
    return kind.value === 'email_change_current'
      ? t('auth.confirm.email_change_current_desc')
      : t('auth.confirm.email_change_pending_second_desc')
  }
  if (kind.value === 'email_change') {
    return requiresReauth.value
      ? t('auth.confirm.email_change_reauth_desc')
      : t('auth.confirm.email_change_success_desc')
  }
  if (kind.value === 'email_change_current') {
    return t('auth.confirm.email_change_current_desc')
  }
  return t('auth.confirm.generic_success_desc')
})

const primaryCta = computed(() => {
  if (state.value === 'ready') {
    return {
      label: t('auth.confirm.btn_confirm_email_change'),
      action: 'confirm' as const,
    }
  }

  if (state.value !== 'success') return null

  if (requiresReauth.value) {
    return {
      href: localePath('/login'),
      label: t('auth.confirm.btn_login'),
      action: 'navigate' as const,
    }
  }

  return {
    href: localePath('/app/account'),
    label: t('auth.confirm.btn_account'),
    action: 'navigate' as const,
  }
})

watch(
  () => route.query,
  () => {
    hydrateFromRouteQuery()
  },
  { immediate: true },
)

onMounted(async () => {
  await processCallback('auto')
})
</script>

<template>
  <div class="min-h-screen flex flex-col bg-background">
    <main id="main-content" class="flex-1 flex items-center justify-center px-4 py-16">
      <div
        class="w-full max-w-md bg-card p-8 text-center"
        style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius-lg); box-shadow: var(--bold-shadow-lg);"
      >
        <div class="flex justify-center mb-5">
          <div
            class="w-16 h-16 rounded-full flex items-center justify-center"
            :style="state === 'error'
              ? 'background: hsl(var(--destructive) / 0.1); border: 2.5px solid hsl(var(--destructive) / 0.25);'
              : 'background: hsl(var(--primary) / 0.1); border: 2.5px solid hsl(var(--primary) / 0.22);'"
          >
            <PhSpinnerGap v-if="state === 'loading'" :size="26" class="animate-spin text-primary" />
            <PhCheckCircle
              v-else-if="state === 'success' || state === 'ready'"
              :size="28"
              :weight="state === 'success' ? 'fill' : 'regular'"
              class="text-primary"
            />
            <PhWarningCircle v-else :size="28" weight="fill" class="text-destructive" />
          </div>
        </div>

        <div class="space-y-2">
          <h1 class="text-2xl font-black font-heading tracking-tight">{{ title }}</h1>
          <p class="text-sm text-muted-foreground font-medium leading-relaxed">
            {{ description }}
          </p>
        </div>

        <div v-if="primaryCta" class="mt-6 flex justify-center">
          <button
            v-if="primaryCta.action === 'confirm'"
            type="button"
            class="bold-btn bold-btn--primary bold-btn--pill px-6 py-3 inline-flex"
            :disabled="isProcessing || !pendingManualVerification"
            @click="handleManualConfirmation"
          >
            <PhSpinnerGap v-if="isProcessing" :size="18" class="animate-spin" />
            <span v-else>{{ primaryCta.label }}</span>
          </button>

          <NuxtLink
            v-else
            :to="primaryCta.href"
            class="bold-btn bold-btn--primary bold-btn--pill px-6 py-3 inline-flex"
          >
            {{ primaryCta.label }}
          </NuxtLink>
        </div>
      </div>
    </main>
  </div>
</template>
