<script setup lang="ts">
const props = withDefaults(defineProps<{ orientation?: 'vertical' | 'horizontal' }>(), {
  orientation: 'vertical',
})
</script>

<template>
  <div
    :class="cn(
      'relative overflow-auto',
      props.orientation === 'horizontal' ? 'overflow-x-auto' : 'overflow-y-auto',
      $attrs.class as string
    )"
  >
    <slot />
  </div>
</template>

<script lang="ts">
export default { inheritAttrs: false }
</script>
