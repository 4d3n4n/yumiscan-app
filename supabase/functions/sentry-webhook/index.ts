/**
 * Webhook Sentry → Discord : 1 issue = 1 thread (forum).
 * Vérifie la signature, déduplique, crée ou réutilise le thread, poste le message.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SENTRY_WEBHOOK_SECRET = Deno.env.get('SENTRY_WEBHOOK_SECRET')
const DISCORD_WEBHOOK_URL = Deno.env.get('DISCORD_WEBHOOK_URL')
const DISCORD_BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN')
const SENTRY_AUTH_TOKEN = Deno.env.get('SENTRY_AUTH_TOKEN')

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function registerWebhookEvent(dedupKey: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('sentry_register_webhook_event', {
    p_event_id: dedupKey,
  })

  if (error) {
    console.error('[sentry-webhook] Dedup RPC failed:', error)
    return false
  }

  return data === true
}

async function getDiscordThreadId(sentryIssueId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('sentry_get_discord_thread', {
    p_sentry_issue_id: sentryIssueId,
  })

  if (error) {
    console.error('[sentry-webhook] Thread lookup RPC failed:', error)
    return null
  }

  return typeof data === 'string' && data.trim() ? data : null
}

async function upsertDiscordThreadMapping(params: {
  sentryIssueId: string
  discordThreadId: string
  sentryIssueUrl: string | null
  status: string
  updatedAt: string
}): Promise<void> {
  const { error } = await supabase.rpc('sentry_upsert_discord_thread', {
    p_sentry_issue_id: params.sentryIssueId,
    p_discord_thread_id: params.discordThreadId,
    p_sentry_issue_url: params.sentryIssueUrl,
    p_status: params.status,
    p_updated_at: params.updatedAt,
  })

  if (error) {
    console.error('[sentry-webhook] Thread upsert RPC failed:', error)
  }
}

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_PER_ISSUE = 10
const issueRequestCounts = new Map<string, { count: number; resetAt: number }>()

function rateLimit(issueId: string): boolean {
  const now = Date.now()
  const entry = issueRequestCounts.get(issueId)
  if (!entry) {
    issueRequestCounts.set(issueId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }
  if (now > entry.resetAt) {
    issueRequestCounts.set(issueId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }
  entry.count++
  return entry.count > RATE_LIMIT_MAX_PER_ISSUE
}
async function verifySignature(body: string, signature: string | null, secret: string | undefined): Promise<boolean> {
  if (!secret || !signature) return false
  const expected = signature.includes('=') ? signature.split('=')[1] : signature
  if (!expected) return false
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return hex === expected
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

type SentryIssue = {
  id?: string
  web_url?: string
  title?: string
  metadata?: { title?: string }
  culprit?: string
  level?: string
  status?: string
  substatus?: string
  platform?: string
  priority?: string
  count?: string
  userCount?: number
  firstSeen?: string
  lastSeen?: string
  project?: { name?: string; slug?: string }
  issueType?: string
  issueCategory?: string
}

type Payload = {
  action?: string
  data?: { issue?: SentryIssue }
}

function extractPayload(body: string): Payload | null {
  try {
    return JSON.parse(body) as Payload
  } catch {
    return null
  }
}

type DiscordPayload = { content: string; embeds: unknown[]; components: unknown[] }

async function createDiscordThread(webhookUrl: string, threadName: string, payload: DiscordPayload): Promise<string | null> {
  const name = threadName.slice(0, 100)
  const res = await fetch(`${webhookUrl}?wait=true&with_components=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: payload.content,
      embeds: payload.embeds,
      components: payload.components,
      thread_name: name,
    }),
  })
  if (!res.ok) {
    console.error('[sentry-webhook] Discord create thread failed:', res.status, await res.text())
    return null
  }
  const data = (await res.json()) as { id?: string; thread?: { id?: string } }
  const threadId = data.thread?.id ?? data.id
  return threadId ? String(threadId) : null
}

async function postToDiscordThread(webhookUrl: string, threadId: string, payload: DiscordPayload): Promise<boolean> {
  const res = await fetch(`${webhookUrl}?thread_id=${threadId}&with_components=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: payload.content,
      embeds: payload.embeds,
      components: payload.components,
    }),
  })
  if (!res.ok) {
    console.error('[sentry-webhook] Discord post to thread failed:', res.status, await res.text())
    return false
  }
  return true
}

type SentryEvent = {
  tags?: Array<[string, string]> | Array<{ key: string; value: string }>
  request?: { url?: string }
  user?: { id?: string; email?: string; username?: string; ip_address?: string }
  contexts?: { request?: { url?: string } }
  entries?: Array<{
    type?: string
    data?: {
      values?: Array<{
        type?: string
        value?: string
        stacktrace?: { frames?: Array<SentryFrame> }
      }>
    }
  }>
  /** Format SDK (payload envoyé par le client) */
  exception?: {
    values?: Array<{
      type?: string
      value?: string
      stacktrace?: { frames?: Array<SentryFrame> }
    }>
  }
}

