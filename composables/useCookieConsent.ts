export interface CookieConsent {
  analytics: boolean
  ads: boolean
}

const STORAGE_KEY = 'yumiscan_cookie_consent'

const consent = ref<CookieConsent | null>(null)
const hasConsented = computed(() => consent.value !== null)

/** Affiche le bandeau cookies (popup de base) depuis le lien "Gestion des cookies" du footer */
const forceShowCookieBanner = ref(false)
/** Ouvert uniquement par "Personnaliser" sur le bandeau (modal avec toggles) */
const showCookieModal = ref(false)

const loadConsent = () => {
  if (import.meta.client) {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try { consent.value = JSON.parse(stored) } catch { consent.value = null }
    }
  }
}

const saveConsent = (value: CookieConsent) => {
  consent.value = value
  if (import.meta.client) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  }
}

export function useCookieConsent() {
  if (import.meta.client && consent.value === null) {
    loadConsent()
  }

  const acceptAll = () => saveConsent({ analytics: true, ads: true })
  const rejectAll = () => saveConsent({ analytics: false, ads: false })
  const saveCustom = (value: CookieConsent) => saveConsent(value)

  const resetConsent = () => {
    consent.value = null
    if (import.meta.client) localStorage.removeItem(STORAGE_KEY)
  }

  /** Affiche le bandeau cookies (popup de base avec 3 boutons), pas le modal toggles. */
  const openCookieSettings = () => {
    forceShowCookieBanner.value = true
  }

  const closeCookieBanner = () => {
    forceShowCookieBanner.value = false
  }

  const closeCookieModal = () => {
    showCookieModal.value = false
  }

  return {
    consent,
    hasConsented,
    acceptAll,
    rejectAll,
    saveCustom,
    resetConsent,
    forceShowCookieBanner,
    showCookieModal,
    openCookieSettings,
    closeCookieBanner,
    closeCookieModal,
  }
}
