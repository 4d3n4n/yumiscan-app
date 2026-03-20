<script setup lang="ts">
import { PhCreditCard, PhLightning, PhWarning, PhScan } from '@phosphor-icons/vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const localePath = useLocalePath()

const props = defineProps<{
  freeScansCount: number
  freeScansUsed: number
  paidScansUsed: number
  paidCreditsPurchased: number
  dailyCreditAvailable: boolean
}>()

const paidCreditsRemaining = computed(() => Math.max(0, props.paidCreditsPurchased - props.paidScansUsed))
const freeLeft = computed(() => Math.max(0, props.freeScansCount - props.freeScansUsed))
const paidTotal = computed(() => props.paidCreditsPurchased)

// Total credits remaining (free + daily + paid)
const totalRemaining = computed(() => {
  return freeLeft.value + (props.dailyCreditAvailable ? 1 : 0) + paidCreditsRemaining.value
})
const isLowCredits = computed(() => totalRemaining.value <= 5 && totalRemaining.value >= 0)

const totalBar = computed(() => props.freeScansCount + paidTotal.value)

const freeSegmentPct = computed(() =>
  totalBar.value > 0 ? (props.freeScansUsed / totalBar.value) * 100 : 0
)
const paidUsedSegmentPct = computed(() =>
  totalBar.value > 0 ? (props.paidScansUsed / totalBar.value) * 100 : 0
)
</script>

<template>
  <div class="space-y-3">
    <div class="bold-card--static p-5 space-y-4">

      <div class="flex items-center gap-2">
        <PhCreditCard :size="16" weight="duotone" class="text-primary" />
        <span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">{{ t('account.credits.title') }}</span>
      </div>

      <!-- Segmented progress bar -->
      <div class="space-y-2">
        <div
          class="h-3.5 rounded-full overflow-hidden flex"
          style="background: hsl(var(--muted)); border: 1.5px solid var(--bold-border-color);"
        >
          <div
            v-if="freeSegmentPct > 0"
            class="h-full transition-all duration-500"
            :class="freeSegmentPct >= 100 ? 'rounded-full' : 'rounded-l-full'"
            :style="`width: ${freeSegmentPct}%; background: hsl(var(--success));`"
          />
          <div
            v-if="paidUsedSegmentPct > 0"
            class="h-full transition-all duration-500"
            :class="{ 'rounded-l-full': freeSegmentPct <= 0 }"
            :style="`width: ${paidUsedSegmentPct}%; background: hsl(var(--primary));`"
          />
        </div>

        <!-- Labels under bar -->
        <div class="flex items-center justify-between text-[11px] font-semibold">
          <div class="flex items-center gap-1.5">
            <span class="inline-block w-2 h-2 rounded-full" style="background: hsl(var(--success));" />
            <span class="text-muted-foreground">
              {{ freeScansUsed }}/{{ freeScansCount + (dailyCreditAvailable ? 1 : 0) }} {{ t('account.credits.lbl_free') }}
            </span>
          </div>
          <div v-if="paidTotal > 0" class="flex items-center gap-1.5">
            <span class="inline-block w-2 h-2 rounded-full" style="background: hsl(var(--primary));" />
            <span class="text-muted-foreground">
              {{ paidScansUsed }}/{{ paidTotal }}
            </span>
          </div>
        </div>
      </div>

      <!-- Unified Status Box: Adapts to remaining credits -->
      <div
        class="relative overflow-hidden transition-colors duration-300"
        :style="isLowCredits
          ? 'background: linear-gradient(135deg, hsl(38 95% 50% / 0.08) 0%, hsl(38 95% 50% / 0.14) 100%); border: 1.5px solid hsl(38 95% 55% / 0.45); border-radius: var(--bold-radius-sm);'
          : 'background: hsl(var(--card)); border: 1.5px solid var(--bold-border-color); border-radius: var(--bold-radius-sm);'"
      >
        <!-- Stripe background for low credits -->
        <div
          v-if="isLowCredits"
          class="absolute inset-0 pointer-events-none opacity-[0.04]"
          style="background: repeating-linear-gradient(135deg, hsl(38 95% 50%), hsl(38 95% 50%) 6px, transparent 6px, transparent 12px);"
        />

        <div class="relative px-3 pt-3 pb-2.5 flex items-start gap-2.5">
          <PhWarning v-if="isLowCredits" :size="16" weight="fill" class="shrink-0 mt-0.5" style="color: hsl(38 95% 42%);" />
          <PhScan v-else :size="16" weight="fill" class="shrink-0 mt-0.5" style="color: hsl(var(--primary));" />

          <div class="flex-1 min-w-0">
            <p
              class="text-xs font-black flex flex-wrap items-baseline gap-1.5"
              :style="isLowCredits ? 'color: hsl(38 85% 30%);' : 'color: hsl(var(--foreground));'"
            >
              <template v-if="totalRemaining > 0">
                <span v-if="isLowCredits">{{ t('account.credits.lbl_low_credits') }}</span>
                <strong class="text-sm">{{ totalRemaining }}</strong>
                <span>{{ t('account.credits.lbl_scan_remaining_suffix') }}</span>
              </template>
              <template v-else>
                {{ t('account.credits.lbl_no_scans') }}
              </template>
            </p>
            <p
              class="text-[11px] font-medium mt-0.5 leading-relaxed"
              :style="isLowCredits ? 'color: hsl(38 70% 40%);' : 'color: hsl(var(--muted-foreground));'"
            >
              <template v-if="totalRemaining === 0">
                {{ t('account.credits.desc_empty') }}
              </template>
              <template v-else-if="isLowCredits">
                {{ t('account.credits.desc_low') }}
              </template>
              <template v-else-if="dailyCreditAvailable">
                {{ t('account.credits.desc_daily') }}
              </template>
              <template v-else>
                {{ t('account.credits.desc_ok') }}
              </template>
            </p>
          </div>
        </div>

        <div class="relative px-3 pb-3">
          <NuxtLink
            v-if="isLowCredits"
            :to="localePath('/pricing')"
            class="w-full flex items-center justify-center gap-1.5 font-black text-xs py-2 rounded-lg transition-all hover:translate-y-[1px] active:translate-y-[2px]"
            style="
              background: linear-gradient(135deg, hsl(38 95% 48%), hsl(38 98% 40%));
              color: white;
              border: 1.5px solid hsl(38 95% 35%);
              border-radius: var(--bold-radius-sm);
              box-shadow: 0 1px 0 hsl(38 95% 28%), 0 3px 6px hsl(38 90% 45% / 0.35);
              text-shadow: 0 1px 2px hsl(38 80% 25% / 0.4);
            "
          >
            <PhLightning :size="13" weight="fill" />
            {{ t('account.credits.btn_recharge') }}
          </NuxtLink>
          <NuxtLink
            v-else
            :to="localePath('/pricing')"
            class="bold-btn bold-btn--secondary w-full py-2 flex items-center justify-center gap-1.5 font-bold text-xs"
          >
            <PhLightning :size="13" weight="bold" />
            {{ t('account.credits.btn_buy') }}
          </NuxtLink>
        </div>
      </div>

    </div>
  </div>
</template>
