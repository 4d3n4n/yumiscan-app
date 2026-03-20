<script setup lang="ts">
import { PhSignOut, PhDownloadSimple, PhSpinnerGap, PhUserMinus, PhEye, PhEyeSlash } from '@phosphor-icons/vue'
import AppEmoji from '~/components/ui/AppEmoji.vue'
import { APP_EMOJI } from '~/utils/emojis'
import { useI18n } from 'vue-i18n'
import { getAuthenticatedHeaders, safeSignOut } from '~/utils/supabase-auth'

const { t } = useI18n()
const localePath = useLocalePath()

const supabase = useSupabase()
const config = useRuntimeConfig()

const isExporting = ref(false)
const isDeleting = ref(false)
const showDeleteConfirm = ref(false)
const deletePassword = ref('')
const showDeletePassword = ref(false)
const feedbackMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)

const canDelete = computed(() => deletePassword.value.trim().length > 0 && !isDeleting.value)

async function callEdge(name: string, method: 'GET' | 'POST' | 'DELETE' = 'POST', body?: Record<string, unknown>): Promise<Response> {
  const headers = await getAuthenticatedHeaders(supabase, config.public.supabaseKey)
  if (!headers) throw new Error(t('common.errors.unauthorized'))
  const supabaseUrl = config.public.supabaseUrl.replace(/\/+$/, '')
  const url = `${supabaseUrl}/functions/v1/${name}`
  return fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined })
}

async function getErrorFromResponse(res: Response): Promise<string> {
  const text = await res.text()
  try {
    const e = JSON.parse(text)
    return e.error || e.message || text || t('common.errors.generic')
  } catch {
    return text || `${t('common.errors.generic')} ${res.status}`
  }
}

const handleExportData = async () => {
  isExporting.value = true
  feedbackMessage.value = null
  try {
    const res = await callEdge('user-data-export', 'GET')
    if (!res.ok) { const msg = await getErrorFromResponse(res); throw new Error(msg) }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `yumiscan-data-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    feedbackMessage.value = { type: 'success', text: t('account.danger_zone.msg_download_success') }
  } catch (err) {
    feedbackMessage.value = { type: 'error', text: err instanceof Error ? err.message : t('account.danger_zone.msg_error_export') }
  } finally {
    isExporting.value = false
  }
}

const handleDeleteAccount = async () => {
  if (!canDelete.value) return
  isDeleting.value = true
  feedbackMessage.value = null
  try {
    const res = await callEdge('user-account-delete', 'DELETE', {
      current_password: deletePassword.value,
    })
    if (!res.ok) { const msg = await getErrorFromResponse(res); throw new Error(msg) }
    deletePassword.value = ''
    await safeSignOut(supabase)
    navigateTo(localePath('/'))
  } catch (err) {
    feedbackMessage.value = { type: 'error', text: err instanceof Error ? err.message : t('account.danger_zone.msg_error_delete') }
    isDeleting.value = false
  }
}

const handleLogout = async () => {
  await safeSignOut(supabase)
  navigateTo(localePath('/login'))
}
</script>

<template>
  <div class="space-y-3">

    <!-- Feedback -->
    <div
      v-if="feedbackMessage"
      class="bold-card--static p-3 text-sm font-semibold flex items-start gap-2"
      :style="feedbackMessage.type === 'success'
        ? 'border-color: hsl(var(--success)); color: hsl(var(--success));'
        : 'border-color: hsl(var(--destructive)); color: hsl(var(--destructive));'"
    >
      <AppEmoji
        :name="feedbackMessage.type === 'success' ? APP_EMOJI.success : APP_EMOJI.loginError"
        :size="22"
        class="shrink-0"
        :filter-class="feedbackMessage.type === 'error' ? 'emoji-error' : ''"
      />
      <span>{{ feedbackMessage.text }}</span>
    </div>

    <!-- Download data -->
    <button
      class="bold-btn bold-btn--secondary w-full"
      style="justify-content: flex-start; padding: 0.75rem 1rem;"
      :disabled="isExporting"
      @click="handleExportData"
    >
      <PhSpinnerGap v-if="isExporting" :size="16" class="animate-spin" />
      <PhDownloadSimple v-else :size="16" weight="bold" />
      {{ t('account.danger_zone.btn_download') }}
    </button>

    <!-- Delete account -->
    <div v-if="!showDeleteConfirm">
      <button
        class="bold-btn w-full"
        style="justify-content: flex-start; padding: 0.75rem 1rem; border-color: hsl(var(--destructive) / 0.4); color: hsl(var(--destructive)); background: hsl(var(--destructive) / 0.06);"
        @click="showDeleteConfirm = true"
      >
        <PhUserMinus :size="16" weight="bold" />
        {{ t('account.danger_zone.btn_delete_req') }}
      </button>
    </div>

    <div v-else class="bold-card--static p-4 space-y-3" style="border-color: hsl(var(--destructive) / 0.5);">
      <div class="flex items-start gap-2">
        <AppEmoji
          :name="APP_EMOJI.destructiveWarning"
          :size="28"
          class="shrink-0 mt-0.5"
          filter-class="emoji-error"
        />
        <div>
          <p class="text-sm font-bold text-destructive">{{ t('account.danger_zone.warning_title') }}</p>
          <p class="text-xs text-muted-foreground mt-0.5">{{ t('account.danger_zone.warning_desc') }}</p>
        </div>
      </div>
      <div>
        <label for="delete-password-input" class="text-xs font-bold text-muted-foreground mb-1 block">{{ t('account.danger_zone.lbl_current_password') }}</label>
        <div class="relative">
          <input
            id="delete-password-input"
            v-model="deletePassword"
            :type="showDeletePassword ? 'text' : 'password'"
            :placeholder="t('account.danger_zone.placeholder_current_password')"
            class="bold-input pr-11"
            style="padding: 0.5rem 0.7rem; font-size: 0.875rem;"
            autocomplete="current-password"
          >
          <button
            type="button"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            :aria-label="showDeletePassword ? t('common.password.hide') : t('common.password.show')"
            @click="showDeletePassword = !showDeletePassword"
          >
            <PhEyeSlash v-if="showDeletePassword" :size="16" weight="bold" />
            <PhEye v-else :size="16" weight="bold" />
          </button>
        </div>
      </div>
      <div class="flex gap-2">
        <button class="bold-btn bold-btn--secondary bold-btn--sm flex-1" @click="showDeleteConfirm = false; deletePassword = ''; showDeletePassword = false">
          {{ t('account.danger_zone.btn_cancel') }}
        </button>
        <button
          class="bold-btn bold-btn--sm flex-1"
          style="background: hsl(var(--destructive)); color: white; border-color: var(--bold-border-color);"
          :disabled="!canDelete || isDeleting"
          @click="handleDeleteAccount"
        >
          <PhSpinnerGap v-if="isDeleting" :size="14" class="animate-spin" />
          {{ t('account.danger_zone.btn_delete_confirm') }}
        </button>
      </div>
    </div>

    <!-- Logout -->
    <button
      class="bold-btn bold-btn--primary bold-btn--pill w-full"
      style="background: hsl(var(--destructive)); border-color: var(--bold-border-color); padding: 0.75rem;"
      @click="handleLogout"
    >
      <PhSignOut :size="16" weight="bold" />
      {{ t('account.danger_zone.btn_logout') }}
    </button>

  </div>
</template>
