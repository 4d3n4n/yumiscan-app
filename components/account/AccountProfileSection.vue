<script setup lang="ts">
import { PhPencilSimple, PhCheck, PhX, PhSpinnerGap, PhEye, PhEyeSlash, PhKey, PhCrown, PhEnvelope } from '@phosphor-icons/vue'
import { validatePassword } from '~/utils/password'
import { useI18n } from 'vue-i18n'
import { verifySupabasePassword } from '~/utils/supabase-auth'

const { t } = useI18n()

const props = defineProps<{
  profile: { first_name: string; last_name: string }
  email: string
  isSaving?: boolean
  plan?: string | null
  hasPaidCredits?: boolean
  scanCount?: number
}>()

const emit = defineEmits<{
  save: [data: { first_name: string; last_name: string }]
}>()

const supabase = useSupabase()
const config = useRuntimeConfig()
const localePath = useLocalePath()

const isEditing = ref(false)
const firstName = ref(props.profile.first_name)
const lastName = ref(props.profile.last_name)
const error = ref<string | null>(null)

const isChangingPassword = ref(false)
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const passwordError = ref<string | null>(null)
const passwordSuccess = ref<string | null>(null)
const isSubmittingPassword = ref(false)
const showCurrentPassword = ref(false)
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)

const isChangingEmail = ref(false)
const newEmail = ref('')
const currentPasswordForEmail = ref('')
const emailError = ref<string | null>(null)
const emailSuccess = ref<string | null>(null)
const isSubmittingEmail = ref(false)
const showPasswordForEmail = ref(false)

const displayName = computed(() => {
  const f = props.profile.first_name?.trim()
  const l = props.profile.last_name?.trim()
  if (f && l) return `${f} ${l}`
  if (f) return f
  return t('account.profile.default_user_name')
})

const initials = computed(() => {
  const f = props.profile.first_name?.[0]?.toUpperCase() || ''
  const l = props.profile.last_name?.[0]?.toUpperCase() || ''
  return f + l || 'U'
})

const memberLabel = computed(() => {
  if (props.plan === 'premium' || props.plan === 'pro' || props.hasPaidCredits) return t('account.profile.member_premium')
  return t('account.profile.member_free')
})

const levelLabel = computed(() => t('account.profile.lvl_scanner', { level: Math.max(1, Math.floor((props.scanCount ?? 0) / 5) + 1) }))

const passwordValidation = computed(() =>
  newPassword.value.length > 0 ? validatePassword(newPassword.value).errors : []
)

const isPasswordValid = computed(() => validatePassword(newPassword.value).valid)
const doPasswordsMatch = computed(() => newPassword.value === confirmPassword.value && confirmPassword.value.length > 0)
const canSubmitPassword = computed(() => currentPassword.value.length > 0 && isPasswordValid.value && doPasswordsMatch.value && !isSubmittingPassword.value)

const verifyPassword = async (
  email: string,
  password: string,
  translationKey: string,
): Promise<boolean> => {
  const isPasswordVerified = await verifySupabasePassword({
    supabaseUrl: String(config.public.supabaseUrl),
    anonKey: String(config.public.supabaseKey),
    email,
    password,
  })

  if (!isPasswordVerified) {
    passwordError.value = null
    emailError.value = null
    if (translationKey === 'account.profile.err_wrong_old_password') {
      passwordError.value = t(translationKey)
    } else {
      emailError.value = t(translationKey)
    }
    return false
  }

  return true
}

const handleStartEdit = () => {
  firstName.value = props.profile.first_name
  lastName.value = props.profile.last_name
  isEditing.value = true
  error.value = null
}

const handleCancel = () => { isEditing.value = false; error.value = null }

const handleSave = async () => {
  if (!firstName.value.trim()) { error.value = t('account.profile.err_first_name'); return }
  if (!lastName.value.trim()) { error.value = t('account.profile.err_last_name'); return }
  try {
    emit('save', { first_name: firstName.value.trim(), last_name: lastName.value.trim() })
    isEditing.value = false
    error.value = null
  } catch { error.value = t('account.profile.err_save_failed') }
}

const handleStartChangePassword = () => {
  isChangingPassword.value = true
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  passwordError.value = null
  passwordSuccess.value = null
}

const handleCancelPassword = () => {
  isChangingPassword.value = false
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  passwordError.value = null
}

