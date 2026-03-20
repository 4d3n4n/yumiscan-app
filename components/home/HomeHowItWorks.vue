<script setup lang="ts">
import homeSections from '~/assets/css/home-sections.module.css'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const words = computed(() => [
  { jp: '大豆', fr: t('home.steps.words.soja') },
  { jp: '小麦粉', fr: t('home.steps.words.farine') },
  { jp: '牛乳', fr: t('home.steps.words.lait') },
  { jp: '卵', fr: t('home.steps.words.oeuf') },
  { jp: 'えび', fr: t('home.steps.words.crevette') },
  { jp: '砂糖', fr: t('home.steps.words.sucre') },
])

// 0 = zoom initial | 1 = scan laser | 2 = détection | 3 = traduction | 4 = succès
const DURATIONS = [1000, 1700, 1600, 2200, 3200] as const

const phase = ref(0)
let timer: ReturnType<typeof setTimeout> | null = null

const advance = () => {
  phase.value = (phase.value + 1) % DURATIONS.length
  timer = setTimeout(advance, DURATIONS[phase.value])
}

onMounted(() => {
  timer = setTimeout(advance, DURATIONS[0])
})

onUnmounted(() => {
  if (timer) { clearTimeout(timer); timer = null }
})
</script>

<template>
  <section class="hiw-section">
    <h2 :class="homeSections.sectionTitle">{{ $t('home.steps.title') }}</h2>


    <!-- Animated demo card -->
    <div class="scan-demo" :data-phase="phase">

      <!-- Camera viewfinder corners -->
      <span class="vf vf--tl" />
      <span class="vf vf--tr" />
      <span class="vf vf--bl" />
      <span class="vf vf--br" />

      <!-- Phase indicator badge -->
      <div class="phase-badge">
        <span v-if="phase === 0">{{ $t('home.steps.phase_0') }}</span>
        <span v-else-if="phase === 1">
          <span class="pulse-dot" />
          {{ $t('home.steps.phase_1') }}
        </span>
        <span v-else-if="phase === 2">{{ $t('home.steps.phase_2') }}</span>
        <span v-else-if="phase === 3">{{ $t('home.steps.phase_3') }}</span>
        <span v-else>{{ $t('home.steps.phase_4') }}</span>
      </div>

      <!-- Product image (zooms in on phase 1+) -->
      <img
        src="/images/home_animation.webp"
        :alt="t('home.steps.image_alt')"
        class="scan-bg"
      />

      <!-- Subtle dark overlay -->
      <div class="scan-overlay" />

      <!-- Purple scan laser (phase 1) -->
      <div class="scan-laser" />

      <!-- Label panel slides up from bottom (phase 1+) -->
      <div class="scan-label">
        <div class="scan-label__header">
          <span class="scan-label__title">{{ $t('home.steps.label_jp') }}</span>
          <span class="scan-label__status">
            <span v-if="phase <= 2">{{ $t('home.steps.label_ing') }}</span>
            <span v-else>{{ $t('home.steps.label_ai') }}</span>
          </span>
        </div>
        <div class="scan-label__words">
          <div
            v-for="(w, i) in words"
            :key="i"
            class="scan-word"
            :style="`--i: ${i}`"
          >
            <span class="scan-word__jp">{{ w.jp }}</span>
            <div class="scan-word__box" />
            <span class="scan-word__fr">{{ w.fr }}</span>
          </div>
        </div>
      </div>

      <!-- Success badge (phase 4) -->
      <div class="scan-success">
        <div class="scan-success__badge">
          <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13">
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
          </svg>
          {{ $t('home.steps.success_msg') }}
        </div>
        <p class="scan-success__sub">{{ $t('home.steps.success_sub') }}</p>
      </div>
    </div>

    <!-- Step labels -->
    <div class="scan-steps">
      <div class="scan-step" :class="{ active: phase >= 0 }">
        <span class="scan-step__n">1</span>
        <span class="scan-step__label">{{ $t('home.steps.nav_1') }}</span>
      </div>
      <div class="scan-step__line" />
      <div class="scan-step" :class="{ active: phase >= 1 }">
        <span class="scan-step__n">2</span>
        <span class="scan-step__label">{{ $t('home.steps.nav_2') }}</span>
      </div>
      <div class="scan-step__line" />
      <div class="scan-step" :class="{ active: phase >= 3 }">
        <span class="scan-step__n">3</span>
        <span class="scan-step__label">{{ $t('home.steps.nav_3') }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* ─── Section wrapper ──────────────────────────────────────────────────────── */
.hiw-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: -1.75rem;
}

/* ─── Demo card ──────────────────────────────────────────────────────────── */
.scan-demo {
  position: relative;
  width: 100%;
  max-width: 300px;
  aspect-ratio: 9 / 15;
  border-radius: 22px;
  overflow: hidden;
  border: 2.5px solid var(--bold-border-color);
  box-shadow:
    6px 6px 0 0 var(--bold-color),
    0 20px 60px rgba(0, 0, 0, 0.18);
  background: #0a0a12;
  margin-bottom: 1.5rem;
}