type SentryFrame = {
  filename?: string
  abs_path?: string
  function?: string
  /** Numéro de ligne — format SDK / payload (snake_case) */
  lineno?: number
  /** Numéro de ligne — format API REST Sentry (camelCase). On gère les deux selon la source. */
  lineNo?: number
  in_app?: boolean
  context_line?: string
  pre_context?: string[]
  post_context?: string[]
  /** Contexte source — format API REST : tableau [numéro_ligne, contenu]. */
  context?: Array<[number, string]> | Array<{ 0: number; 1: string }>
}

const SOURCE_CONTEXT_MAX_CHARS = 950 // Discord embed field value limit 1024, garder marge

/** Récupère le dernier événement de l'issue (pour tags + contexte source). L'API peut renvoyer un objet ou un tableau. */
async function fetchLatestEvent(orgSlug: string, issueId: string): Promise<SentryEvent | null> {
  if (!SENTRY_AUTH_TOKEN) return null
  try {
    const res = await fetch(
      `https://sentry.io/api/0/organizations/${encodeURIComponent(orgSlug)}/issues/${encodeURIComponent(issueId)}/events/latest/`,
      { headers: { Authorization: `Bearer ${SENTRY_AUTH_TOKEN}` } }
    )
    if (!res.ok) return null
    const data = await res.json()
    if (Array.isArray(data) && data.length > 0) return data[0] as SentryEvent
    return data as SentryEvent
  } catch {
    return null
  }
}

/** Extrait les tags du dernier événement (tous, pour affichage type email Sentry). */
function extractTagsFromEvent(event: SentryEvent | null): Record<string, string> | null {
  if (!event?.tags) return null
  const raw = event.tags
  if (!Array.isArray(raw)) return null
  const tags: Record<string, string> = {}
  for (const t of raw) {
    if (Array.isArray(t) && t.length >= 2) tags[String(t[0])] = String(t[1])
    else if (t && typeof t === 'object' && 'key' in t && 'value' in t) tags[String(t.key)] = String(t.value)
  }
  return Object.keys(tags).length ? tags : null
}

