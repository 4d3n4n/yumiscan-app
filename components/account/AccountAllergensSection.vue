<script setup lang="ts">
import { PhWarningCircle, PhSparkle } from '@phosphor-icons/vue'
import AppEmoji from '~/components/ui/AppEmoji.vue'
import { APP_EMOJI } from '~/utils/emojis'
import { getLocalizedAllergenName } from '~/utils/allergens'
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()

interface Allergen {
  id: string
  name: string
  name_en: string | null
  slug: string | null
}

const props = defineProps<{
  allAllergens: Allergen[] | undefined
  userAllergens: Set<string>
  isLoading?: boolean
}>()

const emit = defineEmits<{ toggle: [allergenId: string] }>()

const activeCount = computed(() => props.userAllergens.size)

const localizedAllergens = computed(() =>
  (props.allAllergens ?? []).map((allergen) => ({
    ...allergen,
    localizedName: getLocalizedAllergenName(allergen, locale.value),
  })),
)
</script>

<template>
  <div class="space-y-3">

    <!-- Header row -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <PhWarningCircle :size="16" weight="duotone" class="text-primary" />
        <span class="text-sm font-bold font-heading uppercase tracking-tight">{{ t('account.allergens.title') }}</span>
      </div>
      <span class="bold-pill bold-pill--muted" style="font-size: 9px; padding: 0.15rem 0.5rem;">
        {{ t('account.allergens.lbl_active_count', { count: activeCount }) }}
      </span>
    </div>

    <p class="text-xs text-muted-foreground font-medium leading-relaxed">
      {{ t('account.allergens.desc') }}
    </p>

    <!-- Pills -->
    <div v-if="isLoading" class="flex flex-wrap gap-2">
      <div v-for="i in 6" :key="i" class="h-8 w-20 rounded-full animate-pulse" style="background: hsl(var(--muted));" />
    </div>

    <div v-else-if="localizedAllergens.length > 0" class="flex align-center justify-center flex-wrap gap-2">
      <button
        v-for="allergen in localizedAllergens"
        :key="allergen.id"
        type="button"
        :class="[
          'bold-pill',
          userAllergens.has(allergen.id) ? 'bold-pill--primary' : ''
        ]"
        @click="emit('toggle', allergen.id)"
      >
        <PhSparkle v-if="userAllergens.has(allergen.id)" :size="10" weight="fill" />
        <span>{{ allergen.localizedName }}</span>
      </button>
    </div>

    <div v-else class="flex flex-col items-center gap-2 py-2">
      <AppEmoji :name="APP_EMOJI.emptyScan" :size="40" class="opacity-70" />
      <p class="text-xs text-muted-foreground italic">{{ t('account.allergens.empty_desc') }}</p>
    </div>

  </div>
</template>