const handleSubmitPassword = async () => {
  if (!canSubmitPassword.value) return
  isSubmittingPassword.value = true
  passwordError.value = null
  passwordSuccess.value = null
  try {
    const isPasswordVerified = await verifyPassword(
      props.email,
      currentPassword.value,
      'account.profile.err_wrong_old_password',
    )
    if (!isPasswordVerified) return

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword.value })
    if (updateError) throw updateError
    passwordSuccess.value = t('account.profile.msg_password_success')
    isChangingPassword.value = false
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (err: unknown) {
    passwordError.value = err instanceof Error ? err.message : t('account.profile.err_server_error')
  } finally {
    isSubmittingPassword.value = false
  }
}

const handleStartChangeEmail = () => {
  isChangingEmail.value = true
  newEmail.value = ''
  currentPasswordForEmail.value = ''
  emailError.value = null
  emailSuccess.value = null
}

const handleCancelEmail = () => {
  isChangingEmail.value = false
  newEmail.value = ''
  currentPasswordForEmail.value = ''
  emailError.value = null
  emailSuccess.value = null
}

const canSubmitEmail = computed(() => {
  const trimmed = newEmail.value.trim()
  return trimmed.length > 0 && trimmed !== props.email && currentPasswordForEmail.value.length > 0 && !isSubmittingEmail.value
})

const handleSubmitEmail = async () => {
  if (!canSubmitEmail.value) return
  const trimmed = newEmail.value.trim()
  if (!trimmed || trimmed === props.email) return
  isSubmittingEmail.value = true
  emailError.value = null
  emailSuccess.value = null
  try {
    const isPasswordVerified = await verifyPassword(
      props.email,
      currentPasswordForEmail.value,
      'account.profile.err_wrong_password_email',
    )
    if (!isPasswordVerified) return

    const emailRedirectTo = typeof globalThis.window !== 'undefined'
      ? `${globalThis.window.location.origin}${localePath('/auth/confirm')}`
      : undefined
    const { error: updateError } = await supabase.auth.updateUser(
      { email: trimmed },
      emailRedirectTo ? { emailRedirectTo } : undefined,
    )
    if (updateError) {
      const msg = updateError.message || ''
      if (/already|déjà|registered|enregistré/i.test(msg)) {
        emailError.value = t('account.profile.err_email_taken')
      } else {
        emailError.value = msg || t('account.profile.err_email_failed')
      }
      return
    }
    emailSuccess.value = t('account.profile.msg_email_success', { email: trimmed })
    isChangingEmail.value = false
    newEmail.value = ''
    currentPasswordForEmail.value = ''
  } catch (err: unknown) {
    emailError.value = err instanceof Error ? err.message : t('account.profile.err_modify_failed')
  } finally {
    isSubmittingEmail.value = false
  }
}
</script>

