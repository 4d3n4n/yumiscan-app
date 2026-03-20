<script setup lang="ts">
import { PhScan, PhSparkle } from '@phosphor-icons/vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    loading?: boolean
    disabled?: boolean
    /** lg = standard, hero = home CTA (bold-btn--hero-cta), xl = overlay */
    size?: 'lg' | 'hero' | 'xl'
    fullWidth?: boolean
    label?: string
    /** Extra class (e.g. animate-pop-in) */
    class?: string
  }>(),
  {
    loading: false,
    disabled: false,
    size: 'lg',
    fullWidth: true,
  }
)

const mergedLabel = computed(() => props.label ?? t('scan.scan.cta.btn_label'))

defineEmits<{ click: [] }>()
</script>

<template>
  <button
    type="button"
    class="bold-btn bold-btn--primary bold-btn--pill"
    :class="[
      (size === 'hero' || size === 'xl') && 'bold-btn--hero-cta',
      size === 'lg' && 'bold-btn--lg',
      size === 'xl' && 'bold-btn--xl',
      fullWidth && 'w-full',
      props.class,
    ]"
    :style="size === 'hero' ? { padding: '1rem 2rem', fontSize: '1.0625rem', borderWidth: '3px' } : size === 'xl' ? { borderWidth: '3px' } : undefined"
    :disabled="disabled || loading"
    @click="$emit('click')"
  >
    <template v-if="loading">
      <span class="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
      <span class="font-extrabold tracking-wider uppercase">{{ t('scan.scan.cta.btn_loading') }}</span>
    </template>
    <template v-else>
      <span class="relative shrink-0">
        <PhScan
          :class="size === 'hero' ? 'w-6 h-6' : size === 'xl' ? 'w-6 h-6' : 'h-5 w-5'"
          weight="duotone"
        />
        <PhSparkle
          :class="[
            'absolute -top-[0.14rem] -right-[0.14rem] text-white',
            size === 'xl' ? 'w-3 h-3' : 'w-2.5 h-2.5',
          ]"
          weight="fill"
        />
      </span>
      <span class="font-extrabold tracking-wider uppercase">{{ mergedLabel }}</span>
    </template>
  </button>
</template>
