<script setup lang="ts">
/**
 * Back-office admin — Tableau de bord KPI.
 * Accès réservé aux utilisateurs avec user_profiles.is_admin = true.
 */
import { useQuery } from '@tanstack/vue-query'
import {
  PhShieldCheck,
  PhUsers,
  PhScan,
  PhCreditCard,
  PhSpinnerGap,
  PhBug,
} from '@phosphor-icons/vue'
import type { AdminKpiResponse } from '~/composables/useEdgeFunctions'
import { ADMIN_STATUS_LABELS } from '~/utils/admin-helpers'
import AppEmoji from '~/components/ui/AppEmoji.vue'
import { APP_EMOJI } from '~/utils/emojis'
import AppAdminSubNav from '~/components/app/AdminSubNav.vue'
import { retryQueryExceptAuth } from '~/utils/query'

definePageMeta({ middleware: ['admin'] })

useHead({
  title: 'Back-office — YumiScan',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

const { user } = useAuth()
const { isAdmin, loading: adminLoading } = useAdmin()
const { adminKpi } = useEdgeFunctions()

const timeFilter = ref<'today' | '7d' | '30d' | '1y' | 'all' | 'custom'>('30d')
// Default to 1st of month for custom
const customStartDate = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
const customEndDate = ref(new Date().toISOString().split('T')[0])

// Construction des dates d'appel (ISO)
const fetchParams = computed(() => {
  if (timeFilter.value === 'all') return {}
  if (timeFilter.value === 'custom') {
    const s = customStartDate.value ? new Date(customStartDate.value).toISOString() : undefined
    // For end date, we want the *end* of the day to include the whole day
    const e = customEndDate.value ? new Date(`${customEndDate.value}T23:59:59.999Z`).toISOString() : undefined
    return { startDate: s, endDate: e }
  }

  const now = new Date()
  if (timeFilter.value === 'today') {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    return { startDate: startOfDay }
  }

  let daysAgo = 30
  if (timeFilter.value === '7d') daysAgo = 7
  if (timeFilter.value === '1y') daysAgo = 365

  const start = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
  return { startDate: start.toISOString() }
})

const { data: kpi, isLoading, error } = useQuery({
  queryKey: ['admin-kpi', fetchParams],
  queryFn: () => adminKpi(fetchParams.value),
  enabled: computed(() => !!user.value && isAdmin.value === true && !adminLoading.value),
  retry: retryQueryExceptAuth,
})

const errorMessage = computed(() => error.value instanceof Error ? error.value.message : '')

const statusLabels = ADMIN_STATUS_LABELS

// Couleurs par status pour les barres de graphe
const statusColors: Record<string, string> = {
  ok: 'bg-green-500',
  contains_allergen: 'bg-red-500',
  ambiguous: 'bg-orange-500',
  not_food: 'bg-gray-500',
  unknown: 'bg-gray-500',
}

function formatEuroFromCents(cents: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format((cents ?? 0) / 100)
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return 'n/a'
  if (ms < 1000) return `${Math.round(ms)} ms`
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)} s`
  return `${(ms / 1000).toFixed(0)} s`
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-background pt-4 pb-24 md:pt-20 md:pb-0">
    <main id="main-content" class="flex-1 container mx-auto px-4 py-8 max-w-lg">
      <div class="flex items-center gap-2 mb-6">
        <PhShieldCheck :size="24" weight="duotone" class="text-primary" />
        <h1 class="text-xl font-black font-heading tracking-tight uppercase">Back-office</h1>
      </div>

      <AppAdminSubNav current="dashboard" />

      <!-- Loading -->
      <div v-if="isLoading" class="flex items-center justify-center py-12" aria-busy="true">
        <PhSpinnerGap class="h-8 w-8 animate-spin text-primary" />
      </div>

      <!-- Erreur -->
      <div
        v-else-if="error"
        class="bold-card--static p-4 border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 flex items-start gap-2"
        style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius);"
      >
        <AppEmoji :name="APP_EMOJI.scanError" :size="28" class="shrink-0" />
        <div>
        <p class="text-sm font-bold text-red-700 dark:text-red-300">
          {{ errorMessage }}
        </p>
        <p v-if="errorMessage.includes('401') || errorMessage.toLowerCase().includes('token') || errorMessage.toLowerCase().includes('unauthorized')" class="text-xs text-red-600 dark:text-red-400 mt-2">
          En local : utilisez le même Supabase pour l’app et les Edge Functions, puis reconnectez-vous.
        </p>
        </div>
      </div>

      <!-- KPI -->
      <div v-else-if="kpi" class="space-y-4">
        <!-- Filtres temporels -->
        <div class="bold-card--static p-4 flex flex-col gap-3" style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius); box-shadow: var(--bold-shadow-sm);">
          <div class="flex items-center gap-2">
            <label for="timeFilter" class="text-sm font-bold w-24">Période :</label>
            <select
              id="timeFilter"
              v-model="timeFilter"
              class="flex-1 bg-muted px-3 py-2 text-sm rounded-lg font-medium border border-border focus:ring-2 focus:ring-primary focus:outline-none"
            >
              <option value="today">Aujourd'hui</option>
              <option value="7d">Les 7 derniers jours</option>
              <option value="30d">Les 30 derniers jours</option>
              <option value="1y">La dernière année</option>
              <option value="all">Depuis toujours (All time)</option>
              <option value="custom">Période personnalisée...</option>
            </select>
          </div>

          <div v-show="timeFilter === 'custom'" class="flex items-center gap-2 mt-2">
            <input
              type="date"
              v-model="customStartDate"
              class="flex-1 w-full bg-muted px-3 py-2 text-sm rounded-lg font-medium border border-border focus:ring-2 focus:ring-primary focus:outline-none"
            />
            <span class="text-xs font-bold px-1">à</span>
            <input
              type="date"
              v-model="customEndDate"
              class="flex-1 w-full bg-muted px-3 py-2 text-sm rounded-lg font-medium border border-border focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>
        </div>

        <!-- Global Vitalité (DAU / MAU / Conversion) indépendant de la période -->
        <div class="grid grid-cols-3 gap-2">
          <div class="bold-card--static p-3 text-center flex flex-col justify-center" style="border: 2px solid var(--bold-border-color); border-radius: var(--bold-radius-sm);">
            <p class="text-xl font-black font-heading text-primary">{{ (kpi as AdminKpiResponse).users.dau }}</p>
            <p class="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">Actifs DAU</p>
          </div>
          <div class="bold-card--static p-3 text-center flex flex-col justify-center" style="border: 2px solid var(--bold-border-color); border-radius: var(--bold-radius-sm);">
            <p class="text-xl font-black font-heading text-primary">{{ (kpi as AdminKpiResponse).users.mau }}</p>
            <p class="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">Actifs MAU</p>
          </div>
          <div class="bold-card--static p-3 text-center flex flex-col justify-center" style="border: 2px solid var(--bold-border-color); border-radius: var(--bold-radius-sm);">
            <p class="text-xl font-black font-heading text-primary">{{ ((kpi as AdminKpiResponse).credits.conversionRate).toFixed(1) }}%</p>
            <p class="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">Conversion</p>
          </div>
        </div>

        <section class="bold-card--static p-4 space-y-4" style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius); box-shadow: var(--bold-shadow-sm);">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-primary/10" style="border: 2px solid var(--bold-border-color); border-radius: var(--bold-radius-sm);">
              <PhCreditCard :size="20" weight="duotone" class="text-primary" />
            </div>
            <div>
              <h2 class="text-sm font-black font-heading tracking-tight">Finance estimée</h2>
              <p class="text-[11px] text-muted-foreground font-medium mt-0.5">
                Estimation basée sur Google OCR + le modèle scan configuré <code>{{ (kpi as AdminKpiResponse).finance.scanAiModel }}</code>, avec coefficient plancher x4 sur les requêtes IA du pipeline scan.
              </p>
              <p class="text-[11px] text-muted-foreground font-medium mt-1">
                Le modèle assistant configuré est <code>{{ (kpi as AdminKpiResponse).finance.assistantAiModel }}</code>. Son coût reste indicatif pour l'instant et n'entre pas encore dans la marge observée.
              </p>
            </div>
          </div>
          <div class="rounded-[var(--bold-radius)] border border-border/80 bg-muted/20 p-4 space-y-3">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">Réalisé sur la période</p>
                <p class="text-[11px] text-muted-foreground font-medium mt-1">Basé sur les scans effectivement enregistrés.</p>
              </div>
              <p class="text-xl font-black font-heading text-emerald-700 dark:text-emerald-300">
                {{ formatEuroFromCents((kpi as AdminKpiResponse).finance.revenueAmountCents) }}
              </p>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div class="rounded-[var(--bold-radius-sm)] border border-emerald-200/80 bg-background p-3 text-center">
                <p class="text-lg font-black font-heading text-emerald-700 dark:text-emerald-300">{{ formatEuroFromCents((kpi as AdminKpiResponse).finance.revenueAmountCents) }}</p>
                <p class="text-[10px] text-muted-foreground font-bold uppercase mt-1">Gains</p>
              </div>
              <div class="rounded-[var(--bold-radius-sm)] border border-orange-200/80 bg-background p-3 text-center">
                <p class="text-lg font-black font-heading text-orange-700 dark:text-orange-300">{{ formatEuroFromCents((kpi as AdminKpiResponse).finance.theoreticalCostAmountCents) }}</p>
                <p class="text-[10px] text-muted-foreground font-bold uppercase mt-1">Coût observé</p>
              </div>
              <div class="rounded-[var(--bold-radius-sm)] border border-primary/20 bg-background p-3 text-center">
                <p class="text-lg font-black font-heading text-primary">{{ formatEuroFromCents((kpi as AdminKpiResponse).finance.marginAmountCents) }}</p>
                <p class="text-[10px] text-muted-foreground font-bold uppercase mt-1">Marge observée</p>
              </div>
            </div>
          </div>

          <div class="rounded-[var(--bold-radius)] border border-border/80 bg-muted/20 p-4 space-y-3">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-xs font-bold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">Exposition maximale non journalière</p>
                <p class="text-[11px] text-muted-foreground font-medium mt-1">
                  Si tous les crédits d'inscription et crédits achetés de la période étaient consommés. Les crédits journaliers sont exclus.
                </p>
              </div>
              <p class="text-xl font-black font-heading text-amber-700 dark:text-amber-300">
                {{ formatEuroFromCents((kpi as AdminKpiResponse).finance.maximumPotentialCostAmountCents) }}
              </p>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div class="rounded-[var(--bold-radius-sm)] border border-amber-200/80 bg-background p-3 text-center">
                <p class="text-lg font-black font-heading text-foreground">{{ (kpi as AdminKpiResponse).finance.initialFreeCreditsInPeriod }}</p>
                <p class="text-[10px] text-muted-foreground font-bold uppercase mt-1">Free credits</p>
              </div>
              <div class="rounded-[var(--bold-radius-sm)] border border-amber-200/80 bg-background p-3 text-center">
                <p class="text-lg font-black font-heading text-foreground">{{ (kpi as AdminKpiResponse).finance.purchasedCreditsInPeriod }}</p>
                <p class="text-[10px] text-muted-foreground font-bold uppercase mt-1">Crédits achetés</p>
              </div>
              <div class="rounded-[var(--bold-radius-sm)] border border-orange-200/80 bg-background p-3 text-center">
                <p class="text-lg font-black font-heading text-orange-700 dark:text-orange-300">{{ formatEuroFromCents((kpi as AdminKpiResponse).finance.maximumPotentialCostAmountCents) }}</p>
                <p class="text-[10px] text-muted-foreground font-bold uppercase mt-1">Coût max</p>
              </div>
              <div class="rounded-[var(--bold-radius-sm)] border border-primary/20 bg-background p-3 text-center">
                <p class="text-lg font-black font-heading text-primary">{{ formatEuroFromCents((kpi as AdminKpiResponse).finance.maximumPotentialMarginAmountCents) }}</p>
                <p class="text-[10px] text-muted-foreground font-bold uppercase mt-1">Marge max</p>
              </div>
            </div>
          </div>
        </section>

        <section
          v-if="(kpi as AdminKpiResponse).performance.trackedScansInPeriod > 0"
          class="bold-card--static p-4 space-y-4"
          style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius); box-shadow: var(--bold-shadow-sm);"
        >
          <div class="flex items-center gap-2">
            <div class="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-primary/10" style="border: 2px solid var(--bold-border-color); border-radius: var(--bold-radius-sm);">
              <PhScan :size="20" weight="duotone" class="text-primary" />
            </div>
            <div>
              <h2 class="text-sm font-black font-heading tracking-tight">Performance Scan</h2>
              <p class="text-[11px] text-muted-foreground font-medium mt-0.5">
                Basé sur {{ (kpi as AdminKpiResponse).performance.trackedScansInPeriod }} scans tracés sur la période.
              </p>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div class="rounded-[var(--bold-radius-sm)] border border-emerald-200/80 bg-background p-3 text-center">
              <p class="text-lg font-black font-heading text-emerald-700 dark:text-emerald-300">{{ formatDuration((kpi as AdminKpiResponse).performance.minTotalDurationMs) }}</p>
              <p class="text-[10px] text-muted-foreground font-bold uppercase mt-1">Plus court</p>
            </div>
            <div class="rounded-[var(--bold-radius-sm)] border border-primary/20 bg-background p-3 text-center">
              <p class="text-lg font-black font-heading text-primary">{{ formatDuration((kpi as AdminKpiResponse).performance.avgTotalDurationMs) }}</p>
              <p class="text-[10px] text-muted-foreground font-bold uppercase mt-1">Moyen</p>
            </div>
            <div class="rounded-[var(--bold-radius-sm)] border border-orange-200/80 bg-background p-3 text-center">
              <p class="text-lg font-black font-heading text-orange-700 dark:text-orange-300">{{ formatDuration((kpi as AdminKpiResponse).performance.maxTotalDurationMs) }}</p>
              <p class="text-[10px] text-muted-foreground font-bold uppercase mt-1">Plus long</p>
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div class="rounded-[var(--bold-radius-sm)] border border-border/80 bg-muted/20 p-3 text-center">
              <p class="text-sm font-black font-heading text-foreground">{{ formatDuration((kpi as AdminKpiResponse).performance.avgPhase0DurationMs) }}</p>
              <p class="text-[10px] text-muted-foreground font-bold uppercase mt-1">Phase 0</p>
            </div>
            <div class="rounded-[var(--bold-radius-sm)] border border-border/80 bg-muted/20 p-3 text-center">
              <p class="text-sm font-black font-heading text-foreground">{{ formatDuration((kpi as AdminKpiResponse).performance.avgPhase05DurationMs) }}</p>
              <p class="text-[10px] text-muted-foreground font-bold uppercase mt-1">Phase 0.5</p>
            </div>
            <div class="rounded-[var(--bold-radius-sm)] border border-border/80 bg-muted/20 p-3 text-center">
              <p class="text-sm font-black font-heading text-foreground">{{ formatDuration((kpi as AdminKpiResponse).performance.avgClassificationDurationMs) }}</p>
              <p class="text-[10px] text-muted-foreground font-bold uppercase mt-1">Classification</p>
            </div>
            <div class="rounded-[var(--bold-radius-sm)] border border-border/80 bg-muted/20 p-3 text-center">
              <p class="text-sm font-black font-heading text-foreground">{{ formatDuration((kpi as AdminKpiResponse).performance.avgFinalizeDurationMs) }}</p>
              <p class="text-[10px] text-muted-foreground font-bold uppercase mt-1">Finalisation</p>
            </div>
          </div>
        </section>

        <!-- KPI: Utilisateurs -->
        <section class="bold-card--static p-4" style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius); box-shadow: var(--bold-shadow-sm);">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-primary/10" style="border: 2px solid var(--bold-border-color); border-radius: var(--bold-radius-sm);">
              <PhUsers :size="20" weight="duotone" class="text-primary" />
            </div>
            <h2 class="text-sm font-black font-heading tracking-tight">Utilisateurs</h2>
          </div>
          <div class="grid grid-cols-2 gap-2 text-center">
            <div>
              <p class="text-2xl font-black font-heading text-primary">+{{ (kpi as AdminKpiResponse).users.period }}</p>
              <p class="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-0.5">Sur la période</p>
            </div>
            <div>
              <p class="text-2xl font-black font-heading text-foreground">{{ (kpi as AdminKpiResponse).users.total }}</p>
              <p class="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-0.5">Total Inscrits</p>
            </div>
          </div>
        </section>

        <!-- KPI: Scans -->
        <section class="bold-card--static p-4" style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius); box-shadow: var(--bold-shadow-sm);">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-primary/10" style="border: 2px solid var(--bold-border-color); border-radius: var(--bold-radius-sm);">
              <PhScan :size="20" weight="duotone" class="text-primary" />
            </div>
            <h2 class="text-sm font-black font-heading tracking-tight">Détail des Scans</h2>
          </div>
          <div class="grid grid-cols-3 gap-2 text-center mb-4">
            <div>
              <p class="text-xl font-black font-heading text-primary">{{ (kpi as AdminKpiResponse).scans.periodTotal }}</p>
              <p class="text-[10px] text-muted-foreground font-bold uppercase mt-1">Total (Période)</p>
            </div>
            <div>
              <p class="text-xl font-black font-heading text-foreground">{{ (kpi as AdminKpiResponse).scans.freeInPeriod }}</p>
              <p class="text-[10px] text-muted-foreground font-bold uppercase mt-1">Gratuits (Période)</p>
            </div>
            <div>
              <p class="text-xl font-black font-heading text-foreground">{{ (kpi as AdminKpiResponse).scans.paidInPeriod }}</p>
              <p class="text-[10px] text-muted-foreground font-bold uppercase mt-1">Payants (Période)</p>
            </div>
          </div>
          <div class="flex flex-col gap-2 pt-3 border-t border-border">
            <div class="flex items-center justify-between text-xs">
              <span class="font-bold text-muted-foreground">Scans All-time :</span>
              <span class="font-black">{{ (kpi as AdminKpiResponse).scans.allTimeTotal }}</span>
            </div>
            <div class="flex items-center justify-between text-xs">
              <span class="font-bold text-muted-foreground">Plafond gratuit théorique dispo :</span>
              <span class="font-black text-primary">{{ (kpi as AdminKpiResponse).scans.theoreticalFreeCeiling }}</span>
            </div>
          </div>
          <div v-if="Object.keys((kpi as AdminKpiResponse).scans.byStatus || {}).length > 0" class="pt-4 mt-3 border-t border-border">
            <p class="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider">Répartition sur la période</p>
            <div class="space-y-3">
              <div v-for="(count, status) in (kpi as AdminKpiResponse).scans.byStatus" :key="status" class="flex items-center gap-3">
                <div class="w-32 text-xs font-bold truncate">
                  {{ statusLabels[status] ?? status }}
                </div>
                <div class="flex-1 h-3 bg-muted rounded-full overflow-hidden" style="border: 1px solid var(--bold-border-color);">
                  <div
                    class="h-full rounded-full"
                    :class="statusColors[status] || 'bg-primary'"
                    :style="{ width: `${Math.max(2, (count / (kpi as AdminKpiResponse).scans.periodTotal) * 100)}%` }"
                  ></div>
                </div>
                <div class="w-10 text-right text-xs font-black">{{ count }}</div>
              </div>
            </div>
          </div>
        </section>

        <!-- KPI: Top Allergènes -->
        <section v-if="Object.keys((kpi as AdminKpiResponse).scans.topAllergens || {}).length > 0" class="bold-card--static p-4" style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius); box-shadow: var(--bold-shadow-sm);">
          <div class="flex items-center gap-2 mb-4">
            <div class="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-orange-500/10" style="border: 2px solid var(--bold-border-color); border-radius: var(--bold-radius-sm);">
              <AppEmoji :name="APP_EMOJI.allergenDetected" :size="20" />
            </div>
            <h2 class="text-sm font-black font-heading tracking-tight">Top Allergènes Détectés</h2>
          </div>
          <div class="space-y-2">
            <div v-for="(item, index) in Object.entries((kpi as AdminKpiResponse).scans.topAllergens).slice(0, 5)" :key="item[0]" class="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0 hover:bg-muted/30 px-1 rounded transition-colors">
              <span class="font-bold flex items-center gap-2">
                <span class="text-muted-foreground/50 text-xs">#{{ index + 1 }}</span>
                {{ item[0] }}
              </span>
              <span class="font-black text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 rounded-md text-xs">{{ item[1] }} alertes</span>
            </div>
          </div>
        </section>

        <!-- KPI: Ventes & Blocages -->
        <section class="bold-card--static p-4" style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius); box-shadow: var(--bold-shadow-sm);">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-primary/10" style="border: 2px solid var(--bold-border-color); border-radius: var(--bold-radius-sm);">
              <PhCreditCard :size="20" weight="duotone" class="text-primary" />
            </div>
            <h2 class="text-sm font-black font-heading tracking-tight">Acquisition & Paywall</h2>
          </div>
          <div class="grid grid-cols-2 gap-4 text-center">
            <div class="bg-primary/5 p-3 rounded-xl border border-primary/20">
              <p class="text-2xl font-black font-heading text-primary">{{ (kpi as AdminKpiResponse).credits.purchasedInPeriod }}</p>
              <p class="text-xs text-muted-foreground font-bold uppercase mt-1">Crédits Achetés<br><span class="opacity-50">(Période)</span></p>
            </div>
            <div class="bg-red-50 dark:bg-red-900/10 p-3 rounded-xl border border-red-200 dark:border-red-900/30">
              <p class="text-2xl font-black font-heading text-red-600 dark:text-red-400">{{ (kpi as AdminKpiResponse).paywall.hitsInPeriod }}</p>
              <p class="text-xs text-red-600/70 dark:text-red-400/70 font-bold uppercase mt-1">Blocages Paywall<br><span class="opacity-50">(Période)</span></p>
            </div>
          </div>
        </section>

        <!-- Test Sentry & Discord -->
        <section class="bold-card--static p-4" style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius); box-shadow: var(--bold-shadow-sm);">
          <div class="flex items-start gap-3">
            <div
              class="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-primary/10"
              style="border: 2px solid var(--bold-border-color); border-radius: var(--bold-radius-sm);"
            >
              <PhBug :size="20" weight="duotone" class="text-primary" />
            </div>
            <div class="flex-1 min-w-0">
              <h2 class="text-sm font-black font-heading tracking-tight mb-1">Test Sentry & Discord</h2>
              <p class="text-xs text-muted-foreground leading-relaxed mb-3">
                Déclencher une erreur front ou back et vérifier la réception des issues dans Sentry et sur Discord.
              </p>
              <AppButton to="/example-error" variant="secondary" size="md" pill>
                Ouvrir la page de test
              </AppButton>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>
