<script setup lang="ts">
/**
 * Back-office admin — Scans d'un utilisateur (lecture seule).
 * Même présentation que le dashboard, sans actions ni lien vers le détail du scan.
 */
import { useQuery } from '@tanstack/vue-query'
import {
  PhShieldCheck,
  PhShieldWarning,
  PhWarning,
  PhScan,
  PhSpinnerGap,
  PhArrowLeft,
  PhImageBroken,
} from '@phosphor-icons/vue'
import type { ProductStatus } from '~/utils/types'
import { getScanStatusConfig } from '~/utils/scan'
import type { AdminScanRow } from '~/composables/useEdgeFunctions'
import { extractProductTitle, ingredientCount, alertCount, formatDateRelative } from '~/utils/admin-helpers'
import AppEmoji from '~/components/ui/AppEmoji.vue'
import { APP_EMOJI } from '~/utils/emojis'
import AppAdminSubNav from '~/components/app/AdminSubNav.vue'
import { retryQueryExceptAuth } from '~/utils/query'

definePageMeta({ middleware: ['admin'] })

const route = useRoute()
const userId = computed(() => route.params.userId as string)
const { isAdmin, loading: adminLoading } = useAdmin()

useHead({
  title: 'Scans utilisateur — Back-office YumiScan',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

const { adminUserScans } = useEdgeFunctions()

const { data: scansData, isLoading, error } = useQuery({
  queryKey: ['admin-user-scans', userId],
  queryFn: () => adminUserScans(userId.value),
  enabled: computed(() => !!userId.value && isAdmin.value === true && !adminLoading.value),
  retry: retryQueryExceptAuth,
})

const errorMessage = computed(() => error.value instanceof Error ? error.value.message : '')

const scans = computed(() => scansData.value?.scans ?? [])

const activeFilter = ref<'all' | ProductStatus>('all')
const filteredScans = computed(() => {
  const list = scans.value
  if (activeFilter.value === 'all') return list
  return list.filter((s: AdminScanRow) => s.product_status === activeFilter.value)
})

const STATUS_ICONS: Record<string, typeof PhShieldCheck> = {
  ok: PhShieldCheck,
  contains_allergen: PhShieldWarning,
  ambiguous: PhWarning,
}

function statusConfig(status: string) {
  const c = getScanStatusConfig(status)
  const colors = { color: c.color.replace('700', '600'), bg: c.bg, ring: c.ring.replace('300', '200') }
  return { ...c, ...colors, icon: STATUS_ICONS[status] ?? PhScan }
}

const filters: { key: 'all' | ProductStatus; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'ok', label: 'Conforme' },
  { key: 'contains_allergen', label: 'Allergènes' },
  { key: 'ambiguous', label: 'Douteux' },
]
</script>

<template>
  <div class="min-h-screen flex flex-col bg-background pt-4 pb-24 md:pt-20 md:pb-0">
    <main id="main-content" class="flex-1 container mx-auto px-4 py-8 max-w-lg">
      <div class="flex items-center gap-2 mb-4">
        <NuxtLink
          to="/app/admin/users"
          class="p-2 rounded-lg hover:bg-muted/60 transition-colors"
          aria-label="Retour à la liste des utilisateurs"
        >
          <PhArrowLeft :size="20" weight="bold" class="text-muted-foreground" />
        </NuxtLink>
        <h1 class="text-xl font-black font-heading tracking-tight uppercase">Scans utilisateur</h1>
      </div>
      <p class="text-xs text-muted-foreground font-medium mb-4">User ID : {{ userId }}</p>

      <AppAdminSubNav current="users" />

      <div v-if="error" class="bold-card--static p-4 mb-4 border-red-200 bg-red-50 dark:bg-red-950/30 flex items-start gap-2" style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius);">
        <AppEmoji :name="APP_EMOJI.scanError" :size="28" class="shrink-0" />
        <p class="text-sm font-bold text-red-700 dark:text-red-300">{{ errorMessage }}</p>
      </div>

      <div v-else-if="isLoading" class="flex items-center justify-center py-12" aria-busy="true">
        <PhSpinnerGap class="h-8 w-8 animate-spin text-primary" />
      </div>

      <template v-else>
        <div class="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
          <button
            v-for="f in filters"
            :key="f.key"
            :class="[
              'shrink-0 px-4 py-2 text-sm font-bold transition-all duration-150',
              activeFilter === f.key ? 'bg-primary text-white' : 'bg-card text-foreground hover:bg-muted/50',
            ]"
            style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius-pill); box-shadow: var(--bold-shadow-xs);"
            @click="activeFilter = f.key"
          >
            {{ f.label }}
          </button>
        </div>

        <div class="flex items-center justify-between mb-4">
          <span class="text-xs font-bold px-3 py-1 bg-card" style="border: 2px solid var(--bold-border-color); border-radius: var(--bold-radius-pill);">
            {{ filteredScans.length }} scan{{ filteredScans.length > 1 ? 's' : '' }}
          </span>
        </div>

        <div v-if="filteredScans.length === 0" class="bold-card--static p-8 text-center" style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius);">
          <AppEmoji :name="APP_EMOJI.emptyScan" :size="48" class="mx-auto opacity-70 mb-2" />
          <p class="text-sm font-bold text-muted-foreground">Aucun scan pour cet utilisateur.</p>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="scan in filteredScans"
            :key="scan.id"
            class="bold-card--static flex items-center gap-3 p-3"
            style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius); box-shadow: var(--bold-shadow-sm);"
          >
            <div class="w-14 h-14 shrink-0 overflow-hidden flex items-center justify-center bg-muted/40" style="border: 2px solid var(--bold-border-color); border-radius: var(--bold-radius-sm);">
              <img
                v-if="scan.signed_image_url"
                :src="scan.signed_image_url"
                alt="Miniature du scan"
                class="w-full h-full object-cover"
              >
              <PhImageBroken v-else :size="24" class="text-muted-foreground/40" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-black font-heading leading-tight line-clamp-1 uppercase">
                {{ extractProductTitle(scan as AdminScanRow) }}
              </p>
              <p class="text-xs text-muted-foreground mt-0.5 font-medium">
                {{ ingredientCount(scan as AdminScanRow) }} ingrédients
                <span v-if="alertCount(scan as AdminScanRow) > 0" class="text-red-500 font-bold">
                  &middot; {{ alertCount(scan as AdminScanRow) }} alerte{{ alertCount(scan as AdminScanRow) > 1 ? 's' : '' }}
                </span>
              </p>
              <p class="text-[11px] text-muted-foreground/70 mt-0.5">{{ formatDateRelative(scan.created_at) }}</p>
            </div>
            <div
              :class="[statusConfig(scan.product_status).bg, statusConfig(scan.product_status).ring]"
              class="w-9 h-9 shrink-0 flex items-center justify-center ring-2"
              style="border-radius: 50%;"
            >
              <component
                :is="statusConfig(scan.product_status).icon"
                :size="18"
                weight="fill"
                :class="statusConfig(scan.product_status).color"
              />
            </div>
          </div>
        </div>
      </template>
    </main>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
