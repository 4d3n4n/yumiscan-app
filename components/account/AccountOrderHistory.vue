<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { PhReceipt, PhSpinnerGap, PhDownloadSimple, PhCalendar } from '@phosphor-icons/vue'
import AppEmoji from '~/components/ui/AppEmoji.vue'
import { APP_EMOJI } from '~/utils/emojis'
import { useI18n } from 'vue-i18n'
import { retryQueryExceptAuth } from '~/utils/query'
const { t } = useI18n()

const supabase = useSupabase()
const { user, loading: authLoading } = useAuth()

interface Order {
  id: string
  created_at: string
  plan: string
  credits_added: number
  amount_cents: number | null
  receipt_url: string | null
}

const { data: ordersData, isLoading } = useQuery({
  queryKey: ['stripe-order-history'],
  queryFn: async (): Promise<{ orders: Order[] }> => {
    const { data, error } = await supabase.functions.invoke<{ orders: Order[] }>('stripe-order-history', {
      method: 'POST',
    })
    if (error) throw new Error(t('common.errors.server_error'))
    return data ?? { orders: [] }
  },
  enabled: computed(() => !!user.value && !authLoading.value),
  retry: retryQueryExceptAuth,
})

const orders = computed(() => ordersData.value?.orders ?? [])

const MAX_VISIBLE = 3
const showAll = ref(false)
const visibleOrders = computed(() =>
  showAll.value ? orders.value : orders.value.slice(0, MAX_VISIBLE),
)
const hasMore = computed(() => orders.value.length > MAX_VISIBLE)

const { locale } = useI18n()

const formatDate = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleDateString(locale.value, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const planLabel = (order: Order) => {
  if (order.credits_added > 0) {
    return `${order.credits_added} ${locale.value === 'fr' ? 'credits' : 'credits'}`
  }
  return order.plan
}

const formatAmount = (cents: number | null) => {
  if (cents == null) return '—'
  return new Intl.NumberFormat(locale.value, { style: 'currency', currency: 'EUR' }).format(cents / 100)
}
</script>

<template>
  <div class="space-y-3">
    <div class="bold-card--static p-5 space-y-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <PhReceipt :size="16" weight="duotone" class="text-primary" />
          <span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">{{ t('account.order_history.title') }}</span>
        </div>
        <span v-if="orders.length > 0" class="text-xs font-bold text-muted-foreground/70">{{ orders.length }}</span>
      </div>

      <p v-if="isLoading" class="flex items-center gap-2 text-sm text-muted-foreground">
        <PhSpinnerGap :size="16" class="animate-spin" />
        {{ t('account.order_history.lbl_loading') }}
      </p>

      <template v-else-if="orders.length === 0">
        <div class="flex flex-col items-center gap-2 py-2">
          <AppEmoji :name="APP_EMOJI.emptyScan" :size="48" class="opacity-70" />
          <p class="text-sm text-muted-foreground">{{ t('account.order_history.empty_title') }}</p>
          <p class="text-xs text-muted-foreground">{{ t('account.order_history.empty_desc') }}</p>
        </div>
      </template>

      <template v-else>
        <ul class="space-y-3">
          <li
            v-for="order in visibleOrders"
            :key="order.id"
            class="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-border last:border-0 last:pb-0"
          >
            <div class="flex items-center gap-3 min-w-0">
              <div
                class="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center"
                style="background: hsl(var(--primary) / 0.1);"
              >
                <PhCalendar :size="16" weight="duotone" class="text-primary" />
              </div>
              <div class="min-w-0">
                <p class="text-sm font-bold text-foreground">{{ planLabel(order) }}</p>
                <p class="text-xs text-muted-foreground">{{ formatDate(order.created_at) }}</p>
                <p class="text-xs text-muted-foreground">{{ formatAmount(order.amount_cents) }}</p>
              </div>
            </div>
            <a
              v-if="order.receipt_url"
              :href="order.receipt_url"
              target="_blank"
              rel="noopener noreferrer"
              class="bold-btn bold-btn--outline bold-btn--sm bold-btn--pill flex items-center gap-1.5 shrink-0"
            >
              <PhDownloadSimple :size="14" weight="bold" />
              {{ t('account.order_history.btn_invoice') }}
            </a>
            <span v-else class="text-xs text-muted-foreground shrink-0">{{ t('account.order_history.no_invoice') }}</span>
          </li>
        </ul>

        <button
          v-if="hasMore"
          type="button"
          class="w-full text-center text-xs font-bold text-primary py-2 hover:underline transition-colors"
          @click="showAll = !showAll"
        >
          {{ showAll ? t('account.order_history.btn_collapse') : t('account.order_history.btn_view_all', { count: orders.length }) }}
        </button>
      </template>
    </div>
  </div>
</template>
