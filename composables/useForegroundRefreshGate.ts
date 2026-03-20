export function useForegroundRefreshGate(cooldownMs = 10_000) {
  const lastRunAt = ref(0)

  function shouldRun(now = Date.now()) {
    if ((now - lastRunAt.value) < cooldownMs) {
      return false
    }

    lastRunAt.value = now
    return true
  }

  return {
    shouldRun,
  }
}
