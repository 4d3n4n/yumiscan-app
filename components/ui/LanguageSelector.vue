<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SupportedLocale } from '~/utils/locale-detection'

const { locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()
const router = useRouter()

type LocaleOption = {
  code: SupportedLocale
}

const localeOptions = computed(() => {
  const currentLocales = locales.value as LocaleOption[]
  return currentLocales.filter((entry) => typeof entry.code === 'string' && entry.code.length > 0)
})

const changeLocale = (code: SupportedLocale) => {
  if (code === locale.value) return
  const path = switchLocalePath(code)
  if (path) {
    router.push(path)
  }
}
</script>

<template>
  <div
    class="language-switch"
    role="group"
    :aria-label="$t('common.language_switch')"
    :title="$t('common.language_switch')"
  >

    <button
      v-for="option in localeOptions"
      :key="option.code"
      type="button"
      class="language-switch__option"
      :class="{ 'language-switch__option--active': option.code === locale }"
      :aria-pressed="option.code === locale"
      @click="changeLocale(option.code)"
    >
      {{ option.code.toUpperCase() }}
    </button>
  </div>
</template>

<style scoped>
.language-switch {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem;
  border: 2px solid var(--bold-border-color);
  border-radius: var(--bold-radius-pill);
  background: hsl(var(--card));
  box-shadow: var(--bold-shadow-xs);
}

.language-switch__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.9rem;
  height: 1.9rem;
  border-radius: 999px;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 0.1);
  border: 1.5px solid hsl(var(--primary) / 0.16);
  flex-shrink: 0;
}

.language-switch__option {
  min-width: 2.5rem;
  height: 1.9rem;
  padding: 0 0.65rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: hsl(var(--muted-foreground));
  font-size: 0.7rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  transition:
    background-color 140ms ease,
    color 140ms ease,
    transform 140ms ease;
}

.language-switch__option:hover {
  color: hsl(var(--foreground));
}

.language-switch__option:active {
  transform: translateY(1px);
}

.language-switch__option--active {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  box-shadow: inset 0 -2px 0 hsl(var(--primary) / 0.22);
}
</style>