/** Résumé exception : type, value, première ligne de stack (at fn (file:line)). */
function extractExceptionSummary(event: SentryEvent | null): { type: string; value: string; atLine: string } | null {
  if (!event) return null
  let type = ''
  let value = ''
  let topFrame: SentryFrame | null = null
  if (event.entries) {
    for (const entry of event.entries) {
      if (entry?.type !== 'exception' || !entry.data?.values?.length) continue
      const ex = entry.data.values[0]
      type = String(ex.type ?? 'Error')
      value = String(ex.value ?? '')
      const frames = ex.stacktrace?.frames
      if (frames?.length) topFrame = frames[frames.length - 1]
      break
    }
  }
  if (!type && !value && event.exception?.values?.length) {
    const ex = event.exception.values[0]
    type = String(ex.type ?? 'Error')
    value = String(ex.value ?? '')
    const frames = ex.stacktrace?.frames
    if (frames?.length) topFrame = frames[frames.length - 1]
  }
  if (!type && !value) return null
  let atLine = ''
  if (topFrame) {
    const file = topFrame.filename ?? topFrame.abs_path ?? '?'
    const line = topFrame.lineno ?? topFrame.lineNo
    const fn = topFrame.function ?? '?'
    atLine = line != null ? `at ${fn} (${file}:${line})` : `at ${fn} (${file})`
  }
  return { type: type || 'Error', value: value || '—', atLine }
}

/** URL de la requête (request.url ou contexts.request.url ou tag url). */
function extractRequestUrl(event: SentryEvent | null, tags?: Record<string, string> | null): string | null {
  const u = event?.request?.url ?? event?.contexts?.request?.url ?? tags?.url ?? null
  return u && String(u).trim() ? String(u).trim() : null
}

/** Résumé user : id / email / username pour affichage. */
function extractUserSummary(event: SentryEvent | null): string | null {
  const u = event?.user
  if (!u) return null
  const parts = [u.email, u.username, u.id].filter(Boolean) as string[]
  return parts.length ? parts.join(' • ') : null
}

function buildContextBlock(frame: SentryFrame): string | null {
  const lineNo = frame.lineno ?? frame.lineNo ?? 0
  const file = frame.filename ?? frame.abs_path ?? '?'

  const ctxArray = frame.context
  if (Array.isArray(ctxArray) && ctxArray.length > 0) {
    const lines: string[] = []
    for (const pair of ctxArray) {
      const num = Array.isArray(pair) ? pair[0] : (pair as { 0: number; 1: string })[0]
      const line = Array.isArray(pair) ? pair[1] : (pair as { 0: number; 1: string })[1]
      const marker = num === lineNo ? '  ←' : ''
      lines.push(`${num} | ${String(line)}${marker}`)
    }
    const header = `${file}:${lineNo}${frame.function ? ` (${frame.function})` : ''}\n`
    const block = header + lines.join('\n')
    return block.length > SOURCE_CONTEXT_MAX_CHARS ? block.slice(0, SOURCE_CONTEXT_MAX_CHARS - 3) + '...' : block
  }

  const hasContext =
    frame.context_line != null ||
    (frame.pre_context != null && frame.pre_context.length > 0) ||
    (frame.post_context != null && frame.post_context.length > 0)
  if (!hasContext) return null
  const lines: string[] = []
  if (frame.pre_context?.length) {
    const start = lineNo - frame.pre_context.length
    frame.pre_context.forEach((line, j) => lines.push(`${start + j} | ${line}`))
  }
  if (frame.context_line != null) lines.push(`${lineNo} | ${frame.context_line}  ←`)
  if (frame.post_context?.length) {
    frame.post_context.forEach((line, j) => lines.push(`${lineNo + 1 + j} | ${line}`))
  }
  const header = `${file}:${lineNo}${frame.function ? ` (${frame.function})` : ''}\n`
  const block = header + lines.join('\n')
  return block.length > SOURCE_CONTEXT_MAX_CHARS ? block.slice(0, SOURCE_CONTEXT_MAX_CHARS - 3) + '...' : block
}

/** Construit une ligne de fallback (fichier:ligne + fonction) quand Sentry n'envoie pas les lignes de code. */
function buildFallbackFrameLine(frame: SentryFrame): string | null {
  const lineNo = frame.lineno ?? frame.lineNo
  const file = frame.filename ?? frame.abs_path
  if (!file && lineNo == null) return null
  const loc = [file, lineNo != null ? String(lineNo) : null].filter(Boolean).join(':')
  const fn = frame.function ? ` (${frame.function})` : ''
  return `${loc}${fn}`.trim() || null
}

