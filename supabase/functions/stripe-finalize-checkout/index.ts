import { getCorsHeaders } from "../_shared/cors.ts";
import { getAuthUser } from "../_shared/auth.ts";
import {
  creditAndRecordPurchase,
  findPricingOfferByCode,
  findPricingOfferByPriceId,
  retrieveCheckoutSession,
  type CheckoutFinalizeStatus,
} from "../_shared/stripe-checkout.ts";

function jsonResponse(body: Record<string, unknown>, status: number, cors: HeadersInit) {
  return new Response(JSON.stringify(body), {
    headers: { ...cors, "Content-Type": "application/json" },
    status,
  });
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, cors);
  }

  try {
    const { user, supabase } = await getAuthUser(req);
    const payload = await req.json().catch(() => ({})) as { session_id?: string };
    const sessionId = typeof payload.session_id === "string" ? payload.session_id.trim() : "";

    if (!sessionId) {
      return jsonResponse({ error: "Invalid session_id", status: "invalid_session" satisfies CheckoutFinalizeStatus }, 400, cors);
    }

    const session = await retrieveCheckoutSession(sessionId);
    if (!session || session.sessionId !== sessionId) {
      return jsonResponse({ error: "Invalid Stripe session", status: "invalid_session" satisfies CheckoutFinalizeStatus }, 400, cors);
    }

    if (session.payment_status !== "paid") {
      return jsonResponse({ status: "not_ready" satisfies CheckoutFinalizeStatus }, 200, cors);
    }

    const sessionUserId = session.user_id?.trim() ?? "";
    if (!sessionUserId || sessionUserId !== user.id) {
      return jsonResponse({ error: "Forbidden", status: "forbidden" satisfies CheckoutFinalizeStatus }, 403, cors);
    }

    const offer = await findPricingOfferByCode(supabase, session.pricing_offer_code)
      ?? await findPricingOfferByPriceId(supabase, session.price_id ?? undefined);

    if (!offer) {
      return jsonResponse({ status: "not_ready" satisfies CheckoutFinalizeStatus }, 200, cors);
    }

    const result = await creditAndRecordPurchase(
      supabase,
      sessionId,
      user.id,
      offer,
      session.amount_total,
    );

    return jsonResponse({
      status: result.status,
      purchase_id: result.purchaseId ?? null,
      credits_added: result.creditsAdded ?? null,
    }, 200, cors);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    const status = /authorization|token/i.test(message) ? 401 : 500;
    return jsonResponse({ error: message }, status, cors);
  }
});
