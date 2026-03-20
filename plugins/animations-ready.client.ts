/**
 * Déclenche les animations CSS côté client après le premier paint.
 * Sur iOS Safari, les animations présentes dans le HTML initial (SSR) ne se lancent
 * souvent pas. En ajoutant une classe après hydratation, on force le navigateur
 * à appliquer les règles d’animation et les keyframes.
 */
const ANIMATIONS_READY_CLASS = 'animations-ready'
const FALLBACK_MS = 1200

function addAnimationsReady() {
  if (import.meta.server) return
  const html = document.documentElement
  if (html.classList.contains(ANIMATIONS_READY_CLASS)) return
  html.classList.add(ANIMATIONS_READY_CLASS)
}

export default defineNuxtPlugin(() => {
  if (import.meta.server) return
  let added = false
  const apply = () => {
    if (added) return
    addAnimationsReady()
    added = true
  }
  requestAnimationFrame(() => requestAnimationFrame(apply))
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply)
  } else {
    apply()
  }
  setTimeout(() => { if (!added) apply() }, FALLBACK_MS)
})