function extractSourceContextFromFrames(frames: Array<SentryFrame>): string | null {
  if (!frames?.length) return null
  let fallback: string | null = null
  let fallbackLineInApp: string | null = null
  let fallbackLineAny: string | null = null
  for (let i = frames.length - 1; i >= 0; i--) {
    const frame = frames[i]
    const block = buildContextBlock(frame)
    if (block) {
      if (frame.in_app === true) return block
      if (!fallback) fallback = block
    }
    const line = buildFallbackFrameLine(frame)
    if (line) {
      if (frame.in_app === true && !fallbackLineInApp) fallbackLineInApp = line
      if (!fallbackLineAny) fallbackLineAny = line
    }
  }
  if (fallback) return fallback
  const fallbackLine = fallbackLineInApp ?? fallbackLineAny
  if (fallbackLine) return `Stack (sans lignes de code) :\n${fallbackLine}`
  return null
}

/** Extrait le contexte source (lignes de code) du premier frame qui en dispose. Pour affichage dans le thread Discord. */
function extractSourceContextFromEvent(event: SentryEvent | null): string | null {
  if (!event) return null
  if (event.entries) {
    for (const entry of event.entries) {
      if (entry?.type !== 'exception' || !entry.data?.values) continue
      for (const ex of entry.data.values) {
        const ctx = extractSourceContextFromFrames(ex.stacktrace?.frames ?? [])
        if (ctx) return ctx
      }
    }
  }
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      const ctx = extractSourceContextFromFrames(ex.stacktrace?.frames ?? [])
      if (ctx) return ctx
    }
  }
  return null
}