<template>
  <div class="space-y-4">

    <!-- Profile hero card -->
    <div class="bold-card--static p-5">
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-center gap-4 min-w-0">
          <!-- Avatar -->
          <div class="relative shrink-0">
            <div
              class="w-16 h-16 rounded-full flex items-center justify-center text-xl font-black font-heading"
              style="background: linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.3)); color: hsl(var(--primary)); border: 2.5px solid var(--bold-border-color);"
            >
              {{ initials }}
            </div>
            <div
              v-if="plan === 'premium' || plan === 'pro' || hasPaidCredits"
              class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
              style="background: hsl(var(--primary)); border: 2px solid hsl(var(--card));"
            >
              <PhCrown :size="12" weight="fill" class="text-white" />
            </div>
          </div>

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <h2 class="text-lg font-black font-heading tracking-tight truncate">{{ displayName }}</h2>
            <p class="text-xs font-bold text-muted-foreground uppercase tracking-wider">{{ memberLabel }}</p>
            <div class="bold-pill bold-pill--primary mt-2" style="font-size: 9px; padding: 0.15rem 0.55rem;">
              {{ levelLabel }}
            </div>
          </div>
        </div>

        <!-- Edit button -->
        <button v-if="!isEditing" class="bold-btn bold-btn--ghost shrink-0" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;" @click="handleStartEdit">
          <PhPencilSimple :size="12" />
        </button>
      </div>

      <!-- Editing form -->
      <div v-if="isEditing" class="mt-5 pt-4 space-y-3" style="border-top: 2px solid hsl(var(--border));">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">{{ t('account.profile.first_name') }}</label>
            <input v-model="firstName" :placeholder="t('account.profile.first_name')" class="bold-input" style="padding: 0.5rem 0.7rem; font-size: 0.875rem;" />
          </div>
          <div>
            <label class="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">{{ t('account.profile.last_name') }}</label>
            <input v-model="lastName" :placeholder="t('account.profile.last_name')" class="bold-input" style="padding: 0.5rem 0.7rem; font-size: 0.875rem;" />
          </div>
        </div>

        <p v-if="error" class="text-xs text-destructive font-semibold flex items-center gap-1">
          <PhX :size="12" /> {{ error }}
        </p>

        <div class="flex gap-2 pt-1">
          <button class="bold-btn bold-btn--secondary bold-btn--sm" @click="handleCancel" :disabled="isSaving">{{ t('account.profile.btn_cancel') }}</button>
          <button class="bold-btn bold-btn--primary bold-btn--sm" @click="handleSave" :disabled="isSaving">
            <PhSpinnerGap v-if="isSaving" :size="14" class="animate-spin" />
            <PhCheck v-else :size="14" weight="bold" />
            {{ isSaving ? t('account.profile.btn_saving') : t('account.profile.btn_save') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Email card -->
    <div class="bold-card--static p-5">
      <div class="flex items-center justify-between mb-1">
        <div class="flex items-center gap-2">
          <PhEnvelope :size="16" weight="duotone" class="text-primary" />
          <span class="text-sm font-bold font-heading">{{ t('account.profile.email') }}</span>
        </div>
        <button v-if="!isChangingEmail" class="bold-btn bold-btn--ghost" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;" @click="handleStartChangeEmail">
          <PhPencilSimple :size="12" />
        </button>
      </div>

      <div v-if="!isChangingEmail" class="text-sm text-muted-foreground">{{ email }}</div>

      <form
        v-else
        class="space-y-3 mt-3 p-3 rounded-lg"
        style="background: hsl(var(--muted) / 0.3); border: 1.5px solid hsl(var(--border) / 0.5);"
        @submit.prevent="handleSubmitEmail"
      >
        <p class="text-xs text-muted-foreground leading-relaxed">
          {{ t('account.profile.email_warning') }}
        </p>
        <div>
          <label class="text-xs font-bold text-muted-foreground mb-1 block">{{ t('account.profile.new_email') }}</label>
          <input
            v-model="newEmail"
            type="email"
            placeholder="john.doe@example.com"
            class="bold-input w-full"
            style="padding: 0.5rem 0.7rem; font-size: 0.875rem;"
            autocomplete="email"
          />
        </div>
        <div>
          <label class="text-xs font-bold text-muted-foreground mb-1 block">{{ t('account.profile.current_password') }}</label>
          <div class="relative">
            <input
              :type="showPasswordForEmail ? 'text' : 'password'"
              v-model="currentPasswordForEmail"
              class="bold-input w-full"
              style="padding: 0.5rem 2.5rem 0.5rem 0.7rem; font-size: 0.875rem;"
              autocomplete="current-password"
            />
            <button type="button" @click="showPasswordForEmail = !showPasswordForEmail" class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <PhEyeSlash v-if="showPasswordForEmail" :size="14" /><PhEye v-else :size="14" />
            </button>
          </div>
        </div>
        <p v-if="emailError" class="text-xs text-destructive font-semibold flex items-center gap-1"><PhX :size="12" /> {{ emailError }}</p>
        <div class="flex gap-2 pt-1">
          <button type="button" class="bold-btn bold-btn--secondary bold-btn--sm" @click="handleCancelEmail" :disabled="isSubmittingEmail">{{ t('account.profile.btn_cancel') }}</button>
          <button type="submit" class="bold-btn bold-btn--primary bold-btn--sm" :disabled="!canSubmitEmail">
            <PhSpinnerGap v-if="isSubmittingEmail" :size="14" class="animate-spin" />
            <PhCheck v-else :size="14" weight="bold" />
            {{ isSubmittingEmail ? t('account.profile.btn_sending') : t('account.profile.btn_change_email') }}
          </button>
        </div>
      </form>

      <p v-if="emailSuccess && !isChangingEmail" class="text-xs font-semibold flex items-center gap-1 mt-2" style="color: hsl(var(--success));">
        <PhCheck :size="12" weight="bold" /> {{ emailSuccess }}
      </p>
    </div>

    <!-- Password card -->
    <div class="bold-card--static p-5">
      <div class="flex items-center justify-between mb-1">
        <div class="flex items-center gap-2">
          <PhKey :size="16" weight="duotone" class="text-amber-500" />
          <span class="text-sm font-bold font-heading">{{ t('account.profile.lbl_password') }}</span>
        </div>
        <button v-if="!isChangingPassword" class="bold-btn bold-btn--ghost" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;" @click="handleStartChangePassword">
          <PhPencilSimple :size="12" />
        </button>
      </div>

      <div v-if="!isChangingPassword" class="text-sm text-muted-foreground">••••••••••••</div>

      <form
        v-else
        class="space-y-3 mt-3 p-3 rounded-lg"
        style="background: hsl(var(--muted) / 0.3); border: 1.5px solid hsl(var(--border) / 0.5);"
        @submit.prevent="handleSubmitPassword"
      >
        <div>
          <label class="text-xs font-bold text-muted-foreground mb-1 block">{{ t('account.profile.old_password') }}</label>
          <div class="relative">
            <input :type="showCurrentPassword ? 'text' : 'password'" v-model="currentPassword" class="bold-input" style="padding: 0.5rem 2.5rem 0.5rem 0.7rem; font-size: 0.875rem;" autocomplete="current-password" />
            <button type="button" @click="showCurrentPassword = !showCurrentPassword" class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <PhEyeSlash v-if="showCurrentPassword" :size="14" /><PhEye v-else :size="14" />
            </button>
          </div>
        </div>
        <div>
          <label class="text-xs font-bold text-muted-foreground mb-1 block">{{ t('account.profile.new_password') }}</label>
          <div class="relative">
            <input :type="showNewPassword ? 'text' : 'password'" v-model="newPassword" class="bold-input" :style="`padding: 0.5rem 2.5rem 0.5rem 0.7rem; font-size: 0.875rem;${newPassword.length > 0 && !isPasswordValid ? ' border-color: hsl(var(--destructive));' : ''}`" autocomplete="new-password" />
            <button type="button" @click="showNewPassword = !showNewPassword" class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <PhEyeSlash v-if="showNewPassword" :size="14" /><PhEye v-else :size="14" />
            </button>
          </div>
          <p v-if="passwordValidation.length > 0" class="text-xs text-destructive mt-1 font-medium">{{ t('account.profile.lbl_req_password') }} {{ passwordValidation.join(', ') }}</p>
          <p v-if="newPassword.length > 0 && isPasswordValid" class="text-xs font-medium mt-1 flex items-center gap-1" style="color: hsl(var(--success));">
            <PhCheck :size="10" weight="bold" /> {{ t('account.profile.password_valid') }}
          </p>
        </div>
        <div>
          <label class="text-xs font-bold text-muted-foreground mb-1 block">{{ t('account.profile.confirm_password') }}</label>
          <div class="relative">
            <input :type="showConfirmPassword ? 'text' : 'password'" v-model="confirmPassword" class="bold-input" :style="`padding: 0.5rem 2.5rem 0.5rem 0.7rem; font-size: 0.875rem;${confirmPassword.length > 0 && !doPasswordsMatch ? ' border-color: hsl(var(--destructive));' : ''}`" autocomplete="new-password" />
            <button type="button" @click="showConfirmPassword = !showConfirmPassword" class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <PhEyeSlash v-if="showConfirmPassword" :size="14" /><PhEye v-else :size="14" />
            </button>
          </div>
          <p v-if="confirmPassword.length > 0 && !doPasswordsMatch" class="text-xs text-destructive mt-1 font-medium">{{ t('account.profile.password_mismatch') }}</p>
        </div>
        <p v-if="passwordError" class="text-xs text-destructive font-semibold flex items-center gap-1"><PhX :size="12" /> {{ passwordError }}</p>
        <div class="flex gap-2 pt-1">
          <button type="button" class="bold-btn bold-btn--secondary bold-btn--sm" @click="handleCancelPassword" :disabled="isSubmittingPassword">{{ t('account.profile.btn_cancel') }}</button>
          <button type="submit" class="bold-btn bold-btn--primary bold-btn--sm" :disabled="!canSubmitPassword">
            <PhSpinnerGap v-if="isSubmittingPassword" :size="14" class="animate-spin" />
            <PhCheck v-else :size="14" weight="bold" />
            {{ isSubmittingPassword ? t('account.profile.btn_saving') : t('account.profile.btn_save') }}
          </button>
        </div>
      </form>

      <p v-if="passwordSuccess && !isChangingPassword" class="text-xs font-semibold flex items-center gap-1 mt-2" style="color: hsl(var(--success));">
        <PhCheck :size="12" weight="bold" /> {{ passwordSuccess }}
      </p>
    </div>

  </div>
</template>
