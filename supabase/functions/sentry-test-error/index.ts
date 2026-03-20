/**
 * Edge Function de test : déclenche une erreur volontaire pour vérifier
 * la remontée Sentry (tag area: back) et la notification Discord.
 * L'accès exige un JWT utilisateur valide et un rôle admin côté backend.
 */
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/admin.ts'
import { captureError, getSentryDisabledReason, isSentryConfigured, isSentryReportingEnabled } from '../_shared/sentry.ts'

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    await requireAdmin(req)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur serveur'
    const status = message.includes('Forbidden') ? 403 : message.includes('token') || message.includes('auth') ? 401 : 500
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    throw new Error('[Test] Erreur back — Edge Function sentry-test-error')
  } catch (e) {
    if (!isSentryConfigured()) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Sentry non configuré pour les Edge Functions. Définissez SENTRY_DSN ou NUXT_PUBLIC_SENTRY_DSN dans les secrets Supabase.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (!isSentryReportingEnabled()) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: getSentryDisabledReason(),
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    try {
      const sent = await captureError(e, { function: 'sentry-test-error' })
      if (!sent) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: 'Erreur de test non envoyée à Sentry. Vérifiez la configuration DSN ou les filtres d’erreurs attendues.',
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
    } catch (err) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: err instanceof Error ? err.message : 'Échec de l’envoi vers Sentry.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    return new Response(
      JSON.stringify({
        ok: true,
        message: 'Erreur de test envoyée à Sentry (area: back). Vérifiez Discord.',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
