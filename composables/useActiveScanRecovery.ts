import { resolveSentryReporting } from '~/utils/sentry-reporting'
import { getAuthenticatedSession } from '~/utils/supabase-auth'

const ACTIVE_SCAN_RECOVERY_KEY = 'active_scan_recovery'
const ACTIVE_SCAN_RECOVERY_TTL_MS = 15 * 60 * 1000

type ActiveScanRecoveryEntry = {
  scanId: string
  startedAt: number
  resumeAttempts: number
  autoResumed: boolean
  controlledExit: boolean
}

function isClient() {
  return import.meta.client && typeof globalThis.window !== 'undefined'
}

function readStoredEntry(): ActiveScanRecoveryEntry | null {
  if (!isClient()) return null

  try {
    const raw = globalThis.window.sessionStorage.getItem(ACTIVE_SCAN_RECOVERY_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<ActiveScanRecoveryEntry>
    if (
      typeof parsed.scanId !== 'string'
      || typeof parsed.startedAt !== 'number'
      || typeof parsed.resumeAttempts !== 'number'
      || typeof parsed.autoResumed !== 'boolean'
      || typeof parsed.controlledExit !== 'boolean'
    ) {
      globalThis.window.sessionStorage.removeItem(ACTIVE_SCAN_RECOVERY_KEY)
      return null
    }

    if ((Date.now() - parsed.startedAt) > ACTIVE_SCAN_RECOVERY_TTL_MS) {
      globalThis.window.sessionStorage.removeItem(ACTIVE_SCAN_RECOVERY_KEY)
      return null
    }

    return parsed as ActiveScanRecoveryEntry
  } catch {
    globalThis.window.sessionStorage.removeItem(ACTIVE_SCAN_RECOVERY_KEY)
    return null
  }
}

function writeStoredEntry(entry: ActiveScanRecoveryEntry | null) {
  if (!isClient()) return

  try {
    if (!entry) {
      globalThis.window.sessionStorage.removeItem(ACTIVE_SCAN_RECOVERY_KEY)
      return
    }

    globalThis.window.sessionStorage.setItem(ACTIVE_SCAN_RECOVERY_KEY, JSON.stringify(entry))
  } catch {
    // Ignore sessionStorage failures silently.
  }
}

async function reportScanRecovery(details: Record<string, string>) {
  if (!isClient()) return

  const runtimeConfig = useRuntimeConfig()
  const sentry = resolveSentryReporting({
    dsn: runtimeConfig.public.sentry?.dsn,
    environment: runtimeConfig.public.sentry?.environment,
    forceEnable: runtimeConfig.public.sentry?.forceEnable,
  })

  if (!sentry.enabled || !sentry.dsn) return

  try {
    const Sentry = await import('@sentry/nuxt')
    Sentry.captureMessage('active_scan_recovery_auto_resume', {
      level: 'warning',
      tags: {
        area: 'front',
        feature: 'scan-recovery',
      },
      extra: details,
    })
  } catch {
    // Ignore client-only Sentry failures.
  }
}

export function useActiveScanRecovery() {
  const supabase = useSupabase()
  const route = useRoute()
  const router = useRouter()
  const localePath = useLocalePath()

  function setActiveScanRecovery(scanId: string) {
    writeStoredEntry({
      scanId,
      startedAt: Date.now(),
      resumeAttempts: 0,
      autoResumed: false,
      controlledExit: false,
    })
  }

  function touchActiveScanRecovery(scanId: string) {
    const current = readStoredEntry()
    if (current?.scanId === scanId) {
      writeStoredEntry({
        ...current,
        controlledExit: false,
      })
      return
    }

    setActiveScanRecovery(scanId)
  }

  function clearActiveScanRecovery(scanId?: string) {
    const current = readStoredEntry()
    if (!current) return
    if (scanId && current.scanId !== scanId) return
    writeStoredEntry(null)
  }

  function markControlledScanExit(scanId?: string) {
    const current = readStoredEntry()
    if (!current) return
    if (scanId && current.scanId !== scanId) return

    writeStoredEntry({
      ...current,
      controlledExit: true,
    })
  }

  async function maybeResumePendingScan(reason: string) {
    const current = readStoredEntry()
    if (!current || current.autoResumed || current.controlledExit) return false

    const isAlreadyOnTargetRoute = route.path === localePath(`/app/scan/${current.scanId}`)
    if (isAlreadyOnTargetRoute) return false

    const session = await getAuthenticatedSession(supabase)
    if (!session?.user) {
      return false
    }

    const { data, error } = await supabase
      .from('scans')
      .select('id, processing_status')
      .eq('id', current.scanId)
      .maybeSingle() as { data: { id: string; processing_status: string | null } | null; error: Error | null }

    if (error || !data) {
      clearActiveScanRecovery(current.scanId)
      return false
    }

    if (data.processing_status !== 'processing') {
      clearActiveScanRecovery(current.scanId)
      return false
    }

    writeStoredEntry({
      ...current,
      autoResumed: true,
      resumeAttempts: current.resumeAttempts + 1,
      controlledExit: false,
    })

    void reportScanRecovery({
      scanId: current.scanId,
      reason,
      fromPath: route.fullPath,
    })

    await router.replace(localePath(`/app/scan/${current.scanId}`))
    return true
  }

  return {
    setActiveScanRecovery,
    touchActiveScanRecovery,
    clearActiveScanRecovery,
    markControlledScanExit,
    maybeResumePendingScan,
  }
}
