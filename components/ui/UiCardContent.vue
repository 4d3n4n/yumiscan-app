<template>
  <div :class="cn('p-6 pt-0', $attrs.class as string)">
    <slot />
  </div>
</template>

<script lang="ts">
export default { inheritAttrs: false }
</script>
