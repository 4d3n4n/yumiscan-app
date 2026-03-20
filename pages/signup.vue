<script setup lang="ts">
import { PhSpinnerGap, PhEnvelope, PhUserPlus, PhUser, PhCheck, PhWarning, PhArrowRight, PhArrowLeft, PhX } from '@phosphor-icons/vue'
import AppEmoji from '~/components/ui/AppEmoji.vue'
import { APP_EMOJI } from '~/utils/emojis'
import { validatePassword } from '~/utils/password'
import { useQuery } from '@tanstack/vue-query'
import { sortAllergensByLocale } from '~/utils/allergens'
import { buildSignupMetadata } from '~/utils/signup'
import { useI18n } from 'vue-i18n'

definePageMeta({ middleware: ['guest'] })

const { t, locale } = useI18n()

useHead({
  title: computed(() => t('auth.signup.meta_title')),
  meta: [
    { name: 'description', content: computed(() => t('auth.signup.meta_description')) }
  ]
})

const config = useRuntimeConfig()
const supabase = useSupabase()
const router = useRouter()
const route = useRoute()
const localePath = useLocalePath()

const redirectPath = computed(() => {
  const r = route.query.redirect as string | undefined
  return r || '/app/dashboard'
})

const email = ref('')
const password = ref('')
const firstName = ref('')
const lastName = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const success = ref(false)
const requiresEmailConfirmation = ref(false)

const selectedAllergenIds = ref(new Set<string>())

const { data: allergensCatalog, isLoading: allergensLoading } = useQuery({
  queryKey: ['allergens'],
  queryFn: async () => {
    const { data, error: e } = await supabase.from('allergens').select('id, name, name_en, slug')
    if (e) return []
    return data ?? []
  },
})

const allAllergens = computed(() => sortAllergensByLocale(allergensCatalog.value ?? [], locale.value))

const toggleAllergen = (id: string) => {
  const next = new Set(selectedAllergenIds.value)
  if (next.has(id)) next.delete(id)
  else if (next.size < 5) next.add(id)
  selectedAllergenIds.value = next
}

// --- Consentement ---
const acceptedTerms = ref(false)
const showConsentModal = ref(false)
const consentStep = ref(0)

const consentSteps = computed(() => [
  {
    title: t('auth.signup.consent_modal.steps.1.title'),
    icon: 'ai',
    content: t('auth.signup.consent_modal.steps.1.content'),
    warning: t('auth.signup.consent_modal.steps.1.warning'),
  },
  {
    title: t('auth.signup.consent_modal.steps.2.title'),
    icon: 'shield',
    content: t('auth.signup.consent_modal.steps.2.content'),
    warning: t('auth.signup.consent_modal.steps.2.warning'),
  },
  {
    title: t('auth.signup.consent_modal.steps.3.title'),
    icon: 'user',
    content: t('auth.signup.consent_modal.steps.3.content'),
    warning: t('auth.signup.consent_modal.steps.3.warning'),
  },
  {
    title: t('auth.signup.consent_modal.steps.4.title'),
    icon: 'legal',
    content: t('auth.signup.consent_modal.steps.4.content'),
    warning: t('auth.signup.consent_modal.steps.4.warning'),
  },
])

const openConsentModal = () => {
  consentStep.value = 0
  showConsentModal.value = true
}

const nextStep = () => {
  if (consentStep.value < consentSteps.value.length - 1) {
    consentStep.value++
  } else {
    acceptedTerms.value = true
    showConsentModal.value = false
  }
}

const prevStep = () => {
  if (consentStep.value > 0) consentStep.value--
}

const passwordValidation = computed(() => validatePassword(password.value))

