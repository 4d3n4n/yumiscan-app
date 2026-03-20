<script setup lang="ts">
import { PhUserPlus } from '@phosphor-icons/vue'
import { EMOJI_MAP, APP_EMOJI } from '~/utils/emojis'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const localePath = useLocalePath()

const props = defineProps<{
  open: boolean
  redirectTo?: string
}>()

const emit = defineEmits<{ close: [] }>()

const router = useRouter()
const route = useRoute()

watch(() => props.open, (isOpen) => {
  if (!isOpen) {
    // reset is handled by AuthLoginForm internal state when remounted
  }
})

watch(() => route.fullPath, () => {
  if (props.open) {
    emit('close')
  }
})

const redirectPath = computed(() => props.redirectTo || localePath('/app/dashboard'))

const onLoginSuccess = async (path: string) => {
  emit('close')
  await router.push(path)
}

const goSignup = () => {
  emit('close')
  const redirect = props.redirectTo || localePath('/app/dashboard')
  const query = redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''
  navigateTo(`${localePath('/signup')}${query}`)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="fixed inset-0 z-[100] flex items-center justify-center p-4" @click.self="emit('close')">
        <div class="fixed inset-0 bg-black/60 backdrop-blur-sm" @click="emit('close')" />

        <div
          class="relative z-10 w-full max-w-sm bg-card overflow-hidden animate-pop-in"
          style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius-lg); box-shadow: var(--bold-shadow-lg);"
        >
          <!-- Header -->
            <div class="relative px-6 pt-8 pb-2 text-center">
              <div
                class="w-14 h-14 flex items-center justify-center mx-auto mb-3 bg-primary/10 overflow-hidden"
                style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius); box-shadow: var(--bold-shadow-xs);"
              >
                <img
                  :src="EMOJI_MAP[APP_EMOJI.login]"
                  alt=""
                  width="48"
                  height="48"
                  class="w-12 h-12 object-contain select-none"
                />
              </div>
              <h2 class="text-xl font-black font-heading tracking-tight mb-1">{{ t('auth.guard.title') }}</h2>
              <p class="text-sm text-muted-foreground leading-relaxed">
                {{ t('auth.guard.description') }}
              </p>
            </div>

          <!-- Form partagé -->
          <div class="px-6 pb-4">
            <AuthLoginForm
              :redirect-to="redirectPath"
              email-id="auth-modal-email"
              password-id="auth-modal-password"
              @forgot-password="emit('close')"
              @success="onLoginSuccess"
            />
          </div>

          <!-- Footer actions -->
          <div class="px-6 pb-6 space-y-2">
            <button
              type="button"
              @click="goSignup"
              class="bold-btn bold-btn--secondary bold-btn--lg bold-btn--pill w-full"
            >
              <PhUserPlus :size="18" weight="bold" />
              {{ t('auth.guard.create_account') }}
            </button>

            <button
              type="button"
              @click="emit('close')"
              class="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2 font-semibold"
            >
              {{ t('common.cancel') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
