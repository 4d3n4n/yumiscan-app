<template>
  <div
    :class="[
      'bold-card--static w-full max-w-lg p-6',
      $attrs.class
    ]"
  >
    <slot />
  </div>
</template>

<script lang="ts">
export default { inheritAttrs: false }
</script>