const handleSignup = async () => {
  if (!acceptedTerms.value) return
  if (!firstName.value.trim() || !lastName.value.trim()) {
    error.value = t('auth.signup.err_identity')
    return
  }
  const { valid: passwordValid, errors: passwordErrors } = validatePassword(password.value)
  if (!passwordValid) {
    error.value = t('auth.signup.err_password', { errors: passwordErrors.join(', ') })
    return
  }
  loading.value = true
  error.value = null
  success.value = false
  requiresEmailConfirmation.value = false

  const signupMetadata = buildSignupMetadata({
    firstName: firstName.value,
    lastName: lastName.value,
    preferences: Array.from(selectedAllergenIds.value),
    acceptedCguAt: new Date().toISOString(),
    acceptedHealthDisclaimer: true,
  })

  const emailRedirectTo = (() => {
    const appUrl = (config.public.appUrl as string | undefined)?.trim()
    if (!appUrl) return undefined
    try {
      return new URL(localePath('/login'), appUrl).toString()
    } catch {
      return undefined
    }
  })()

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: email.value.trim(),
    password: password.value,
    options: {
      data: signupMetadata,
      ...(emailRedirectTo ? { emailRedirectTo } : {}),
    },
  })

  if (signUpError) {
    error.value = signUpError.message || t('auth.signup.err_create')
    loading.value = false
    return
  }

  requiresEmailConfirmation.value = !signUpData.session
  success.value = true
  if (signUpData.session) {
    setTimeout(() => router.push(redirectPath.value), 2000)
  }
  loading.value = false
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-background">
    <div id="main-content" class="flex-1 flex items-center justify-center px-4 pt-4 pb-32 md:pt-20 md:pb-28">
      <div
        class="w-full max-w-md bg-card p-8"
        style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius-lg); box-shadow: var(--bold-shadow-lg);"
      >
        <div class="space-y-1 mb-6">
          <h1 class="text-2xl font-black font-heading tracking-tight">{{ t('auth.signup.title') }}</h1>
          <p class="text-sm text-muted-foreground">{{ t('auth.signup.subtitle') }}</p>
        </div>

        <!-- Success state -->
        <div v-if="success" class="text-center space-y-4 py-8">
          <div
            class="w-16 h-16 flex items-center justify-center mx-auto bg-accent/10"
            style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius); box-shadow: var(--bold-shadow-sm);"
          >
            <AppEmoji :name="APP_EMOJI.success" :size="40" />
          </div>
          <div>
            <h3 class="text-lg font-extrabold font-heading mb-2">{{ t('auth.signup.success_title') }}</h3>
            <p class="text-sm text-muted-foreground">
              {{ requiresEmailConfirmation ? t('auth.signup.success_desc_confirm') : t('auth.signup.success_desc') }}
            </p>
          </div>
          <NuxtLink :to="$localePath('/login')" class="text-primary font-bold hover:underline">
            {{ t('auth.signup.btn_login') }}
          </NuxtLink>
        </div>

        <!-- Form -->
        <form v-else @submit.prevent="handleSignup" class="space-y-4">
          <div
            v-if="error"
            class="p-3 text-sm font-medium flex items-start gap-2"
            style="border: 2px solid hsl(var(--destructive) / 0.3); border-radius: var(--bold-radius-sm); background: hsl(var(--destructive) / 0.1); color: hsl(var(--destructive));"
          >
            <AppEmoji :name="APP_EMOJI.loginError" :size="24" class="shrink-0" />
            <span>{{ error }}</span>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <UiLabel for="firstName" class="font-bold text-sm">{{ t('auth.signup.first_name_label') }}</UiLabel>
              <div class="relative">
                <PhUser class="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none z-10" />
                <UiInput id="firstName" v-model="firstName" :placeholder="t('auth.signup.first_name_placeholder')" class="pl-10" required />
              </div>
            </div>
            <div class="space-y-1.5">
              <UiLabel for="lastName" class="font-bold text-sm">{{ t('auth.signup.last_name_label') }}</UiLabel>
              <UiInput id="lastName" v-model="lastName" :placeholder="t('auth.signup.last_name_placeholder')" required />
            </div>
          </div>

          <div class="space-y-1.5">
            <UiLabel for="email" class="font-bold text-sm">{{ t('auth.signup.email_label') }}</UiLabel>
            <div class="relative">
              <PhEnvelope class="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none z-10" />
              <UiInput id="email" type="email" v-model="email" :placeholder="t('auth.signup.email_placeholder')" required class="pl-10" autocomplete="email" />
            </div>
          </div>

          <div class="space-y-1.5">
            <UiLabel for="password" class="font-bold text-sm">{{ t('auth.signup.password_label') }}</UiLabel>
            <UiPasswordInput
              id="password"
              v-model="password"
              :minlength="12"
              :invalid="password.length > 0 && !passwordValidation.valid"
            />
            <p v-if="password.length > 0 && passwordValidation.errors.length > 0" class="text-xs text-destructive font-medium">{{ t('auth.signup.password_req', { errors: passwordValidation.errors.join(', ') }) }}</p>
            <p v-else-if="password.length === 0" class="text-xs text-muted-foreground font-medium">{{ t('auth.signup.password_desc') }}</p>
          </div>

          <!-- Allergènes (même composant que la page compte) -->
          <AccountAllergensSection
            :all-allergens="allAllergens"
            :user-allergens="selectedAllergenIds"
            :is-loading="allergensLoading"
            @toggle="toggleAllergen"
          />
          <p class="text-xs text-muted-foreground font-medium">{{ t('auth.signup.allergens_note') }}</p>

          <!-- Consentement unique -->
          <div
            class="p-3 rounded-lg"
            style="border: 2px solid hsl(var(--primary) / 0.3); background: hsl(var(--primary) / 0.04);"
          >
            <div class="flex items-start gap-3 cursor-pointer select-none">
              <button
                type="button"
                :aria-label="acceptedTerms ? t('auth.signup.consent_toggle_disable') : t('auth.signup.consent_toggle_enable')"
                class="w-5 h-5 shrink-0 mt-0.5 flex items-center justify-center rounded transition-colors"
                :style="acceptedTerms
                  ? 'background: hsl(var(--primary)); border: 2px solid hsl(var(--primary));'
                  : 'background: transparent; border: 2px solid hsl(var(--border));'"
                @click="acceptedTerms = !acceptedTerms"
              >
                <PhCheck v-if="acceptedTerms" :size="12" weight="bold" class="text-white" />
              </button>
              <span class="text-xs text-muted-foreground leading-relaxed">
                {{ t('auth.signup.consent_accept') }}
                <button type="button" class="text-primary font-semibold underline underline-offset-2 ml-1" @click="openConsentModal()">
                  {{ t('auth.signup.consent_read') }}
                </button>
              </span>
            </div>
          </div>

          <button
            type="submit"
            :disabled="loading || !acceptedTerms || !passwordValidation.valid"
            class="bold-btn bold-btn--primary bold-btn--lg bold-btn--pill w-full"
            :style="(!acceptedTerms || !passwordValidation.valid) ? 'opacity: 0.5; cursor: not-allowed;' : ''"
          >
            <PhSpinnerGap v-if="loading" class="h-5 w-5 animate-spin" />
            <PhUserPlus v-else class="h-5 w-5" />
            {{ loading ? t('auth.signup.loading') : t('auth.signup.submit') }}
          </button>
        </form>

        <p v-if="!success" class="mt-6 text-center text-sm text-muted-foreground font-medium">
          {{ t('auth.signup.already_account') }}
          <NuxtLink :to="$localePath('/login')" class="text-primary font-bold hover:underline">{{ t('auth.signup.btn_login') }}</NuxtLink>
        </p>
      </div>
    </div>

    <!-- Modale de consentement étape par étape -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div
          v-if="showConsentModal"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          style="background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);"
          @click.self="showConsentModal = false"
        >
          <div
            class="w-full max-w-md bg-card"
            style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius-lg); box-shadow: var(--bold-shadow-lg);"
          >
            <!-- Header modale -->
            <div class="flex items-center justify-between p-5 border-b border-border">
              <div>
                <p class="text-xs font-semibold text-muted-foreground mb-0.5">{{ t('auth.signup.consent_modal.step', { current: consentStep + 1, total: consentSteps.length }) }}</p>
                <h2 class="text-base font-black font-heading">{{ consentSteps[consentStep].title }}</h2>
              </div>
              <button
                @click="showConsentModal = false"
                class="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <PhX :size="18" />
              </button>
            </div>

            <!-- Barre de progression -->
            <div class="h-1 bg-muted mx-0">
              <div
                class="h-1 bg-primary transition-all duration-300"
                :style="`width: ${((consentStep + 1) / consentSteps.length) * 100}%`"
              />
            </div>

            <!-- Contenu -->
            <div class="p-5 space-y-4">
              <!-- Alerte visuelle -->
              <div
                class="p-3 rounded-lg flex gap-3"
                style="background: hsl(var(--destructive) / 0.07); border: 1.5px solid hsl(var(--destructive) / 0.3);"
              >
                <PhWarning class="h-5 w-5 shrink-0 mt-0.5" style="color: hsl(var(--destructive));" weight="fill" />
                <p class="text-sm leading-relaxed text-muted-foreground">
                  {{ consentSteps[consentStep].content }}
                </p>
              </div>

              <!-- Ce que vous reconnaissez -->
              <div
                class="p-3 rounded-lg"
                style="background: hsl(var(--primary) / 0.06); border: 1.5px solid hsl(var(--primary) / 0.25);"
              >
                <div class="flex items-start gap-2">
                  <PhCheck class="h-4 w-4 shrink-0 mt-0.5 text-primary" weight="bold" />
                  <p class="text-xs font-semibold text-foreground">{{ consentSteps[consentStep].warning }}</p>
                </div>
              </div>
            </div>

            <!-- Navigation -->
            <div class="flex gap-3 p-5 pt-0">
              <button
                v-if="consentStep > 0"
                type="button"
                class="bold-btn bold-btn--outline bold-btn--pill flex-1 flex items-center justify-center gap-2"
                @click="prevStep"
              >
                <PhArrowLeft :size="16" />
                {{ t('auth.signup.consent_modal.btn_prev') }}
              </button>
              <button
                type="button"
                class="bold-btn bold-btn--primary bold-btn--pill flex-1 flex items-center justify-center gap-2"
                @click="nextStep"
              >
                <template v-if="consentStep < consentSteps.length - 1">
                  {{ t('auth.signup.consent_modal.btn_next') }}
                  <PhArrowRight :size="16" />
                </template>
                <template v-else>
                  <PhCheck :size="16" weight="bold" />
                  {{ t('auth.signup.consent_modal.btn_accept') }}
                </template>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
