<script setup lang="ts">
type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'ia-action'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const props = withDefaults(defineProps<{
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
  disabled?: boolean
}>(), {
  variant: 'primary',
  size: 'md',
  isLoading: false,
  disabled: false,
})

const attrs = useAttrs()

const variants: Record<ButtonVariant, string> = {
  primary: "bg-[var(--scan-primary)] text-white hover:bg-[var(--scan-primary-dark)] shadow-[var(--scan-shadow-md)] hover:shadow-[var(--scan-shadow-lg)]",
  secondary: "border border-input bg-background/80 backdrop-blur-sm hover:bg-accent hover:text-accent-foreground shadow-sm",
  tertiary: "hover:bg-accent hover:text-accent-foreground text-muted-foreground",
  'ia-action': "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-md hover:shadow-lg hover:from-violet-600 hover:to-fuchsia-600 border border-white/20",
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-xs',
  md: 'h-11 px-6 py-2',
  lg: 'h-14 px-8 text-base',
  icon: 'h-11 w-11',
}

const classes = computed(() => cn(
  'inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium transition-all',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  'disabled:pointer-events-none disabled:opacity-50 select-none active:scale-[0.98]',
  variants[props.variant],
  sizes[props.size],
  attrs.class as string
))
</script>

<template>
  <button :class="classes" :disabled="props.disabled || props.isLoading">
    <slot />
  </button>
</template>

<script lang="ts">
export default { inheritAttrs: false }
</script>
