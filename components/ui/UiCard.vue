<script setup lang="ts">
defineProps<{
  static?: boolean
}>()
</script>

<template>
  <div :class="[$props.static ? 'bold-card--static' : 'bold-card', $attrs.class]">
    <slot />
  </div>
</template>

<script lang="ts">
export default { inheritAttrs: false }
</script>
