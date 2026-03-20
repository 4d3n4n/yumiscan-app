import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('auth state hardening', () => {
  it('n utilise plus un cache module stale pour l utilisateur', () => {
    const source = readFileSync(resolve(rootDir, 'composables/useAuth.ts'), 'utf8')
    const authHelper = readFileSync(resolve(rootDir, 'utils/supabase-auth.ts'), 'utf8')

    expect(source).not.toContain('cachedUser')
    expect(source).toContain("useState<User | null>('auth-user'")
    expect(source).toContain('resolveAuthenticatedSession,')
    expect(source).toContain('getSessionSnapshot,')
    expect(source).toContain('safeSignOut,')
    expect(source).toContain('const optimisticSession = await getSessionSnapshot(supabase).catch(() => null)')
    expect(source).toContain('if (optimisticSession && hasFreshLocalSession(optimisticSession))')
    expect(source).toContain('const shouldBlockUi = !initialized.value && !user.value')
    expect(source).toContain('const initialResolution = optimisticSession')
    expect(source).toContain('const validatedSession = await resolveAuthenticatedSession(supabase, session)')
    expect(authHelper).toContain('runSerializedAuthOperation')
    expect(authHelper).toContain('getSessionSnapshot(')
    expect(authHelper).toContain("await withTimeout(supabase.auth.signOut({ scope: 'local' }))")
  })

  it('valide un utilisateur avant d appeler une edge function', () => {
    const source = readFileSync(resolve(rootDir, 'composables/useEdgeFunctions.ts'), 'utf8')
    const authHelper = readFileSync(resolve(rootDir, 'utils/supabase-auth.ts'), 'utf8')

    expect(source).toContain("supabase.functions.invoke<T>")
    expect(source).toContain("import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/functions-js'")
    expect(authHelper).toContain('await withTimeout(supabase.auth.getUser())')
    expect(authHelper).toContain('await withTimeout(supabase.auth.refreshSession())')
  })

  it('stabilise le flow de changement d email avec un callback dedie', () => {
    const accountProfile = readFileSync(resolve(rootDir, 'components/account/AccountProfileSection.vue'), 'utf8')
    const authConfirmPage = readFileSync(resolve(rootDir, 'pages/auth/confirm.vue'), 'utf8')
    const loginPage = readFileSync(resolve(rootDir, 'pages/login.vue'), 'utf8')
    const forgotPasswordPage = readFileSync(resolve(rootDir, 'pages/forgot-password.vue'), 'utf8')
    const accountPage = readFileSync(resolve(rootDir, 'pages/app/account.vue'), 'utf8')
    const authSource = readFileSync(resolve(rootDir, 'composables/useAuth.ts'), 'utf8')

    expect(accountProfile).toContain("localePath('/auth/confirm')")
    expect(accountProfile).toContain('verifySupabasePassword(')
    expect(accountProfile).not.toContain('createClient(')
    expect(authSource).toContain('const REMOTE_IDENTITY_REFRESH_TTL_MS = 5_000')
    expect(authSource).toContain('const refreshUserIdentity = async')
    expect(accountPage).toContain('document.addEventListener(\'visibilitychange\', handleAuthVisibilityRefresh')
    expect(accountPage).toContain('window.addEventListener(\'pageshow\', handleAuthVisibilityRefresh')
    expect(accountPage).toContain('void refreshUserIdentity()')
    expect(authConfirmPage).toContain('supabase.auth.verifyOtp(')
    expect(authConfirmPage).toContain('supabase.auth.exchangeCodeForSession(')
    expect(authConfirmPage).toContain("if (mode === 'auto' && isManualEmailChangeType(parsed.type))")
    expect(authConfirmPage).toContain("state.value = 'ready'")
    expect(authConfirmPage).toContain("@click=\"handleManualConfirmation\"")
    expect(authConfirmPage).toContain("definePageMeta({ layout: 'minimal' })")
    expect(authConfirmPage).not.toContain('<AppNavigation />')
    expect(loginPage).toContain("definePageMeta({ middleware: ['guest'] })")
    expect(forgotPasswordPage).toContain("definePageMeta({ middleware: ['guest'] })")
    expect(forgotPasswordPage).not.toContain('<AppNavigation />')
  })

  it('normalise les garde-fous auth dans les middlewares et la navigation', () => {
    const adminMiddleware = readFileSync(resolve(rootDir, 'middleware/admin.ts'), 'utf8')
    const guestMiddleware = readFileSync(resolve(rootDir, 'middleware/guest.ts'), 'utf8')
    const navSource = readFileSync(resolve(rootDir, 'components/app/AppNavigation.vue'), 'utf8')
    const authModal = readFileSync(resolve(rootDir, 'components/auth/AuthGuardModal.vue'), 'utf8')
    const authLoginForm = readFileSync(resolve(rootDir, 'components/auth/AuthLoginForm.vue'), 'utf8')

    expect(adminMiddleware).toContain('resolveAuthenticatedSession(supabase)')
    expect(guestMiddleware).toContain('resolveAuthenticatedSession(supabase)')
    expect(guestMiddleware).toContain('isRecoveryNavigation(to.fullPath, to.hash)')
    expect(guestMiddleware).toContain('parseAuthCallbackParams({ hash, search })')
    expect(guestMiddleware).toContain('shouldShowRecoveryForm({')
    expect(navSource).toContain('const session = await getAuthenticatedSession(supabase)')
    expect(navSource).toContain('const navigationPending = ref(false)')
    expect(navSource).toContain('await router.push(localizedPath)')
    expect(authModal).toContain("watch(() => route.fullPath")
    expect(authModal).toContain("if (props.open) {")
    expect(authLoginForm).toContain("emit('forgotPassword')")
    expect(authLoginForm).toContain("query: redirect ? { redirect } : {}")
  })
})
