import { corsHeaders } from "../_shared/cors.ts";
import { getAuthUser } from "../_shared/auth.ts";
import { getCheckoutPriceId, sanitizeText } from "../../../utils/pricing-offers.ts";

const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET")!;
// Base URL pour success/cancel : origine uniquement (ex. http://localhost:3000). SITE_URL sans slash final.
function getBaseUrl(): string {
  let raw = (Deno.env.get("SITE_URL") || (Deno.env.get("SUPABASE_URL") || "").replace(/\/rest\/v1$|\/v1$/, "") || "").trim();
  if (raw.endsWith("/")) raw = raw.slice(0, -1);
  if (!raw) return "";
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`;
  } catch {
    return raw;
  }
}
const BASE_URL = getBaseUrl();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user, supabase } = await getAuthUser(req);

    const payload = await req.json().catch(() => ({})) as { plan?: string; code?: string };
    const offerCode = sanitizeText(payload.code ?? payload.plan);

    if (!offerCode) {
      throw new Error("Invalid pricing offer");
    }

    const { data: offer, error: offerError } = await supabase
      .from("pricing_offers")
      .select("code, title, credits, full_price_cents, discount_price_cents, stripe_price_id_full, stripe_price_id_discount, active")
      .eq("code", offerCode)
      .maybeSingle();

    if (offerError) {
      throw offerError;
    }

    if (!offer || offer.active !== true) {
      throw new Error("Pricing offer not available");
    }

    const priceId = getCheckoutPriceId(offer);
    if (!priceId) {
      throw new Error("Stripe price ID not configured");
    }

    if (!BASE_URL) {
      throw new Error("SITE_URL or SUPABASE_URL must be set (ex: SITE_URL=http://localhost:3000)");
    }

    // Stripe Embedded Checkout : ui_mode=embedded + return_url (paiement sur la même page)
    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("ui_mode", "embedded");
    params.set("return_url", `${BASE_URL}/app/account?session_id={CHECKOUT_SESSION_ID}`);
    params.set("line_items[0][price]", priceId);
    params.set("line_items[0][quantity]", "1");
    params.set("billing_address_collection", "required");
    params.set("client_reference_id", user.id);
    params.set("metadata[plan]", offer.code);
    params.set("metadata[pricing_offer_code]", offer.code);
    params.set("metadata[credits]", String(offer.credits));
    params.set("metadata[user_id]", user.id);

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_SECRET}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Version": "2026-02-25.clover",
      },
      body: params.toString(),
    });

    const session = await response.json();

    if (!response.ok) {
      const stripeMsg = session.error?.message || session.error?.code || "Stripe API error";
      throw new Error(stripeMsg);
    }

    return new Response(
      JSON.stringify({ clientSecret: session.client_secret }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("token") ? 401 : 400;
    return new Response(
      JSON.stringify({ error: message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status,
      }
    );
  }
});
