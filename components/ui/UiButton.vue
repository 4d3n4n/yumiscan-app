<script setup lang="ts">
type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'link' | 'accent' | 'destructive'
type ButtonSize = 'default' | 'sm' | 'lg' | 'xl' | 'icon'

const props = withDefaults(defineProps<{
  variant?: ButtonVariant
  size?: ButtonSize
  pill?: boolean
  disabled?: boolean
}>(), {
  variant: 'default',
  size: 'default',
  pill: false,
  disabled: false,
})

const variantClass = computed(() => {
  const map: Record<ButtonVariant, string> = {
    default: 'bold-btn--primary',
    secondary: 'bold-btn--secondary',
    outline: 'bold-btn--secondary',
    ghost: 'bold-btn--ghost',
    link: 'bold-btn--ghost',
    accent: 'bold-btn--accent',
    destructive: 'bold-btn--destructive',
  }
  return map[props.variant]
})

const sizeClass = computed(() => {
  const map: Record<ButtonSize, string> = {
    sm: 'bold-btn--sm',
    default: 'bold-btn--md',
    lg: 'bold-btn--lg',
    xl: 'bold-btn--xl',
    icon: 'bold-btn--sm',
  }
  return map[props.size]
})
</script>

<template>
  <button
    :class="['bold-btn', variantClass, sizeClass, pill ? 'bold-btn--pill' : '']"
    :disabled="props.disabled"
  >
    <slot />
  </button>
</template>
