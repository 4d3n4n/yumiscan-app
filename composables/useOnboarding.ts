/**
 * Onboarding global — affiché une seule fois après la première connexion.
 * Persiste dans localStorage pour ne jamais réapparaître.
 */

const STORAGE_KEY = 'yumiscan-onboarding-done'

const isVisible = ref(false)
const currentStep = ref(0)
const totalSteps = 7

type Platform = 'ios' | 'ios-other' | 'android' | 'desktop'

function detectPlatform(): Platform {
    if (typeof navigator === 'undefined') return 'desktop'
    const ua = navigator.userAgent || ''
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    if (isIOS) {
        // Safari on iOS does NOT contain 'CriOS' (Chrome), 'FxiOS' (Firefox), 'EdgiOS' (Edge), etc.
        const isNotSafari = /CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser/i.test(ua)
        return isNotSafari ? 'ios-other' : 'ios'
    }
    if (/Android/i.test(ua)) return 'android'
    return 'desktop'
}

export function useOnboarding() {
    const isClient = ref(false)
    if (import.meta.client) {
        isClient.value = true
    }

    const platform = computed<Platform>(() => {
        if (!isClient.value) return 'desktop'
        return detectPlatform()
    })

    /** Vérifie si l'onboarding a déjà été vu */
    const isDone = () => {
        if (!import.meta.client) return true
        return localStorage.getItem(STORAGE_KEY) === '1'
    }

    /** Lance l'onboarding si pas encore vu (l'appelant doit vérifier l'auth) */
    const tryShow = () => {
        if (isDone()) return
        currentStep.value = 0
        isVisible.value = true
    }

    const nextStep = () => {
        if (currentStep.value < totalSteps - 1) {
            currentStep.value++
        } else {
            complete()
        }
    }

    const prevStep = () => {
        if (currentStep.value > 0) currentStep.value--
    }

    const complete = () => {
        isVisible.value = false
        currentStep.value = 0
        if (import.meta.client) localStorage.setItem(STORAGE_KEY, '1')
    }

    const skip = () => complete()

    /** Force la réouverture de l'onboarding (depuis /account) */
    const reset = () => {
        if (import.meta.client) localStorage.removeItem(STORAGE_KEY)
        currentStep.value = 0
        isVisible.value = true
    }

    return {
        isVisible: readonly(isVisible),
        currentStep: readonly(currentStep),
        totalSteps,
        platform: readonly(platform),
        tryShow,
        nextStep,
        prevStep,
        complete,
        skip,
        reset,
    }
}
