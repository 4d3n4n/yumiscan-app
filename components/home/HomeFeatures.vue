<script setup lang="ts">
import { PhGlobe, PhShieldCheck, PhWarningDiamond, PhChartLineUp } from '@phosphor-icons/vue'
import homeSections from '~/assets/css/home-sections.module.css'
</script>

<template>
  <section>
    <h2 :class="homeSections.sectionTitle">{{ $t('home.features.title') }}</h2>
    <div :class="homeSections.featuresGrid">
      <article :class="homeSections.featureCard">
        <div :class="homeSections.featureCardIcon">
          <PhGlobe :size="18" weight="duotone" />
        </div>
        <h3 :class="homeSections.featureCardTitle">{{ $t('home.features.list.opt_japon_title') }}</h3>
        <p :class="homeSections.featureCardDesc">{{ $t('home.features.list.opt_japon_desc') }}</p>
      </article>
      <article :class="homeSections.featureCard">
        <div :class="[homeSections.featureCardIcon, homeSections['featureCardIcon--accent']]">
          <PhShieldCheck :size="18" weight="duotone" />
        </div>
        <h3 :class="homeSections.featureCardTitle">{{ $t('home.features.list.opt_criteria_title') }}</h3>
        <p :class="homeSections.featureCardDesc">{{ $t('home.features.list.opt_criteria_desc') }}</p>
      </article>
      <article :class="homeSections.featureCard">
        <div :class="[homeSections.featureCardIcon, homeSections['featureCardIcon--warning']]">
          <PhWarningDiamond :size="18" weight="duotone" />
        </div>
        <h3 :class="homeSections.featureCardTitle">{{ $t('home.features.list.opt_alerte_title') }}</h3>
        <p :class="homeSections.featureCardDesc">{{ $t('home.features.list.opt_alerte_desc') }}</p>
      </article>
      <article :class="homeSections.featureCard">
        <div :class="[homeSections.featureCardIcon, homeSections['featureCardIcon--destructive']]">
          <PhChartLineUp :size="18" weight="duotone" />
        </div>
        <h3 :class="homeSections.featureCardTitle">{{ $t('home.features.list.opt_ai_title') }}</h3>
        <p :class="homeSections.featureCardDesc">{{ $t('home.features.list.opt_ai_desc') }}</p>
      </article>
    </div>
  </section>
</template>
