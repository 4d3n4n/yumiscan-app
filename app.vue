<script setup lang="ts">
import type { TransitionProps } from 'vue'

type AppPageTransition = {
  name: string
  mode: NonNullable<TransitionProps['mode']>
}

const DEFAULT_PAGE_TRANSITION: AppPageTransition = {
  name: 'page-public',
  mode: 'default',
}

function isTransitionMode(value: unknown): value is NonNullable<TransitionProps['mode']> {
  return value === 'default' || value === 'in-out' || value === 'out-in'
}

function resolvePageTransition(value: unknown): AppPageTransition {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_PAGE_TRANSITION
  }

  const transition = value as Record<string, unknown>
  return {
    name: typeof transition.name === 'string' && transition.name.length > 0
      ? transition.name
      : DEFAULT_PAGE_TRANSITION.name,
    mode: isTransitionMode(transition.mode)
      ? transition.mode
      : DEFAULT_PAGE_TRANSITION.mode,
  }
}

const route = useRoute()
const pageTransition = computed(() => resolvePageTransition(route.meta.pageTransition))
</script>

<template>
  <NuxtLayout>
    <NuxtPage :transition="pageTransition" />
  </NuxtLayout>
  <ClientOnly>
    <ScanOverlay />
    <AppOnboardingOverlay />
    <HomeCookieBanner />
  </ClientOnly>
</template>
