/**
 * Enregistre le mode "réinitialisation mot de passe" avant que le client Supabase
 * ne lise le hash (getSession peut consommer/nettoyer l'URL). La page login lit
 * ce flag pour afficher le formulaire "Nouveau mot de passe".
 */
import { setRecoveryFlagIfNeeded } from '~/utils/auth-recovery'

export default defineNuxtPlugin(() => {
  if (import.meta.server) return
  setRecoveryFlagIfNeeded({
    hash: globalThis.window.location.hash || '',
    search: globalThis.window.location.search || '',
    setStorageItem: (key, value) => sessionStorage.setItem(key, value),
  })
})