/* ─── BG image ─────────────────────────────────────────────────────────────── */
.scan-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1);
  -webkit-transform: scale(1);
  transition: transform 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  -webkit-transition: transform 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  will-change: transform;
}
[data-phase="1"] .scan-bg,
[data-phase="2"] .scan-bg,
[data-phase="3"] .scan-bg,
[data-phase="4"] .scan-bg {
  transform: scale(1.12);
  -webkit-transform: scale(1.12);
}

/* ─── Dark overlay ──────────────────────────────────────────────────────── */
.scan-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.22);
  transition: background 0.6s ease;
  z-index: 1;
}
[data-phase="4"] .scan-overlay {
  background: rgba(0, 0, 0, 0.55);
}

/* ─── Phase badge ──────────────────────────────────────────────────────── */
.phase-badge {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 6;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 999px;
  padding: 4px 12px;
  font-family: 'Space Grotesk', system-ui, sans-serif;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 5px;
}

.pulse-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: hsl(var(--primary));
  animation: pulseDot 1s ease-in-out infinite;
}

@keyframes pulseDot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.35; transform: scale(0.75); }
}

/* ─── Viewfinder corners ─────────────────────────────────────────────────── */
.vf {
  position: absolute;
  width: 18px;
  height: 18px;
  border-style: solid;
  border-color: rgba(255, 255, 255, 0.85);
  border-width: 0;
  z-index: 3;
  transition: opacity 0.5s ease;
}
[data-phase="0"] .vf { opacity: 1; }
[data-phase="1"] .vf,
[data-phase="2"] .vf,
[data-phase="3"] .vf,
[data-phase="4"] .vf { opacity: 0.25; }

.vf--tl { top: 36px; left: 12px; border-top-width: 2.5px; border-left-width: 2.5px; border-top-left-radius: 4px; }
.vf--tr { top: 36px; right: 12px; border-top-width: 2.5px; border-right-width: 2.5px; border-top-right-radius: 4px; }
.vf--bl { bottom: 10px; left: 12px; border-bottom-width: 2.5px; border-left-width: 2.5px; border-bottom-left-radius: 4px; }
.vf--br { bottom: 10px; right: 12px; border-bottom-width: 2.5px; border-right-width: 2.5px; border-bottom-right-radius: 4px; }

/* ─── Scan laser ─────────────────────────────────────────────────────────── */
.scan-laser {
  position: absolute;
  left: 0;
  right: 0;
  top: 5%;
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    hsl(var(--primary) / 0.6) 20%,
    hsl(var(--primary)) 45%,
    rgba(255, 255, 255, 0.95) 50%,
    hsl(var(--primary)) 55%,
    hsl(var(--primary) / 0.6) 80%,
    transparent 100%
  );
  box-shadow:
    0 0 12px 3px hsl(var(--primary) / 0.55),
    0 0 30px 6px hsl(var(--primary) / 0.2);
  opacity: 0;
  z-index: 4;
  pointer-events: none;
}
[data-phase="1"] .scan-laser {
  opacity: 1;
  animation: laserSweep 1.55s ease-in-out forwards;
}

@keyframes laserSweep {
  0%   { top: 6%;  opacity: 0; }
  4%   { opacity: 1; }
  92%  { opacity: 0.9; }
  100% { top: 62%; opacity: 0; }
}

/* ─── Label panel ────────────────────────────────────────────────────────── */
.scan-label {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.97);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-top: 2px solid rgba(0, 0, 0, 0.07);
  padding: 10px 12px 13px;
  transform: translateY(100%);
  -webkit-transform: translateY(100%);
  transition: transform 0.6s cubic-bezier(0.34, 1.15, 0.64, 1);
  -webkit-transition: transform 0.6s cubic-bezier(0.34, 1.15, 0.64, 1);
  will-change: transform;
  z-index: 5;
}
:global(.dark) .scan-label {
  background: rgba(12, 10, 22, 0.97);
  border-top-color: hsl(var(--primary) / 0.18);
}
[data-phase="1"] .scan-label,
[data-phase="2"] .scan-label,
[data-phase="3"] .scan-label,
[data-phase="4"] .scan-label {
  transform: translateY(0);
  -webkit-transform: translateY(0);
}

.scan-label__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 9px;
}
.scan-label__title {
  font-size: 14px;
  font-weight: 800;
  color: hsl(var(--foreground));
  font-family: system-ui, sans-serif;
}
.scan-label__status {
  font-family: 'Space Grotesk', system-ui, sans-serif;
  font-size: 8.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: hsl(var(--muted-foreground));
}

