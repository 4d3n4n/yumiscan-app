<script setup lang="ts">
import { PhLightning, PhInfo } from '@phosphor-icons/vue'

defineEmits<{ scan: [] }>()
defineProps<{ loading?: boolean; disabled?: boolean }>()
</script>

<template>
  <div class="relative flex flex-col items-center w-full space-y-5 overflow-visible text-center">
    <!-- Decorative dots -->
    <div class="absolute inset-0 -z-10 pointer-events-none bg-dots-bold" />
    <div class="absolute inset-0 -z-10 pointer-events-none bg-gradient-to-b from-transparent via-transparent to-background" />

    <!-- Logo + Brand -->
    <div class="flex flex-col items-center gap-3 animate-pop-in">
      <div class="hero-logo">
        <img src="/images/logo-primary.png" alt="YumiScan" class="w-full h-full object-contain drop-shadow-lg" />
      </div>
      <div class="flex items-center gap-2">
        <span class="text-2xl md:text-3xl font-black font-heading tracking-tight text-foreground">Yumi</span>
        <span class="text-2xl md:text-3xl font-black font-heading tracking-tight text-gradient-primary">Scan</span>
      </div>
    </div>

    <!-- Title -->
    <h1 class="text-[2rem] md:text-5xl font-black font-heading tracking-tight leading-[1.1] animate-pop-in overflow-visible" style="animation-delay: 80ms;">
      {{ $t('home.intro.title_scannez') }}<br/>
      <span class="text-gradient-primary italic">{{ $t('home.intro.title_protegez') }}</span>
    </h1>

    <!-- Description -->
    <p class="text-[0.95rem] text-muted-foreground leading-relaxed max-w-sm animate-pop-in" style="animation-delay: 130ms;">
      {{ $t('home.intro.description') }}
    </p>

    <!-- Feature pills row -->
    <div class="flex flex-wrap justify-center gap-2.5 animate-pop-in" style="animation-delay: 180ms;">
      <!-- Détection Allergènes : icône PNG (allergens.png en blanc) -->
      <div class="bold-feature-pill">
        <div class="bold-feature-pill__icon bold-feature-pill__icon--purple">
          <img src="/images/icons/allergens.png" alt="" class="icon-allergens-white w-5 h-5 object-contain" width="20" height="20" />
        </div>
        <div class="flex flex-col text-left">
          <span class="bold-feature-pill__label">{{ $t('home.intro.pill_detection') }}</span>
          <span class="bold-feature-pill__value">{{ $t('home.intro.pill_allergens') }}</span>
        </div>
      </div>
      <div class="bold-feature-pill">
        <div class="bold-feature-pill__icon" style="background: hsl(var(--warning));">
          <PhLightning class="w-5 h-5 text-white" weight="fill" />
        </div>
        <div class="flex flex-col text-left">
          <span class="bold-feature-pill__label">{{ $t('home.intro.pill_scan') }}</span>
          <span class="bold-feature-pill__value">{{ $t('home.intro.pill_instant') }}</span>
        </div>
      </div>
    </div>

    <!-- CTA (animation sur le wrapper pour que le hover du bouton fonctionne) -->
    <div class="animate-pop-in w-full" style="animation-delay: 240ms;">
      <ScanCtaButton
        size="hero"
        :loading="loading"
        :disabled="disabled"
        @click="$emit('scan')"
      />
    </div>

    <p class="flex items-top justify-center gap-1.5 text-center text-[9px] text-muted-foreground/60 leading-relaxed max-w-xs uppercase tracking-wider font-bold animate-pop-in" style="animation-delay: 300ms;">
      <PhInfo :size="12" weight="regular" class="shrink-0" />
      <span>{{ $t('home.intro.disclaimer') }}</span>
    </p>
  </div>
</template>

<style scoped>
/* Icône allergènes en blanc (image noire → filtre blanc) */
.icon-allergens-white {
  filter: brightness(0) invert(1);
}

.hero-logo {
  width: 5.5rem;
  height: 5.5rem;
  border-radius: 1.5rem;
  padding: 0.5rem;
  background: linear-gradient(
    180deg,
    hsl(var(--primary) / 0.1) 0%,
    hsl(var(--primary) / 0.05) 50%,
    #fff 100%
  );
  border: 2.5px solid hsl(var(--primary) / 0.2);
  box-shadow:
    0 0 0 6px hsl(var(--primary) / 0.04),
    0 8px 30px hsl(var(--primary) / 0.12);
  animation: logo-float 4s ease-in-out infinite;
}

@keyframes logo-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

@media (min-width: 768px) {
  .hero-logo {
    width: 6.5rem;
    height: 6.5rem;
  }
}
</style>
