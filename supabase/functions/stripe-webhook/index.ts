/// <reference path="./stripe.d.ts" />
/**
 * Webhook Stripe : reçoit checkout.session.completed et inscrit l'achat dans user_purchases.
 * En local : lancer `stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook`
 * et définir STRIPE_WEBHOOK_SECRET avec le whsec_... affiché par la CLI. Sans cela, Stripe n'envoie pas les événements à localhost.
 *
 * En prod : STRIPE_WEBHOOK_SECRET doit être le "Signing secret" (whsec_...) de l'endpoint configuré dans
 * Stripe Dashboard → Developers → Webhooks, pour le même mode (Test ou Live) que les paiements.
 *
 * Robustesse : si metadata (user_id / pricing_offer_code) est vide dans l’événement (connu avec Stripe),
 * on récupère la session via l’API Stripe et on résout l’offre via pricing_offers et le price_id de line_items si besoin.
 * Idempotence : si un user_purchase existe déjà pour cette session, on ne refait pas le traitement.
 */
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
// @deno-types="https://esm.sh/stripe@14?target=denonext"
import Stripe from "https://esm.sh/stripe@14?target=denonext";
import {
  creditAndRecordPurchase,
  resolveCheckoutSessionPayload,
  type SessionPayload,
} from "../_shared/stripe-checkout.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET");
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function okResponse() {
  return new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
}

function jsonError(message: string, status: number, extra?: Record<string, string>) {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

/** Traite l'événement checkout.session.completed. */
async function handleCheckoutCompleted(event: { data: { object: Record<string, unknown> } }): Promise<Response> {
  const session = event.data.object as SessionPayload;
  const resolved = await resolveCheckoutSessionPayload(supabase, session);
  if (!resolved) {
    console.error("[stripe-webhook] checkout.session.completed: missing or invalid user_id/pricing offer", {
      user_id: session.metadata?.user_id ?? session.client_reference_id,
      pricing_offer_code: session.metadata?.pricing_offer_code ?? session.metadata?.plan,
    });
    return okResponse();
  }
  try {
    await creditAndRecordPurchase(supabase, session.id, resolved.user_id, resolved.offer, resolved.amountTotal);
    return okResponse();
  } catch (err) {
    console.error("[stripe-webhook] checkout.session.completed processing error:", err);
    return jsonError("processing error", 500, { detail: err instanceof Error ? err.message : String(err) });
  }
}

/** Vérifie la signature Stripe et retourne l'événement ou une Response d'erreur. */
async function verifyAndParseEvent(
  body: string,
  signature: string,
): Promise<{ ok: true; event: { type: string; data: { object: Record<string, unknown> } } } | { ok: false; response: Response }> {
  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET")!, { apiVersion: "2024-09-30.acacia" });
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      STRIPE_WEBHOOK_SECRET!,
      undefined,
      cryptoProvider,
    ) as { type: string; data: { object: Record<string, unknown> } };
    return { ok: true, event };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[stripe-webhook] signature verification failed:", detail);
    return { ok: false, response: jsonError("Webhook signature verification failed", 400) };
  }
}

/** Gère une requête POST webhook. */
async function handlePost(req: Request): Promise<Response> {
  const signature = req.headers.get("Stripe-Signature");
  if (!signature) return jsonError("Missing Stripe-Signature", 400);
  if (!STRIPE_WEBHOOK_SECRET) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set");
    return jsonError("Server configuration error", 500);
  }
  let body: string;
  try {
    body = await req.text();
  } catch {
    return jsonError("Invalid body", 400);
  }

  const parsed = await verifyAndParseEvent(body, signature);
  if (!parsed.ok) return parsed.response;

  const { event } = parsed;
  if (event.type === "checkout.session.expired") return okResponse();
  if (event.type === "checkout.session.completed") return handleCheckoutCompleted(event);
  return okResponse();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Allow": "POST" },
      status: 405,
    });
  }
  return handlePost(req);
});
