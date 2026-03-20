<script setup lang="ts">
import homeSections from '~/assets/css/home-sections.module.css'

const config = useRuntimeConfig()
const appVersion = config.public.appVersion
const { openCookieSettings } = useCookieConsent()

const handleCookieSettings = () => {
  openCookieSettings()
}
</script>

<template>
  <footer :class="homeSections.footer">
    <span>
      {{ $t('common.footer.rights', { year: new Date().getFullYear() }) }}
      <span class="text-muted-foreground text-xs" :title="$t('common.footer.version_title')"> {{ $t('common.footer.version', { version: appVersion }) }}</span>
    </span>
    <div :class="[homeSections.footerLinks, 'flex-wrap justify-center']">
      <NuxtLink :to="$localePath('/a-propos')" :class="homeSections.footerLink">{{ $t('common.footer.links.about') }}</NuxtLink>
      <NuxtLink :to="$localePath('/blog')" :class="homeSections.footerLink">{{ $t('common.footer.links.blog') }}</NuxtLink>
      <NuxtLink :to="$localePath('/contact')" :class="homeSections.footerLink">{{ $t('common.footer.links.contact') }}</NuxtLink>
      <NuxtLink :to="$localePath('/mentions-legales')" :class="homeSections.footerLink">{{ $t('common.footer.links.legal') }}</NuxtLink>
      <NuxtLink :to="$localePath('/confidentialite')" :class="homeSections.footerLink">{{ $t('common.footer.links.privacy') }}</NuxtLink>
      <NuxtLink :to="$localePath('/cgu')" :class="homeSections.footerLink">{{ $t('common.footer.links.cgu') }}</NuxtLink>
      <NuxtLink :to="$localePath('/cgv')" :class="homeSections.footerLink">{{ $t('common.footer.links.cgv') }}</NuxtLink>
      <NuxtLink :to="$localePath('/avertissement-sante')" :class="homeSections.footerLink">{{ $t('common.footer.links.health') }}</NuxtLink>
      <button :class="homeSections.footerLink" type="button" @click="handleCookieSettings">{{ $t('common.footer.links.cookies') }}</button>
    </div>

    <span class="flex flex-row flex-wrap items-center justify-center gap-2">
      <img src="/images/payment/stripe.webp" alt="Stripe" class="h-6 w-auto object-contain">
      <img src="/images/AdenCore.png" alt="AdenCore Tech" class="w-3 h-3 object-contain rounded-full">
      <a href="https://adenan.xyz" target="_blank" rel="noopener noreferrer" class="text-s text-muted-foreground font-medium">{{ $t('common.footer.credit') }}</a>
    </span>
  </footer>
</template>
