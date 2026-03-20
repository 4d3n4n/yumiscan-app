<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { PhShieldCheck, PhSpinnerGap, PhBuildings, PhFloppyDisk, PhTag, PhCheckCircle, PhPercent } from '@phosphor-icons/vue'
import { retryQueryExceptAuth } from '~/utils/query'
import AppAdminSubNav from '~/components/app/AdminSubNav.vue'
import { DEFAULT_COMPANY_CONFIG, type CompanyConfig } from '~/utils/company-config'
import {
  getDisplayPriceCents,
  hasActiveDiscount,
  pricingOfferToFormValues,
  type PricingOfferFormValues,
} from '~/utils/pricing-offers'

definePageMeta({ middleware: ['admin'] })

useHead({
  title: 'Informations entreprise — Back-office YumiScan',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

const { user } = useAuth()
const { isAdmin, loading: adminLoading } = useAdmin()
const { adminAppConfig, adminUpdateAppConfig, adminPricingOffers, adminUpdatePricingOffers } = useEdgeFunctions()
const { setPricingOffers: setPublicPricingOffers } = usePricingOffersPublic({ immediate: false, ssr: false })

const feedback = ref<{ text: string; type: 'success' | 'error' } | null>(null)
const pricingFeedback = ref<{ text: string; type: 'success' | 'error' } | null>(null)
const saving = ref(false)
const savingPricing = ref(false)
const form = reactive<CompanyConfig>({ ...DEFAULT_COMPANY_CONFIG })
const pricingForm = ref<PricingOfferFormValues[]>([])
const maintenanceCache = useState<{ enabled: boolean; fetchedAt: number }>('maintenance-mode-cache', () => ({
  enabled: false,
  fetchedAt: 0,
}))
const maintenanceModeEnabled = computed({
  get: () => form.maintenance_mode_enabled === 'true',
  set: (value: boolean) => {
    form.maintenance_mode_enabled = value ? 'true' : 'false'
  },
})
const scanDebugEnabled = computed({
  get: () => form.scan_debug_enabled === 'true',
  set: (value: boolean) => {
    form.scan_debug_enabled = value ? 'true' : 'false'
  },
})

const { data, isLoading, error, refetch } = useQuery({
  queryKey: ['admin-app-config'],
  queryFn: () => adminAppConfig(),
  enabled: computed(() => !!user.value && isAdmin.value === true && !adminLoading.value),
  retry: retryQueryExceptAuth,
})

const { data: pricingData, isLoading: pricingLoading, error: pricingError, refetch: refetchPricing } = useQuery({
  queryKey: ['admin-pricing-offers'],
  queryFn: () => adminPricingOffers(),
  enabled: computed(() => !!user.value && isAdmin.value === true && !adminLoading.value),
  retry: retryQueryExceptAuth,
})

watch(data, (value) => {
  if (!value) return
  Object.assign(form, value)
}, { immediate: true })

watch(pricingData, (value) => {
  if (!value) return
  pricingForm.value = value.map(pricingOfferToFormValues)
}, { immediate: true })

const errorMessage = computed(() => error.value instanceof Error ? error.value.message : '')
const pricingErrorMessage = computed(() => pricingError.value instanceof Error ? pricingError.value.message : '')

async function handleSave() {
  saving.value = true
  feedback.value = null
  try {
    const next = await adminUpdateAppConfig(form)
    Object.assign(form, next)
    maintenanceCache.value = {
      enabled: next.maintenance_mode_enabled === 'true',
      fetchedAt: Date.now(),
    }
    feedback.value = { text: 'Informations entreprise enregistrées.', type: 'success' }
    await refetch()
  } catch (saveError) {
    feedback.value = { text: saveError instanceof Error ? saveError.message : 'Erreur serveur', type: 'error' }
  } finally {
    saving.value = false
  }
}

const sortedPricingOffers = computed(() =>
  [...pricingForm.value].sort((left, right) => {
    const leftCredits = Number.parseInt(left.credits, 10) || 0
    const rightCredits = Number.parseInt(right.credits, 10) || 0
    return leftCredits - rightCredits
  }),
)

function pricePreviewLabel(offer: PricingOfferFormValues): string {
  const activeDiscount = hasActiveDiscount({
    full_price_cents: Number.parseInt((offer.full_price || '').replace(/[^\d]/g, ''), 10) || 0,
    discount_price_cents: (() => {
      const normalized = offer.discount_price.trim().replace(',', '.')
      if (!normalized || Number.parseFloat(normalized) <= 0) return null
      return Math.round(Number.parseFloat(normalized) * 100)
    })(),
    stripe_price_id_discount: offer.stripe_price_id_discount,
  })

  if (!activeDiscount) {
    return 'Prix simple'
  }

  return 'Prix barre + promo'
}

function displayPrice(offer: PricingOfferFormValues) {
  const fullCents = Math.round(Number.parseFloat((offer.full_price || '0').replace(',', '.')) * 100)
  const discountCentsRaw = offer.discount_price.trim()
  const discountCents = discountCentsRaw ? Math.round(Number.parseFloat(discountCentsRaw.replace(',', '.')) * 100) : null
  return {
    full: Number.isFinite(fullCents) ? (fullCents / 100).toFixed(2).replace('.', ',') : '0,00',
    current: (getDisplayPriceCents({
      full_price_cents: Number.isFinite(fullCents) ? fullCents : 0,
      discount_price_cents: discountCents != null && Number.isFinite(discountCents) && discountCents > 0 ? discountCents : null,
      stripe_price_id_discount: offer.stripe_price_id_discount,
    }) / 100).toFixed(2).replace('.', ','),
  }
}

async function handleSavePricing() {
  savingPricing.value = true
  pricingFeedback.value = null
  try {
    const next = await adminUpdatePricingOffers(pricingForm.value.map(offer => ({
      code: offer.code,
      title: offer.title,
      credits: offer.credits,
      full_price: offer.full_price,
      discount_price: offer.discount_price,
      stripe_price_id_full: offer.stripe_price_id_full,
      stripe_price_id_discount: offer.stripe_price_id_discount,
      active: offer.active,
    })))
    pricingForm.value = next.map(pricingOfferToFormValues)
    setPublicPricingOffers(next)
    pricingFeedback.value = { text: 'Offres et pricing enregistres.', type: 'success' }
    await refetchPricing()
  } catch (saveError) {
    pricingFeedback.value = { text: saveError instanceof Error ? saveError.message : 'Erreur serveur', type: 'error' }
  } finally {
    savingPricing.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-background pt-4 pb-24 md:pt-20 md:pb-0">
    <main id="main-content" class="flex-1 container mx-auto px-4 py-8 max-w-lg">
      <div class="flex items-center gap-2 mb-6">
        <PhShieldCheck :size="24" weight="duotone" class="text-primary" />
        <h1 class="text-xl font-black font-heading tracking-tight uppercase">Back-office</h1>
      </div>

      <AppAdminSubNav current="settings" />

      <div v-if="isLoading" class="flex items-center justify-center py-12" aria-busy="true">
        <PhSpinnerGap class="h-8 w-8 animate-spin text-primary" />
      </div>

      <div
        v-else-if="error"
        class="bold-card--static p-4 border-red-200 bg-red-50 dark:bg-red-950/30"
        style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius);"
      >
        <p class="text-sm font-bold text-red-700 dark:text-red-300">{{ errorMessage }}</p>
      </div>

      <div v-else class="space-y-4">
        <div
          v-if="feedback"
          class="bold-card--static p-4"
          :class="feedback.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'"
          style="border: 2px solid var(--bold-border-color); border-radius: var(--bold-radius);"
        >
          <p class="text-sm font-bold">{{ feedback.text }}</p>
        </div>

        <section class="bold-card--static p-4 space-y-4" style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius); box-shadow: var(--bold-shadow-sm);">
          <div class="flex items-center gap-2">
            <div class="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-primary/10" style="border: 2px solid var(--bold-border-color); border-radius: var(--bold-radius-sm);">
              <PhBuildings :size="20" weight="duotone" class="text-primary" />
            </div>
            <div>
              <h2 class="text-sm font-black font-heading tracking-tight">Informations entreprise</h2>
              <p class="text-xs text-muted-foreground font-medium">Les champs vides sont masqués côté public.</p>
            </div>
          </div>

          <label class="block space-y-1">
            <span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nom public</span>
            <input v-model="form.company_name" class="bold-input text-sm" type="text" placeholder="YumiScan" />
          </label>

          <label class="block space-y-1">
            <span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Raison sociale</span>
            <input v-model="form.legal_entity_name" class="bold-input text-sm" type="text" placeholder="Nom de l'entreprise" />
          </label>

          <label class="block space-y-1">
            <span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Adresse</span>
            <textarea v-model="form.company_address" class="bold-input text-sm min-h-[96px]" placeholder="Adresse postale complète" />
          </label>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label class="block space-y-1">
              <span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pays</span>
              <input v-model="form.company_country" class="bold-input text-sm" type="text" placeholder="France" />
            </label>

            <label class="block space-y-1">
              <span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">SIRET</span>
              <input v-model="form.company_siret" class="bold-input text-sm" type="text" placeholder="Numéro SIRET" />
            </label>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label class="block space-y-1">
              <span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Directeur de publication</span>
              <input v-model="form.publication_director" class="bold-input text-sm" type="text" placeholder="Nom et prénom" />
            </label>

            <label class="block space-y-1">
              <span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">TVA</span>
              <input v-model="form.vat_number" class="bold-input text-sm" type="text" placeholder="Numéro de TVA intracommunautaire" />
            </label>
          </div>

          <label class="block space-y-1">
            <span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Chemin page contact</span>
            <input v-model="form.contact_page_path" class="bold-input text-sm" type="text" placeholder="/contact" />
          </label>

          <div class="rounded-[var(--bold-radius-sm)] bg-amber-50/80 p-4 space-y-3" style="border: 2px solid var(--bold-border-color); box-shadow: var(--bold-shadow-xs);">
            <div class="space-y-1">
              <h3 class="text-sm font-black font-heading tracking-tight text-foreground">Mode maintenance</h3>
              <p class="text-xs text-muted-foreground font-medium">
                Quand ce mode est actif, seuls les admins connectes peuvent naviguer dans l'app. Le public voit la page maintenance.
              </p>
            </div>

            <label class="flex items-start gap-3 text-sm font-bold text-foreground">
              <input
                v-model="maintenanceModeEnabled"
                type="checkbox"
                class="mt-0.5 h-4 w-4 rounded border-border"
              />
              <span class="space-y-1">
                <span class="block">Activer la maintenance globale</span>
                <span class="block text-xs font-medium text-muted-foreground">
                  Les pages <code>/login</code>, <code>/forgot-password</code> et <code>/auth/confirm</code> restent accessibles pour les tests et callbacks auth.
                </span>
              </span>
            </label>

            <p class="text-xs font-bold uppercase tracking-[0.08em]" :class="maintenanceModeEnabled ? 'text-amber-700' : 'text-emerald-700'">
              {{ maintenanceModeEnabled ? 'Maintenance active' : 'Maintenance inactive' }}
            </p>
          </div>

          <div class="pt-2 border-t border-border/70 space-y-4">
            <div>
              <h3 class="text-sm font-black font-heading tracking-tight">Configuration IA et coûts théoriques</h3>
              <p class="text-xs text-muted-foreground font-medium mt-1">
                Le back-office pilote ici les modèles IA par défaut et les coûts estimés utilisés pour le suivi financier.
              </p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label class="block space-y-1">
                <span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Modèle scan IA</span>
                <input
                  v-model="form.scan_ai_model"
                  class="bold-input text-sm"
                  type="text"
                  placeholder="gemini-2.5-flash"
                />
              </label>

              <label class="block space-y-1">
                <span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Modèle assistant IA</span>
                <input
                  v-model="form.assistant_ai_model"
                  class="bold-input text-sm"
                  type="text"
                  placeholder="gemini-2.5-flash"
                />
              </label>

              <label class="block space-y-1">
                <span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Taille batch scan</span>
                <input
                  v-model="form.scan_batch_size"
                  class="bold-input text-sm"
                  inputmode="numeric"
                  type="text"
                  placeholder="8"
                />
                <span class="block text-[11px] font-medium text-muted-foreground">
                  Nombre d'ingrédients envoyés par lot en phases 1.5 / 2. Borné côté back entre 1 et 16.
                </span>
              </label>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label class="block space-y-1">
                <span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">OCR Google (EUR / requête)</span>
                <input
                  v-model="form.google_ocr_cost_eur_per_request"
                  class="bold-input text-sm"
                  inputmode="decimal"
                  type="text"
                  placeholder="0.0015"
                />
              </label>

              <label class="block space-y-1">
                <span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">IA scan (EUR / requête)</span>
                <input
                  v-model="form.scan_ai_cost_eur_per_request"
                  class="bold-input text-sm"
                  inputmode="decimal"
                  type="text"
                  placeholder="0.0002"
                />
              </label>

              <label class="block space-y-1">
                <span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">IA assistant (EUR / requête)</span>
                <input
                  v-model="form.assistant_ai_cost_eur_per_request"
                  class="bold-input text-sm"
                  inputmode="decimal"
                  type="text"
                  placeholder="0.0002"
                />
              </label>
            </div>

            <p class="text-[11px] text-muted-foreground font-medium">
              La marge observée du dashboard continue de s'appuyer sur le pipeline scan (OCR + IA scan), car l'assistant n'a pas encore de compteur d'usage financier dédié.
            </p>
            <p class="text-[11px] text-muted-foreground font-medium">
              Batch plus petit : moins de contexte par appel et souvent moins d'hallucinations. Batch plus grand : moins de requêtes mais plus de charge par lot.
            </p>

            <label class="flex items-start gap-3 text-sm font-bold text-foreground">
              <input
                v-model="scanDebugEnabled"
                type="checkbox"
                class="mt-0.5 h-4 w-4 rounded border-border"
              />
              <span class="space-y-1">
                <span class="block">Persister le debug des scans</span>
                <span class="block text-xs font-medium text-muted-foreground">
                  Quand ce mode est actif, les nouveaux scans enregistrent un <code>debug_json</code> complet côté base et admin. Le front utilisateur ne le reçoit jamais.
                </span>
              </span>
            </label>
          </div>

          <button
            type="button"
            class="bold-btn bold-btn--primary w-full sm:w-auto"
            :disabled="saving"
            @click="handleSave"
          >
            <PhSpinnerGap v-if="saving" :size="18" class="animate-spin" />
            <PhFloppyDisk v-else :size="18" />
            {{ saving ? 'Enregistrement…' : 'Enregistrer les informations' }}
          </button>
        </section>

        <div
          v-if="pricingFeedback"
          class="bold-card--static p-4"
          :class="pricingFeedback.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'"
          style="border: 2px solid var(--bold-border-color); border-radius: var(--bold-radius);"
        >
          <p class="text-sm font-bold">{{ pricingFeedback.text }}</p>
        </div>

        <section class="bold-card--static p-4 space-y-4" style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius); box-shadow: var(--bold-shadow-sm);">
          <div class="flex items-center gap-2">
            <div class="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-primary/10" style="border: 2px solid var(--bold-border-color); border-radius: var(--bold-radius-sm);">
              <PhTag :size="20" weight="duotone" class="text-primary" />
            </div>
            <div>
              <h2 class="text-sm font-black font-heading tracking-tight">Offres et pricing</h2>
              <p class="text-xs text-muted-foreground font-medium">Le checkout utilise le price ID plein ou promo selon l'etat reel de l'offre.</p>
            </div>
          </div>

          <div
            v-if="pricingLoading"
            class="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <PhSpinnerGap :size="16" class="animate-spin" />
            Chargement des offres...
          </div>

          <div
            v-else-if="pricingError"
            class="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700"
          >
            {{ pricingErrorMessage }}
          </div>

          <div v-else class="space-y-4">
            <article
              v-for="offer in sortedPricingOffers"
              :key="offer.code"
              class="bold-card--static p-4 space-y-4"
              style="border: 2px solid var(--bold-border-color); border-radius: var(--bold-radius-sm); box-shadow: var(--bold-shadow-xs);"
            >
              <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 class="text-sm font-black font-heading tracking-tight">{{ offer.title || offer.code }}</h3>
                  <p class="text-xs text-muted-foreground font-medium">
                    Code: <span class="font-bold text-foreground">{{ offer.code }}</span>
                  </p>
                </div>
                <div class="flex flex-wrap gap-2">
                  <span
                    class="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em]"
                    :class="offer.active ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-border bg-muted text-muted-foreground'"
                  >
                    <PhCheckCircle v-if="offer.active" :size="12" weight="fill" />
                    {{ offer.active ? 'Active' : 'Inactive' }}
                  </span>
                  <span
                    class="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em]"
                    :class="offer.discount_price.trim() ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-border bg-muted text-muted-foreground'"
                  >
                    <PhPercent :size="12" weight="bold" />
                    {{ offer.discount_price.trim() ? 'Promo configuree' : 'Aucune promotion active' }}
                  </span>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label class="block space-y-1">
                  <span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Titre</span>
                  <input v-model="offer.title" class="bold-input text-sm" type="text" />
                </label>
                <label class="block space-y-1">
                  <span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Credits</span>
                  <input v-model="offer.credits" class="bold-input text-sm" inputmode="numeric" type="text" />
                </label>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label class="block space-y-1">
                  <span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Prix plein (EUR)</span>
                  <input v-model="offer.full_price" class="bold-input text-sm" inputmode="decimal" type="text" placeholder="7,49" />
                </label>
                <label class="block space-y-1">
                  <span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Prix promo (EUR)</span>
                  <input v-model="offer.discount_price" class="bold-input text-sm" inputmode="decimal" type="text" placeholder="Laisser vide si aucune reduction" />
                </label>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label class="block space-y-1">
                  <span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Stripe Price ID plein</span>
                  <input v-model="offer.stripe_price_id_full" class="bold-input text-sm" type="text" placeholder="price_..." />
                </label>
                <label class="block space-y-1">
                  <span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Stripe Price ID promo</span>
                  <input v-model="offer.stripe_price_id_discount" class="bold-input text-sm" type="text" placeholder="Laisser vide si aucune reduction" />
                </label>
              </div>

              <label class="flex items-center gap-2 text-sm font-bold text-foreground">
                <input v-model="offer.active" type="checkbox" class="h-4 w-4 rounded border-border" />
                Offre active
              </label>

              <div class="rounded-[var(--bold-radius-sm)] border border-border/70 bg-muted/15 p-3 text-sm space-y-1">
                <p class="font-bold text-foreground">Apercu front</p>
                <p class="text-muted-foreground font-medium">{{ pricePreviewLabel(offer) }}</p>
                <p class="text-foreground font-black">
                  <span v-if="offer.discount_price.trim()" class="line-through text-muted-foreground mr-2">{{ displayPrice(offer).full }} EUR</span>
                  <span>{{ displayPrice(offer).current }} EUR</span>
                </p>
              </div>
            </article>

            <button
              type="button"
              class="bold-btn bold-btn--primary w-full sm:w-auto"
              :disabled="savingPricing"
              @click="handleSavePricing"
            >
              <PhSpinnerGap v-if="savingPricing" :size="18" class="animate-spin" />
              <PhFloppyDisk v-else :size="18" />
              {{ savingPricing ? 'Enregistrement…' : 'Enregistrer les offres' }}
            </button>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>
