<script setup lang="ts">
import homeSections from '~/assets/css/home-sections.module.css'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const faqItems = computed(() => [
  { q: t('home.faq.items.q1'), a: t('home.faq.items.a1') },
  { q: t('home.faq.items.q2'), a: t('home.faq.items.a2') },
  { q: t('home.faq.items.q3'), a: t('home.faq.items.a3') },
  { q: t('home.faq.items.q4'), a: t('home.faq.items.a4') },
  { q: t('home.faq.items.q5'), a: t('home.faq.items.a5') },
  { q: t('home.faq.items.q6'), a: t('home.faq.items.a6') },
  { q: t('home.faq.items.q7'), a: t('home.faq.items.a7') },
  { q: t('home.faq.items.q8'), a: t('home.faq.items.a8') },
  { q: t('home.faq.items.q9'), a: t('home.faq.items.a9') },
  { q: t('home.faq.items.q10'), a: t('home.faq.items.a10') },
  { q: t('home.faq.items.q11'), a: t('home.faq.items.a11') },
])
</script>

<template>
  <section>
    <h2 :class="homeSections.sectionTitle">{{ t('home.faq.title') }}</h2>
    <div :class="homeSections.faqList">
      <div v-for="(item, i) in faqItems" :key="i" :class="homeSections.faqItem">
        <details>
          <summary :class="homeSections.faqSummary">
            <span>{{ item.q }}</span>
            <span :class="homeSections.faqIcon">+</span>
          </summary>
          <div :class="homeSections.faqContent">
            <p>{{ item.a }}</p>
          </div>
        </details>
      </div>
    </div>
  </section>
</template>
