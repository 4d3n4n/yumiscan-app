<script setup lang="ts">
import { PhSpinnerGap, PhCheck } from '@phosphor-icons/vue'
import type { AllergenCatalogRow } from '~/utils/types'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps<{
  allergensCatalog: AllergenCatalogRow[]
  allergensLoading: boolean
  selectedAllergenIds: Set<string>
  toggleError?: string | null
}>()

const emit = defineEmits<{ toggle: [allergenId: string] }>()
</script>

<template>
  <section class="space-y-4">
    <div class="text-center space-y-1 mb-4">
      <h2 class="text-lg font-extrabold font-heading tracking-tight">
        {{ t('scan.scan.filters.title') }}
      </h2>
      <p class="text-sm text-muted-foreground">
        {{ t('scan.scan.filters.subtitle') }}
      </p>
    </div>

    <div class="pt-1">
      <div v-if="allergensLoading" class="flex items-center justify-center py-6 text-muted-foreground">
        <PhSpinnerGap class="animate-spin mr-2 h-5 w-5" />
        <span class="text-sm font-medium">{{ t('scan.scan.filters.loading') }}</span>
      </div>

      <div v-else class="flex flex-wrap gap-2.5 justify-center">
        <button
          v-for="a in allergensCatalog"
          :key="a.id"
          @click="emit('toggle', a.id)"
          :class="[
            'bold-pill transition-colors',
            selectedAllergenIds.has(a.id)
              ? 'bold-pill--primary'
              : ''
          ]"
        >
          <PhCheck v-if="selectedAllergenIds.has(a.id)" :size="12" weight="bold" />
          <span>{{ a.name }}</span>
        </button>
      </div>

      <p v-if="toggleError" class="text-xs text-destructive mt-2 text-center font-medium">
        {{ toggleError }}
      </p>
    </div>
  </section>
</template>
