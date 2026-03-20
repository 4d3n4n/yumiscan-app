type ScrollToHashOptions = {
  behavior?: ScrollBehavior
  attempts?: number
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getHashScrollBehavior(): ScrollBehavior {
  return 'auto'
}

function getHashTarget(hash: string) {
  if (!import.meta.client || !hash) return null

  try {
    return document.querySelector<HTMLElement>(hash)
  } catch {
    return document.getElementById(hash.replace(/^#/, ''))
  }
}

function getHashScrollOffset(hash: string, target: HTMLElement) {
  const explicitOffset = Number(target.dataset.scrollOffset ?? NaN)
  if (Number.isFinite(explicitOffset)) {
    return explicitOffset
  }

  if (!import.meta.client) return 0

  return 24
}

export async function scrollToHashTarget(hash: string, options: ScrollToHashOptions = {}) {
  if (!import.meta.client || !hash) return false

  const attempts = options.attempts ?? 28
  const behavior = options.behavior ?? getHashScrollBehavior()

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const target = getHashTarget(hash)
    if (target) {
      const offset = getHashScrollOffset(hash, target)
      const nextTop = Math.max(0, window.scrollY + target.getBoundingClientRect().top - offset)
      window.scrollTo({ top: nextTop, behavior })
      return true
    }

    await wait(32)
  }

  return false
}
