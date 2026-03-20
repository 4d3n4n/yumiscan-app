<script setup lang="ts">
type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'accent' | 'muted'

const props = withDefaults(defineProps<{
  variant?: BadgeVariant
}>(), {
  variant: 'default',
})

const variantClass = computed(() => {
  const map: Record<BadgeVariant, string> = {
    default: 'bold-pill--primary',
    secondary: '',
    destructive: 'bg-destructive text-destructive-foreground',
    outline: 'bold-pill--outline',
    accent: 'bold-pill--accent',
    muted: 'bold-pill--muted',
  }
  return map[props.variant]
})
</script>

<template>
  <span :class="['bold-pill', variantClass, $attrs.class]">
    <slot />
  </span>
</template>

<script lang="ts">
export default { inheritAttrs: false }
</script>
