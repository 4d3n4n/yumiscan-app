<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

defineProps<{
  disabled?: boolean
  loading?: boolean
}>()

const emit = defineEmits<{ scan: [] }>()
</script>

<template>
  <div class="relative flex flex-col items-center gap-5 w-full max-w-sm mx-auto z-10">
    <ScanCtaButton
      size="xl"
      :loading="loading"
      :disabled="disabled"
      @click="emit('scan')"
    />

    <p class="text-[10px] text-muted-foreground/70 text-center leading-relaxed max-w-xs px-4">
      <span class="font-bold block mb-0.5 text-primary/80 uppercase tracking-wider text-[9px]">{{ t('scan.scan.actions.disclaimer_title') }}</span>
      {{ t('scan.scan.actions.disclaimer_text') }}
    </p>
  </div>
</template>
