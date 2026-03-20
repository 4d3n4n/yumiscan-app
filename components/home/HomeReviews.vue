<script setup lang="ts">
import { PhCaretLeft, PhCaretRight, PhStar } from '@phosphor-icons/vue'
import homeSections from '~/assets/css/home-sections.module.css'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const reviews = computed(() => [
  { quote: t('home.reviews.items.fb.quote'), author: t('home.reviews.items.fb.author'), meta: t('home.reviews.items.fb.meta'), initials: 'FB' },
  { quote: t('home.reviews.items.ym.quote'), author: t('home.reviews.items.ym.author'), meta: t('home.reviews.items.ym.meta'), initials: 'YM' },
  { quote: t('home.reviews.items.cd.quote'), author: t('home.reviews.items.cd.author'), meta: t('home.reviews.items.cd.meta'), initials: 'CD' },
  { quote: t('home.reviews.items.ka.quote'), author: t('home.reviews.items.ka.author'), meta: t('home.reviews.items.ka.meta'), initials: 'KA' },
])

const reviewIndex = ref(0)
let reviewInterval: ReturnType<typeof setInterval> | null = null

const nextReview = () => { reviewIndex.value = (reviewIndex.value + 1) % reviews.value.length }
const prevReview = () => { reviewIndex.value = (reviewIndex.value - 1 + reviews.value.length) % reviews.value.length }

const startAutoReview = () => {
  stopAutoReview()
  reviewInterval = setInterval(nextReview, 5000)
}
const stopAutoReview = () => {
  if (reviewInterval) { clearInterval(reviewInterval); reviewInterval = null }
}

onMounted(() => startAutoReview())
onUnmounted(() => stopAutoReview())
</script>

<template>
  <section>
    <h2 :class="homeSections.sectionTitle">{{ $t('home.reviews.title') }}</h2>
    <div
      :class="homeSections.carouselWrapper"
      @mouseenter="stopAutoReview"
      @mouseleave="startAutoReview"
    >
      <button :class="homeSections.carouselBtn" @click="prevReview" :aria-label="$t('home.reviews.btn_prev')">
        <PhCaretLeft :size="18" weight="bold" />
      </button>

      <div :class="homeSections.carouselViewport">
        <div
          :class="homeSections.carouselTrack"
          :style="{ transform: `translateX(-${reviewIndex * 100}%)` }"
        >
          <div v-for="(r, i) in reviews" :key="i" :class="homeSections.carouselSlide">
            <blockquote :class="[homeSections.reviewCard, 'bold-card--static']">
              <div :class="homeSections.reviewStars">
                <PhStar :size="14" weight="fill" v-for="s in 5" :key="'s' + i + '-' + s" />
              </div>
              <p :class="homeSections.reviewQuote">{{ r.quote }}</p>
              <div :class="homeSections.reviewAuthor">
                <div :class="homeSections.reviewAvatar">{{ r.initials }}</div>
                <div>
                  <div :class="homeSections.reviewName">{{ r.author }}</div>
                  <div :class="homeSections.reviewMeta">{{ r.meta }}</div>
                </div>
              </div>
            </blockquote>
          </div>
        </div>
      </div>

      <button :class="homeSections.carouselBtn" @click="nextReview" :aria-label="$t('home.reviews.btn_next')">
        <PhCaretRight :size="18" weight="bold" />
      </button>
    </div>

    <div :class="homeSections.carouselDots">
      <button
        v-for="(_, i) in reviews"
        :key="'dot-' + i"
        :class="[homeSections.carouselDot, reviewIndex === i ? homeSections.carouselDotActive : '']"
        @click="reviewIndex = i"
        :aria-label="$t('home.reviews.btn_dot', { numero: i + 1 })"
      />
    </div>
  </section>
</template>
