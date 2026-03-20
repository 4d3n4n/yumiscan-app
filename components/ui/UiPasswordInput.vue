<script setup lang="ts">
import { PhEye, PhEyeSlash } from '@phosphor-icons/vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    modelValue: string
    id: string
    placeholder?: string
    autocomplete?: string
    disabled?: boolean
    invalid?: boolean
    minlength?: number
    required?: boolean
    inputClass?: string
  }>(),
  {
    placeholder: '********',
    autocomplete: 'current-password',
    disabled: false,
    invalid: false,
    minlength: undefined,
    required: false,
    inputClass: '',
  }
)

const emit = defineEmits<{ 'update:modelValue': [value: string]; input: [] }>()
const { t } = useI18n()

const showPassword = ref(false)

const type = computed(() => (showPassword.value ? 'text' : 'password'))

function onInput(value: string) {
  emit('update:modelValue', value)
  emit('input')
}
</script>

<template>
  <div class="relative">
    <button
      type="button"
      class="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground hover:text-foreground z-10 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary rounded"
      :aria-label="showPassword ? t('common.password.hide') : t('common.password.show')"
      @click="showPassword = !showPassword"
    >
      <PhEyeSlash v-if="showPassword" class="h-5 w-5" />
      <PhEye v-else class="h-5 w-5" />
    </button>
    <UiInput
      :id="props.id"
      :model-value="modelValue"
      :type="type"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :disabled="disabled"
      :required="required"
      :minlength="minlength"
      :class="[
        'pl-10',
        inputClass,
        invalid ? 'border-destructive' : '',
      ]"
      @update:model-value="onInput"
    />
  </div>
</template>
