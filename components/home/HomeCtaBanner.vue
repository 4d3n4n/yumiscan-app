<script setup lang="ts">
import { PhClockCounterClockwise, PhCaretRight } from '@phosphor-icons/vue'
import homeSections from '~/assets/css/home-sections.module.css'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const localePath = useLocalePath()
const { user } = useAuth()
</script>

<template>
  <NuxtLink
    v-if="user"
    :to="localePath('/app/dashboard')"
    :class="homeSections.ctaBanner"
  >
    <div :class="homeSections.ctaBannerIcon">
      <PhClockCounterClockwise :size="22" weight="bold" class="text-white" />
    </div>
    <div :class="homeSections.ctaBannerText">
      <h3 :class="homeSections.ctaBannerTitle">{{ t('home.cta_banner.title') }}</h3>
      <p :class="homeSections.ctaBannerDesc">{{ t('home.cta_banner.desc') }}</p>
    </div>
    <div :class="homeSections.ctaBannerArrow">
      <PhCaretRight :size="16" weight="bold" class="text-white" />
    </div>
  </NuxtLink>
</template>
