/**
 * Endpoint Discord Interactions : reçoit les clics sur les boutons (Résoudre / Ignorer)
 * et met à jour le statut de l'issue dans Sentry via l'API.
 * À configurer comme "Interactions Endpoint URL" dans le portail Discord.
 *
 * Discord exige : 1) vérification de la signature (timestamp + body brut), 2) réponse PONG si type 1.
 * Toujours utiliser le body brut (req.text()) pour la signature, jamais req.json() puis JSON.stringify().
 */
import { corsHeaders } from '../_shared/cors.ts'
import { verifyAsync } from 'https://esm.sh/@noble/ed25519@2.1.0'

const DISCORD_PUBLIC_KEY = Deno.env.get('DISCORD_PUBLIC_KEY')
const SENTRY_AUTH_TOKEN = Deno.env.get('SENTRY_AUTH_TOKEN')

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16)
  return bytes
}

/** Vérifie la signature Discord avec le body brut (timestamp + body, pas de re-sérialisation JSON). */
async function verifyDiscordSignature(
  rawBody: string,
  signatureHex: string | null,
  timestamp: string | null,
  publicKeyHex: string | undefined
): Promise<boolean> {
  if (!publicKeyHex || !signatureHex || !timestamp) return false
  try {
    const message = new TextEncoder().encode(timestamp + rawBody)
    const sig = hexToBytes(signatureHex)
    const key = hexToBytes(publicKeyHex)
    return await verifyAsync(sig, message, key)
  } catch (e) {
    console.error('[discord-interactions] verify error:', e)
    return false
  }
}

type DiscordInteraction = {
  type: number | string
  data?: { custom_id?: string }
}

async function updateSentryIssueStatus(orgSlug: string, issueId: string, status: 'resolved' | 'ignored'): Promise<boolean> {
  const token = SENTRY_AUTH_TOKEN
  if (!token) {
    console.error('[discord-interactions] SENTRY_AUTH_TOKEN not set')
    return false
  }
  const url = `https://sentry.io/api/0/organizations/${encodeURIComponent(orgSlug)}/issues/${encodeURIComponent(issueId)}/`
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  })
  if (!res.ok) {
    console.error('[discord-interactions] Sentry API error:', res.status, await res.text())
    return false
  }
  return true
}

function parseCustomId(customId: string): { action: 'resolve' | 'ignore'; orgSlug: string; issueId: string } | null {
  // Format: sentry:resolve:orgSlug:issueId ou sentry:ignore:orgSlug:issueId
  const parts = customId.split(':')
  if (parts.length < 4 || parts[0] !== 'sentry') return null
  let action: 'resolve' | 'ignore' | null = null
  if (parts[1] === 'resolve') action = 'resolve'
  else if (parts[1] === 'ignore') action = 'ignore'
  if (!action) return null
  const orgSlug = parts[2]
  const issueId = parts.slice(3).join(':') // au cas où issueId contiendrait ":"
  if (!orgSlug || !issueId) return null
  return { action, orgSlug, issueId }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Toujours utiliser le body brut pour la signature (Discord signe timestamp + body tel quel)
  const rawBody = await req.text()
  const signature = req.headers.get('X-Signature-Ed25519')
  const timestamp = req.headers.get('X-Signature-Timestamp')

  if (!signature || !timestamp) {
    return new Response(JSON.stringify({ error: 'Missing signature headers' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (!DISCORD_PUBLIC_KEY) {
    console.error('[discord-interactions] DISCORD_PUBLIC_KEY not set (General Information → Public Key in Discord Developer Portal)')
    return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const ok = await verifyDiscordSignature(rawBody, signature, timestamp, DISCORD_PUBLIC_KEY)
  if (!ok) {
    console.error('[discord-interactions] Invalid signature (check DISCORD_PUBLIC_KEY = Public Key from Discord Developer Portal, not Bot Token or Client Secret)')
    return new Response(JSON.stringify({ error: 'Invalid request signature' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let interaction: DiscordInteraction
  try {
    interaction = JSON.parse(rawBody) as DiscordInteraction
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Type 1 = PING (Discord vérifie l'URL) → PONG
  if (Number(interaction.type) === 1) {
    return new Response(JSON.stringify({ type: 1 }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Type 3 = MESSAGE_COMPONENT (clic sur un bouton)
  if (interaction.type === 3 && interaction.data?.custom_id) {
    const parsed = parseCustomId(interaction.data.custom_id)
    if (!parsed) {
      return new Response(
        JSON.stringify({
          type: 4,
          data: { content: 'Action inconnue.', flags: 64 },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const status = parsed.action === 'resolve' ? 'resolved' : 'ignored'
    const success = await updateSentryIssueStatus(parsed.orgSlug, parsed.issueId, status)

    const label = parsed.action === 'resolve' ? 'résolue' : 'ignorée'
    const content = success
      ? `Issue marquée comme **${label}** dans Sentry.`
      : `Impossible de mettre à jour Sentry (vérifier SENTRY_AUTH_TOKEN et droits).`

    return new Response(
      JSON.stringify({
        type: 4,
        data: { content, flags: 64 },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(JSON.stringify({ type: 4, data: { content: 'Interaction non gérée.', flags: 64 } }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