/** Extrait le slug d'org Sentry depuis web_url (ex. https://adencore-tech.sentry.io/issues/123/ → adencore-tech). */
function extractSentryOrgFromWebUrl(webUrl?: string): string | null {
  if (!webUrl) return null
  try {
    const host = new URL(webUrl).hostname
    const match = host.match(/^([^.]+)\.sentry\.io$/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

/** Envoie un message avec boutons Résoudre / Ignorer dans le thread (via Bot). Les clics sont traités par discord-interactions. */
async function postDiscordActionButtons(threadId: string, orgSlug: string, issueId: string): Promise<boolean> {
  if (!DISCORD_BOT_TOKEN) return false
  const customIdPrefix = `sentry:`
  const resolveId = `${customIdPrefix}resolve:${orgSlug}:${issueId}`
  const ignoreId = `${customIdPrefix}ignore:${orgSlug}:${issueId}`
  const res = await fetch(`https://discord.com/api/v10/channels/${threadId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content: '**Actions**',
      components: [
        {
          type: 1,
          components: [
            { type: 2, style: 3, label: 'Résoudre', custom_id: resolveId },
            { type: 2, style: 4, label: 'Ignorer', custom_id: ignoreId },
          ],
        },
      ],
    }),
  })
  if (!res.ok) {
    console.error('[sentry-webhook] Discord bot post buttons failed:', res.status, await res.text())
    return false
  }
  return true
}

function embedColorForLevel(level?: string): number {
  switch (level?.toLowerCase()) {
    case 'fatal':
    case 'error':
      return 0xed4245 // rouge
    case 'warning':
      return 0xfeba4f // orange
    case 'info':
    case 'debug':
      return 0x5865f2 // blurple
    default:
      return 0x57628f // gris
  }
}

function formatShortDate(iso?: string): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

/** Tags affichés en priorité (même ordre que l’email Sentry). */
const TAGS_DISPLAY_ORDER = [
  'area', 'environment', 'level', 'browser', 'browser.name', 'device', 'device.family', 'os', 'os.name',
  'route', 'transaction', 'url', 'mechanism', 'handled', 'function',
]

type DiscordEmbedExtras = {
  sourceContext?: string | null
  exceptionSummary?: { type: string; value: string; atLine: string } | null
  requestUrl?: string | null
  userSummary?: string | null
}

/** Construit le body Discord : contenu court + embed détaillé (exception, request, user, tags, contexte code) + bouton Sentry. */
function buildDiscordPayload(
  issue: SentryIssue,
  action: string,
  sentryUrl: string,
  tags?: Record<string, string> | null,
  extras?: DiscordEmbedExtras | null
): { content: string; embeds: unknown[]; components: unknown[] } {
  const sourceContext = extras?.sourceContext ?? null
  const exceptionSummary = extras?.exceptionSummary ?? null
  const requestUrl = extras?.requestUrl ?? null
  const userSummary = extras?.userSummary ?? null
  const title = issue.metadata?.title ?? issue.title ?? 'Sentry issue'
  const lines: string[] = []

  if (exceptionSummary) {
    const excLine = `${exceptionSummary.type}: ${exceptionSummary.value}`
    lines.push(`**Exception**\n${excLine}`)
    if (exceptionSummary.atLine) lines.push(`  ${exceptionSummary.atLine}`)
    lines.push('')
  }
  if (requestUrl) {
    lines.push(`**Request**\nURL • ${requestUrl.slice(0, 400)}${requestUrl.length > 400 ? '…' : ''}`)
    lines.push('')
  }
  if (userSummary) {
    lines.push(`**User**\n${userSummary}`)
    lines.push('')
  }
  if (tags && Object.keys(tags).length > 0) {
    const ordered = TAGS_DISPLAY_ORDER.filter((k) => tags[k])
    const rest = Object.keys(tags).filter((k) => !TAGS_DISPLAY_ORDER.includes(k))
    const tagPairs = [...ordered, ...rest].slice(0, 24).map((k) => `${k} = ${tags[k]}`)
    lines.push(`**Tags**\n${tagPairs.join('  •  ')}`)
    lines.push('')
  }
  if (issue.culprit) lines.push(`**Lieu** : ${issue.culprit.slice(0, 200)}`)
  lines.push(`**Niveau** : ${issue.level ?? '—'} • **Statut** : ${issue.status ?? '—'}`)
  if (issue.count !== undefined || issue.userCount !== undefined) {
    lines.push(`**Occurrences** : ${issue.count ?? '—'} • **Utilisateurs** : ${issue.userCount ?? '—'}`)
  }
  if (issue.firstSeen || issue.lastSeen) {
    lines.push(`**Première vue** : ${formatShortDate(issue.firstSeen)} • **Dernière** : ${formatShortDate(issue.lastSeen)}`)
  }
  if (issue.project?.name) lines.push(`**Projet** : ${issue.project.name}`)
  if (issue.priority) lines.push(`**Priorité** : ${issue.priority}`)

  const embed: {
    title: string
    description: string
    url?: string
    color: number
    footer: { text: string }
    fields?: Array<{ name: string; value: string; inline?: boolean }>
  } = {
    title: title.slice(0, 256),
    description: lines.join('\n').slice(0, 4096),
    url: sentryUrl || undefined,
    color: embedColorForLevel(issue.level),
    footer: { text: `Issue ${issue.id ?? ''} • ${action}` },
  }

  const fields: Array<{ name: string; value: string; inline?: boolean }> = []
  if (sourceContext && sourceContext.trim().length > 0) {
    fields.push({
      name: 'Contexte code',
      value: `\`\`\`\n${sourceContext.trim().slice(0, 1008)}\n\`\`\``,
      inline: false,
    })
  }
  if (fields.length) embed.fields = fields

  const components = sentryUrl
    ? [
        {
          type: 1,
          components: [
            { type: 2, style: 5, label: 'Ouvrir dans Sentry', url: sentryUrl },
          ],
        },
      ]
    : []

  return {
    content: `${action} — ${title.slice(0, 100)}`,
    embeds: [embed],
    components,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ ok: true, message: 'sentry-webhook is running', ts: new Date().toISOString() }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  console.log('[sentry-webhook] POST received')
  let body: string
  try {
    body = await req.text()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const signature = req.headers.get('Sentry-Hook-Signature')
  const sigOk = await verifySignature(body, signature, SENTRY_WEBHOOK_SECRET)
  if (!sigOk) {
    console.error('[sentry-webhook] Invalid or missing signature (header present:', !!signature, ', secret set:', !!SENTRY_WEBHOOK_SECRET, ')')
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const payload = extractPayload(body)
  if (!payload?.data?.issue) {
    console.warn('[sentry-webhook] Payload missing data.issue, skipping')
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const sentryIssueId = String(payload.data.issue.id ?? '')
  console.log('[sentry-webhook] Received issue', sentryIssueId, 'action:', payload.action)

  if (!DISCORD_WEBHOOK_URL) {
    console.error('[sentry-webhook] DISCORD_WEBHOOK_URL not set')
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const issue = payload.data.issue
  const action = payload.action ?? 'updated'
  const title = issue.metadata?.title ?? issue.title ?? 'Sentry issue'
  const url = issue.web_url ?? ''

  const dedupKey = await sha256Hex(body)
  const isFirstEvent = await registerWebhookEvent(dedupKey)
  if (!isFirstEvent) {
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (rateLimit(sentryIssueId)) {
    console.warn('[sentry-webhook] Rate limit exceeded for issue', sentryIssueId)
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const existingThreadId = await getDiscordThreadId(sentryIssueId)

  if (!existingThreadId) {
    const orgSlug = extractSentryOrgFromWebUrl(url)
    const event = orgSlug ? await fetchLatestEvent(orgSlug, sentryIssueId) : null
    const tags = extractTagsFromEvent(event)
    const sourceContext = extractSourceContextFromEvent(event)
    const exceptionSummary = extractExceptionSummary(event)
    const requestUrl = extractRequestUrl(event, tags)
    const userSummary = extractUserSummary(event)
    const discordPayload = buildDiscordPayload(issue, action, url, tags, {
      sourceContext,
      exceptionSummary,
      requestUrl,
      userSummary,
    })
    const threadId = await createDiscordThread(DISCORD_WEBHOOK_URL, title.slice(0, 100), discordPayload)
    if (!threadId) {
      return new Response(JSON.stringify({ error: 'Discord thread creation failed' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    await upsertDiscordThreadMapping({
      sentryIssueId,
      discordThreadId: threadId,
      sentryIssueUrl: url || null,
      status: action === 'resolved' ? 'resolved' : 'open',
      updatedAt: new Date().toISOString(),
    })
    if (orgSlug) {
      await postDiscordActionButtons(threadId, orgSlug, sentryIssueId)
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const orgSlug = extractSentryOrgFromWebUrl(url)
  const event = orgSlug ? await fetchLatestEvent(orgSlug, sentryIssueId) : null
  const tags = extractTagsFromEvent(event)
  const sourceContext = extractSourceContextFromEvent(event)
  const exceptionSummary = extractExceptionSummary(event)
  const requestUrl = extractRequestUrl(event, tags)
  const userSummary = extractUserSummary(event)
  const updatePayload = buildDiscordPayload(issue, action, url, tags, {
    sourceContext,
    exceptionSummary,
    requestUrl,
    userSummary,
  })
  await postToDiscordThread(DISCORD_WEBHOOK_URL, existingThreadId, updatePayload)

  if (action === 'resolved' || action === 'unresolved') {
    await upsertDiscordThreadMapping({
      sentryIssueId,
      discordThreadId: existingThreadId,
      sentryIssueUrl: url || null,
      status: action === 'resolved' ? 'resolved' : 'open',
      updatedAt: new Date().toISOString(),
    })
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
