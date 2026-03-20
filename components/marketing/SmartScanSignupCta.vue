<script setup lang="ts">
const props = defineProps<{
  translationBase: string
}>()

const { t } = useI18n()
const localePath = useLocalePath()
const { user } = useAuth()
const { openScan } = useScanFlow()

const isAuthenticated = computed(() => !!user.value)

const badge = computed(() =>
  t(`${props.translationBase}.${isAuthenticated.value ? 'user' : 'guest'}.badge`)
)

const title = computed(() =>
  t(`${props.translationBase}.${isAuthenticated.value ? 'user' : 'guest'}.title`)
)

const description = computed(() =>
  t(`${props.translationBase}.${isAuthenticated.value ? 'user' : 'guest'}.description`)
)

const buttonLabel = computed(() =>
  t(`${props.translationBase}.${isAuthenticated.value ? 'user' : 'guest'}.button`)
)
</script>

<template>
  <section
    class="bold-card--static mt-10 p-5 md:p-6"
    style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius); box-shadow: var(--bold-shadow-sm);"
  >
    <p class="text-xs font-bold uppercase tracking-[0.12em] text-primary mb-3">
      {{ badge }}
    </p>
    <h2 class="text-xl md:text-2xl font-black font-heading tracking-tight text-foreground mb-3">
      {{ title }}
    </h2>
    <p class="text-sm text-muted-foreground font-medium leading-relaxed mb-5">
      {{ description }}
    </p>

    <ScanCtaButton
      v-if="isAuthenticated"
      :label="buttonLabel"
      :full-width="false"
      class="inline-flex"
      @click="openScan()"
    />

    <NuxtLink
      v-else
      :to="localePath('/signup')"
      class="bold-btn bold-btn--primary bold-btn--pill inline-flex px-6 py-3"
    >
      {{ buttonLabel }}
    </NuxtLink>
  </section>
</template>
