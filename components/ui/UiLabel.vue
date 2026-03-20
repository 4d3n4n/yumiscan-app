<script setup lang="ts">
defineProps<{ for?: string }>()
</script>

<template>
  <label
    :for="$props.for"
    :class="cn('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', $attrs.class as string)"
  >
    <slot />
  </label>
</template>

<script lang="ts">
export default { inheritAttrs: false }
</script>
