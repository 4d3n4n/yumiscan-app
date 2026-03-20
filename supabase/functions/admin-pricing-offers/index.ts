import { requireAdmin } from "../_shared/admin.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  normalizeDiscountPriceCents,
  normalizeStripePriceId,
  parsePositiveInteger,
  parseEuroStringToCents,
  sanitizeText,
} from "../../../utils/pricing-offers.ts";

type PricingOfferPayload = {
  code?: string
  title?: string
  credits?: string | number
  full_price?: string | number
  discount_price?: string | number
  stripe_price_id_full?: string
  stripe_price_id_discount?: string
  active?: boolean
}

function normalizeOffer(payload: PricingOfferPayload) {
  const code = sanitizeText(payload.code)
  const title = sanitizeText(payload.title)
  const credits = parsePositiveInteger(payload.credits)
  const fullPriceCents = parseEuroStringToCents(payload.full_price)
  const discountPriceCents = normalizeDiscountPriceCents(payload.discount_price)
  const stripePriceIdFull = normalizeStripePriceId(payload.stripe_price_id_full)
  const stripePriceIdDiscount = normalizeStripePriceId(payload.stripe_price_id_discount)
  const active = payload.active === true

  if (!code) throw new Error("Offer code is required")
  if (!/^[a-z0-9_]+$/.test(code)) throw new Error(`Invalid offer code: ${code}`)
  if (!title) throw new Error(`Missing title for offer ${code}`)
  if (credits == null) throw new Error(`Invalid credits for offer ${code}`)
  if (fullPriceCents == null || fullPriceCents <= 0) throw new Error(`Invalid full price for offer ${code}`)
  if (!stripePriceIdFull?.startsWith("price_")) throw new Error(`Invalid full Stripe price ID for offer ${code}`)

  if (discountPriceCents != null) {
    if (discountPriceCents >= fullPriceCents) {
      throw new Error(`Discount price must be lower than full price for offer ${code}`)
    }
    if (!stripePriceIdDiscount?.startsWith("price_")) {
      throw new Error(`Discount Stripe price ID is required for offer ${code}`)
    }
  }

  return {
    code,
    title,
    credits,
    full_price_cents: fullPriceCents,
    discount_price_cents: discountPriceCents,
    stripe_price_id_full: stripePriceIdFull,
    stripe_price_id_discount: discountPriceCents == null ? null : stripePriceIdDiscount,
    active,
    updated_at: new Date().toISOString(),
  }
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req)

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors })
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...cors, "Content-Type": "application/json" },
      status: 405,
    })
  }

  try {
    const { serviceClient } = await requireAdmin(req)

    if (req.method === "GET") {
      const { data, error } = await serviceClient
        .from("pricing_offers")
        .select("id, code, title, credits, full_price_cents, discount_price_cents, stripe_price_id_full, stripe_price_id_discount, active, created_at, updated_at")
        .order("credits", { ascending: true })

      if (error) throw error

      return new Response(JSON.stringify({ items: data ?? [] }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 200,
      })
    }

    const payload = await req.json().catch(() => ({})) as { offers?: PricingOfferPayload[] }
    const offers = Array.isArray(payload.offers) ? payload.offers : []
    if (offers.length === 0) {
      return new Response(JSON.stringify({ error: "No pricing offers provided" }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 400,
      })
    }

    const normalizedOffers = offers.map(normalizeOffer)

    const { error: upsertError } = await serviceClient
      .from("pricing_offers")
      .upsert(normalizedOffers, { onConflict: "code" })

    if (upsertError) throw upsertError

    const { data, error } = await serviceClient
      .from("pricing_offers")
      .select("id, code, title, credits, full_price_cents, discount_price_cents, stripe_price_id_full, stripe_price_id_discount, active, created_at, updated_at")
      .order("credits", { ascending: true })

    if (error) throw error

    return new Response(JSON.stringify({ items: data ?? [] }), {
      headers: { ...cors, "Content-Type": "application/json" },
      status: 200,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur"
    const status = message.includes("Forbidden") ? 403 : message.includes("Invalid") || message.includes("required") || message.includes("No pricing offers") ? 400 : message.includes("token") || message.includes("auth") ? 401 : 500
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...cors, "Content-Type": "application/json" },
      status,
    })
  }
})
