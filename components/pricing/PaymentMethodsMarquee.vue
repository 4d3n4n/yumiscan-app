<script setup lang="ts">
const props = withDefaults(defineProps<{
  compact?: boolean
  interactive?: boolean
  rows?: 1 | 2
}>(), {
  compact: false,
  interactive: true,
  rows: 2,
})

const isPaused = ref(false)

const paymentLogos = [
  { src: '/images/payment/Symboles%20Visa.webp', alt: 'Visa' },
  { src: '/images/payment/Mastercard%20Icon.webp', alt: 'Mastercard' },
  { src: '/images/payment/american-express.webp', alt: 'American Express' },
  { src: '/images/payment/Diners%20Club%20Icon.webp', alt: 'Diners Club' },
  { src: '/images/payment/Jcb%20Icon.webp', alt: 'JCB' },
  { src: '/images/payment/Unionpay%20Icon.webp', alt: 'UnionPay' },
  { src: '/images/payment/apple-pay.webp', alt: 'Apple Pay' },
  { src: '/images/payment/google-pay.webp', alt: 'Google Pay' },
  { src: '/images/payment/klarna.webp', alt: 'Klarna' },
  { src: '/images/payment/revolut-pay.webp', alt: 'Revolut Pay' },
  { src: '/images/payment/stripe.webp', alt: 'Stripe' },
] as const

const paymentRows = computed(() => {
  if (props.rows === 1) {
    return [paymentLogos]
  }

  const midpoint = Math.ceil(paymentLogos.length / 2)
  return [
    paymentLogos.slice(0, midpoint),
    paymentLogos.slice(midpoint),
  ]
})

function pauseMarquee() {
  isPaused.value = true
}

function resumeMarquee() {
  isPaused.value = false
}
</script>

<template>
  <div class="paymentMarqueeSection">
    <div
      v-for="(row, rowIndex) in paymentRows"
      :key="`payment-row-${rowIndex}`"
      :class="[
        'paymentMarqueeViewport',
        compact ? 'paymentMarqueeViewport--compact' : '',
        !interactive ? 'paymentMarqueeViewport--static' : '',
      ]"
      @pointerenter="interactive ? pauseMarquee() : undefined"
      @pointerleave="interactive ? resumeMarquee() : undefined"
      @pointerdown="interactive ? pauseMarquee() : undefined"
      @pointerup="interactive ? resumeMarquee() : undefined"
      @pointercancel="interactive ? resumeMarquee() : undefined"
    >
      <div
        :class="[
          'paymentMarqueeTrack',
          rowIndex === 0 ? 'marquee-track-left' : 'marquee-track-right',
          compact ? 'paymentMarqueeTrack--compact' : '',
          isPaused ? 'paymentMarqueeTrack--paused' : '',
        ]"
      >
        <div
          v-for="(logo, logoIndex) in [...row, ...row]"
          :key="`${logo.src}-${logoIndex}`"
          :class="[
            'paymentLogoCard',
            'bold-card--static',
            compact ? 'paymentLogoCard--compact' : '',
          ]"
        >
          <img
            :src="logo.src"
            :alt="logo.alt"
            loading="lazy"
            class="paymentLogoImage"
          >
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.paymentMarqueeSection {
  display: grid;
  gap: 0.5rem;
}

.paymentMarqueeViewport {
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  overscroll-behavior-x: contain;
  cursor: grab;
  -webkit-mask-image: linear-gradient(to right, transparent, black 6%, black 94%, transparent);
  mask-image: linear-gradient(to right, transparent, black 6%, black 94%, transparent);
  padding: 0.2rem 0;
}

.paymentMarqueeViewport--compact {
  -webkit-mask-image: linear-gradient(to right, transparent, black 4%, black 96%, transparent);
  mask-image: linear-gradient(to right, transparent, black 4%, black 96%, transparent);
}

.paymentMarqueeViewport--static {
  overflow: hidden;
  cursor: default;
}

.paymentMarqueeViewport::-webkit-scrollbar {
  display: none;
}

.paymentMarqueeViewport:active {
  cursor: grabbing;
}

.paymentMarqueeViewport--static:active {
  cursor: default;
}

.paymentMarqueeTrack {
  display: flex;
  gap: 0.75rem;
  width: max-content;
  padding: 0.15rem 0;
}

.paymentMarqueeTrack--compact {
  gap: 0.5rem;
}

.paymentMarqueeTrack--paused {
  animation-play-state: paused;
  -webkit-animation-play-state: paused;
}

.paymentLogoCard {
  width: 5rem;
  height: 5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem;
  flex-shrink: 0;
  scroll-snap-align: start;
}

.paymentLogoCard--compact {
  width: 3.75rem;
  height: 3.75rem;
  padding: 0.55rem;
}

.paymentLogoImage {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  object-fit: contain;
}

@media (prefers-reduced-motion: reduce) {
  .paymentMarqueeTrack {
    animation: none !important;
    -webkit-animation: none !important;
  }
}
</style>
