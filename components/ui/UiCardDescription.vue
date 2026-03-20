<template>
  <p :class="cn('text-sm text-muted-foreground', $attrs.class as string)">
    <slot />
  </p>
</template>

<script lang="ts">
export default { inheritAttrs: false }
</script>
