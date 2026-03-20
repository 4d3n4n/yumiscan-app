<script setup lang="ts">
defineProps<{
  modelValue?: string
  type?: string
  placeholder?: string
  required?: boolean
  minlength?: number
  id?: string
  disabled?: boolean
  autocomplete?: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <input
    :type="type || 'text'"
    :value="modelValue"
    :placeholder="placeholder"
    :required="required"
    :minlength="minlength"
    :id="id"
    :disabled="disabled"
    :autocomplete="autocomplete"
    :class="['bold-input', $attrs.class]"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>

<script lang="ts">
export default { inheritAttrs: false }
</script>
