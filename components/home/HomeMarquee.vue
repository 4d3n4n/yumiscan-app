<script setup lang="ts">
import homeSections from '~/assets/css/home-sections.module.css'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const row1 = computed(() => [
  { jp: '小麦粉', fr: t('home.marquee.words.farine') },
  { jp: '大豆', fr: t('home.marquee.words.soja') },
  { jp: '卵', fr: t('home.marquee.words.oeuf') },
  { jp: '牛乳', fr: t('home.marquee.words.lait') },
  { jp: '砂糖', fr: t('home.marquee.words.sucre') },
  { jp: 'えび', fr: t('home.marquee.words.crevette') },
  { jp: 'かに', fr: t('home.marquee.words.crabe') },
  { jp: '豚肉', fr: t('home.marquee.words.porc') },
  { jp: '鶏肉', fr: t('home.marquee.words.poulet') },
  { jp: 'ゼラチン', fr: t('home.marquee.words.gelatine') },
])

const row2 = computed(() => [
  { jp: '落花生', fr: t('home.marquee.words.cacahuete') },
  { jp: 'そば', fr: t('home.marquee.words.sarrasin') },
  { jp: 'くるみ', fr: t('home.marquee.words.noix') },
  { jp: 'アーモンド', fr: t('home.marquee.words.amande') },
  { jp: 'いか', fr: t('home.marquee.words.calamar') },
  { jp: 'さば', fr: t('home.marquee.words.maquereau') },
  { jp: '醤油', fr: t('home.marquee.words.sauce_soja') },
  { jp: 'みりん', fr: t('home.marquee.words.mirin') },
  { jp: '昆布', fr: t('home.marquee.words.kombu') },
  { jp: '味噌', fr: t('home.marquee.words.miso') },
])
</script>

<template>
  <section :class="homeSections.marqueeSection">
    <div :class="homeSections.marqueeContainer">
      <div :class="[homeSections.marqueeTrack, 'marquee-track-left']">
        <div v-for="(w, i) in [...row1, ...row1]" :key="'r1-' + i" :class="homeSections.marqueeChip">
          <span :class="homeSections.marqueeJp">{{ w.jp }}</span>
          <span :class="homeSections.marqueeFr">{{ w.fr }}</span>
        </div>
      </div>
    </div>
    <div :class="homeSections.marqueeContainer">
      <div :class="[homeSections.marqueeTrack, homeSections.marqueeTrackReverse, 'marquee-track-right']">
        <div v-for="(w, i) in [...row2, ...row2]" :key="'r2-' + i" :class="homeSections.marqueeChip">
          <span :class="homeSections.marqueeJp">{{ w.jp }}</span>
          <span :class="homeSections.marqueeFr">{{ w.fr }}</span>
        </div>
      </div>
    </div>
  </section>
</template>
