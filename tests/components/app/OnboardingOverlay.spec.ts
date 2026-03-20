import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../../..')

describe('OnboardingOverlay', () => {
  it('etend l onboarding avec deux slides scan, un slide Assistant IA et une image de demo dediee', () => {
    const component = readFileSync(resolve(rootDir, 'components/app/OnboardingOverlay.vue'), 'utf8')
    const composable = readFileSync(resolve(rootDir, 'composables/useOnboarding.ts'), 'utf8')

    expect(composable).toContain('const totalSteps = 7')
    expect(component).toContain('/images/demo_onboarding.webp')
    expect(component).toContain('onboarding.slides.scan_frame.title')
    expect(component).toContain('onboarding.slides.scan_quality.title')
    expect(component).toContain('onboarding.slides.assistant.title')
    expect(component).toContain('const activeAssistantSlide = computed(() => activeSlide.value.kind === \'assistant\' ? activeSlide.value : null)')
    expect(component).toContain('const activeImageSlide = computed(() => activeSlide.value.kind === \'image\' ? activeSlide.value : null)')
  })

  it('ajoute un swipe mobile, un CTA final mobile et un halo Assistant IA plus explicite', () => {
    const component = readFileSync(resolve(rootDir, 'components/app/OnboardingOverlay.vue'), 'utf8')

    expect(component).toContain('@touchstart.passive="handleTouchStart"')
    expect(component).toContain('@touchend.passive="handleTouchEnd"')
    expect(component).toContain('const isMobileOnboarding = computed(() => platform.value !== \'desktop\')')
    expect(component).toContain('v-else-if="showMobileFinalCta"')
    expect(component).toContain('.ob-assistant-preview::before')
    expect(component).toContain('.ob-top-scrim')
    expect(component).toContain('.ob-top-fade')
  })
})
