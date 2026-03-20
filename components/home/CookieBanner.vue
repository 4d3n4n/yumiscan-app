<script setup lang="ts">
import { PhCookie, PhX, PhCheck, PhSliders } from '@phosphor-icons/vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const {
  hasConsented,
  consent,
  acceptAll,
  rejectAll,
  saveCustom,
  forceShowCookieBanner,
  showCookieModal,
  closeCookieBanner,
  closeCookieModal,
} = useCookieConsent()

const customAnalytics = ref(false)
const customAds = ref(false)

watch(showCookieModal, (open) => {
  if (open && consent.value) {
    customAnalytics.value = consent.value.analytics
    customAds.value = consent.value.ads
  } else if (open) {
    customAnalytics.value = false
    customAds.value = false
  }
})

const saveAndClose = () => {
  saveCustom({ analytics: customAnalytics.value, ads: customAds.value })
  closeCookieModal()
}
</script>

<template>
  <ClientOnly>
  <div>
    <!-- Banner principal (première visite OU clic "Gestion des cookies" dans le footer) -->
    <Transition name="banner-slide">
      <div
        v-if="!hasConsented || forceShowCookieBanner"
        class="cookie-banner fixed top-0 md:top-auto md:bottom-0 left-0 right-0 z-[60] p-4 md:p-5"
      >
        <div class="max-w-2xl mx-auto">
          <div class="flex items-start gap-3 mb-4">
            <PhCookie class="h-5 w-5 shrink-0 mt-0.5 text-primary" weight="duotone" />
            <div>
              <p class="text-sm font-bold text-foreground mb-1">{{ t('common.cookie_banner.title') }}</p>
              <p class="text-xs text-muted-foreground leading-relaxed">
                {{ t('common.cookie_banner.desc_part1') }}
                <NuxtLink :to="$localePath('/confidentialite')" class="text-primary underline ml-1">{{ t('common.cookie_banner.desc_link') }}</NuxtLink>
              </p>
            </div>
          </div>
          <div class="flex flex-col sm:flex-row gap-2">
            <button
              class="bold-btn bold-btn--outline bold-btn--pill text-sm flex items-center justify-center gap-2 flex-1"
              @click="closeCookieBanner(); showCookieModal = true"
            >
              <PhSliders :size="15" />
              {{ t('common.cookie_banner.btn_customize') }}
            </button>
            <button
              class="bold-btn bold-btn--outline bold-btn--pill text-sm flex items-center justify-center gap-2 flex-1"
              @click="rejectAll(); closeCookieBanner()"
            >
              <PhX :size="15" />
              {{ t('common.cookie_banner.btn_reject_all') }}
            </button>
            <button
              class="bold-btn bold-btn--primary bold-btn--pill text-sm flex items-center justify-center gap-2 flex-1"
              @click="acceptAll(); closeCookieBanner()"
            >
              <PhCheck :size="15" weight="bold" />
              {{ t('common.cookie_banner.btn_accept_all') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Modale personnalisation -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div
          v-if="showCookieModal"
          class="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4"
          style="background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);"
          @click.self="closeCookieModal()"
        >
          <div
            class="w-full max-w-md bg-card"
            style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius-lg); box-shadow: var(--bold-shadow-lg);"
          >
            <!-- Header -->
            <div class="flex items-center justify-between p-5 border-b border-border">
              <h2 class="text-base font-black font-heading">{{ t('common.cookie_banner.modal_title') }}</h2>
              <button
                @click="closeCookieModal()"
                class="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <PhX :size="18" />
              </button>
            </div>

            <!-- Catégories -->
            <div class="p-5 space-y-3">

              <!-- Nécessaires (toujours actif) -->
              <div class="bold-card--static p-4 flex items-start justify-between gap-4">
                <div>
                  <p class="text-sm font-bold text-foreground mb-1">{{ t('common.cookie_banner.necessary_title') }}</p>
                  <p class="text-xs text-muted-foreground leading-relaxed">
                    {{ t('common.cookie_banner.necessary_desc') }}
                  </p>
                </div>
                <div
                  class="shrink-0 w-10 h-6 rounded-full flex items-center px-1"
                  style="background: hsl(var(--primary) / 0.25); cursor: not-allowed;"
                >
                  <div class="w-4 h-4 rounded-full ml-auto" style="background: hsl(var(--primary));" />
                </div>
              </div>

              <!-- Analytiques -->
              <div class="bold-card--static p-4 flex items-start justify-between gap-4">
                <div class="flex-1">
                  <p class="text-sm font-bold text-foreground mb-1">{{ t('common.cookie_banner.analytics_title') }}</p>
                  <p class="text-xs text-muted-foreground leading-relaxed">
                    {{ t('common.cookie_banner.analytics_desc') }}
                  </p>
                </div>
                <button
                  type="button"
                  class="shrink-0 w-10 h-6 rounded-full flex items-center px-1 transition-colors duration-200"
                  :style="customAnalytics
                    ? 'background: hsl(var(--primary));'
                    : 'background: hsl(var(--muted));'"
                  :aria-label="customAnalytics ? t('common.cookie_banner.analytics_disable_aria') : t('common.cookie_banner.analytics_enable_aria')"
                  @click="customAnalytics = !customAnalytics"
                >
                  <div
                    class="w-4 h-4 rounded-full bg-white transition-transform duration-200"
                    :style="customAnalytics ? 'transform: translateX(16px);' : 'transform: translateX(0);'"
                  />
                </button>
              </div>

              <!-- Publicitaires -->
              <div class="bold-card--static p-4 flex items-start justify-between gap-4">
                <div class="flex-1">
                  <p class="text-sm font-bold text-foreground mb-1">{{ t('common.cookie_banner.ads_title') }}</p>
                  <p class="text-xs text-muted-foreground leading-relaxed">
                    {{ t('common.cookie_banner.ads_desc') }}
                  </p>
                </div>
                <button
                  type="button"
                  class="shrink-0 w-10 h-6 rounded-full flex items-center px-1 transition-colors duration-200"
                  :style="customAds
                    ? 'background: hsl(var(--primary));'
                    : 'background: hsl(var(--muted));'"
                  :aria-label="customAds ? t('common.cookie_banner.ads_disable_aria') : t('common.cookie_banner.ads_enable_aria')"
                  @click="customAds = !customAds"
                >
                  <div
                    class="w-4 h-4 rounded-full bg-white transition-transform duration-200"
                    :style="customAds ? 'transform: translateX(16px);' : 'transform: translateX(0);'"
                  />
                </button>
              </div>
            </div>

            <!-- Footer modale -->
            <div class="flex gap-3 p-5 pt-0">
              <button
                class="bold-btn bold-btn--outline bold-btn--pill flex-1 text-sm"
                @click="rejectAll(); closeCookieModal()"
              >
                {{ t('common.cookie_banner.btn_reject_all') }}
              </button>
              <button
                class="bold-btn bold-btn--primary bold-btn--pill flex-1 text-sm flex items-center justify-center gap-2"
                @click="saveAndClose"
              >
                <PhCheck :size="15" weight="bold" />
                {{ t('common.save') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
  </ClientOnly>
</template>

<style scoped>
.cookie-banner {
  background: hsl(var(--card));
  border-bottom: 2px solid var(--bold-border-color);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.18);
}
@media (min-width: 768px) {
  .cookie-banner {
    border-bottom: none;
    border-top: 2px solid var(--bold-border-color);
    box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.18);
  }
}
.banner-slide-enter-active,
.banner-slide-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.banner-slide-enter-from,
.banner-slide-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
@media (min-width: 768px) {
  .banner-slide-enter-from,
  .banner-slide-leave-to {
    transform: translateY(100%);
  }
}
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