.scan-label__words {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

/* ─── Word chips ─────────────────────────────────────────────────────────── */
.scan-word {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 9px 5px;
  gap: 2px;
  border-radius: 7px;
  min-width: 40px;
  text-align: center;
}

.scan-word__jp {
  font-size: 14px;
  font-weight: 800;
  color: hsl(var(--foreground));
  line-height: 1.1;
  font-family: system-ui, sans-serif;
}

/* Detection box */
.scan-word__box {
  position: absolute;
  inset: 0;
  border-radius: 7px;
  border: 2px solid transparent;
  opacity: 0;
  transform: scale(1.25);
  -webkit-transform: scale(1.25);
  transition:
    opacity 0.35s ease calc(var(--i, 0) * 0.11s),
    transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) calc(var(--i, 0) * 0.11s),
    border-color 0.35s ease calc(var(--i, 0) * 0.11s),
    box-shadow 0.35s ease calc(var(--i, 0) * 0.11s);
  -webkit-transition:
    opacity 0.35s ease calc(var(--i, 0) * 0.11s),
    transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) calc(var(--i, 0) * 0.11s),
    border-color 0.35s ease calc(var(--i, 0) * 0.11s),
    box-shadow 0.35s ease calc(var(--i, 0) * 0.11s);
  will-change: transform, opacity;
}
[data-phase="2"] .scan-word__box,
[data-phase="3"] .scan-word__box,
[data-phase="4"] .scan-word__box {
  opacity: 1;
  transform: scale(1);
  -webkit-transform: scale(1);
  border-color: hsl(var(--primary));
  box-shadow:
    0 0 8px hsl(var(--primary) / 0.3),
    inset 0 0 5px hsl(var(--primary) / 0.07);
}

/* Translation label */
.scan-word__fr {
  font-family: 'Space Grotesk', system-ui, sans-serif;
  font-size: 7.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: hsl(var(--primary));
  opacity: 0;
  transform: translateY(4px);
  -webkit-transform: translateY(4px);
  transition:
    opacity 0.35s ease calc(var(--i, 0) * 0.13s + 0.08s),
    transform 0.35s ease calc(var(--i, 0) * 0.13s + 0.08s);
  -webkit-transition:
    opacity 0.35s ease calc(var(--i, 0) * 0.13s + 0.08s),
    transform 0.35s ease calc(var(--i, 0) * 0.13s + 0.08s);
  will-change: transform, opacity;
  white-space: nowrap;
}
[data-phase="3"] .scan-word__fr,
[data-phase="4"] .scan-word__fr {
  opacity: 1;
  transform: translateY(0);
  -webkit-transform: translateY(0);
}

/* ─── Success overlay ────────────────────────────────────────────────────── */
.scan-success {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding-top: 34px;
  z-index: 10;
  pointer-events: none;
  gap: 7px;
}

.scan-success__badge {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 16px;
  background: hsl(var(--success));
  color: white;
  font-family: 'Space Grotesk', system-ui, sans-serif;
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-radius: 999px;
  border: 2px solid rgba(255, 255, 255, 0.25);
  box-shadow:
    0 4px 20px rgba(0, 0, 0, 0.35),
    0 0 0 3px hsl(var(--success) / 0.25);
  opacity: 0;
  transform: scale(0.65) translateY(-14px);
  -webkit-transform: scale(0.65) translateY(-14px);
  transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  -webkit-transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  will-change: transform, opacity;
}
[data-phase="4"] .scan-success__badge {
  opacity: 1;
  transform: scale(1) translateY(0);
  -webkit-transform: scale(1) translateY(0);
}

.scan-success__sub {
  font-family: 'Space Grotesk', system-ui, sans-serif;
  font-size: 9.5px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  text-align: center;
  letter-spacing: 0.03em;
  opacity: 0;
  transform: translateY(5px);
  -webkit-transform: translateY(5px);
  transition: all 0.45s ease 0.22s;
  -webkit-transition: all 0.45s ease 0.22s;
  will-change: transform, opacity;
}
[data-phase="4"] .scan-success__sub {
  opacity: 1;
  transform: translateY(0);
  -webkit-transform: translateY(0);
}

/* ─── Step labels row ───────────────────────────────────────────────────── */
.scan-steps {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 300px;
}

.scan-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  flex: 1;
  text-align: center;
  opacity: 0.38;
  transition: opacity 0.5s ease;
}
.scan-step.active { opacity: 1; }

.scan-step__n {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Space Grotesk', system-ui, sans-serif;
  font-size: 11px;
  font-weight: 800;
  border: 2.5px solid var(--bold-border-color);
  border-radius: 8px;
  background: hsl(var(--card));
  box-shadow: var(--bold-shadow-xs);
  transition: background 0.5s ease, color 0.5s ease, border-color 0.5s ease;
}
.scan-step.active .scan-step__n {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border-color: hsl(var(--primary));
}

.scan-step__label {
  font-family: 'Space Grotesk', system-ui, sans-serif;
  font-size: 8.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: hsl(var(--muted-foreground));
}

.scan-step__line {
  flex: 0.4;
  height: 2px;
  background: var(--bold-border-color);
  opacity: 0.2;
  margin-top: -14px;
  border-radius: 2px;
}
</style>
