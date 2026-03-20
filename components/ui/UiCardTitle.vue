<template>
  <h3 :class="cn('text-2xl font-semibold leading-none tracking-tight', $attrs.class as string)">
    <slot />
  </h3>
</template>

<script lang="ts">
export default { inheritAttrs: false }
</script>
