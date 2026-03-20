// @deno-types="https://esm.sh/stripe@14?target=denonext"
import Stripe from "https://esm.sh/stripe@14?target=denonext";
import { sanitizeText } from "../../../utils/pricing-offers.ts";

const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET");

export type PricingOffer = {
  code: string;
  title: string;
  credits: number;
  stripe_price_id_full: string | null;
  stripe_price_id_discount: string | null;
};

export type SessionPayload = {
  id: string;
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
  amount_total?: number | null;
};

export type CheckoutFinalizeStatus =
  | "processed_now"
  | "already_processed"
  | "not_ready"
  | "forbidden"
  | "invalid_session";

function createStripeClient() {
  if (!STRIPE_SECRET) return null;
  return new Stripe(STRIPE_SECRET, { apiVersion: "2024-09-30.acacia" });
}

export async function findPricingOfferByCode(
  supabase: { from: (table: string) => any },
  code: string | null | undefined,
): Promise<PricingOffer | null> {
  const normalized = sanitizeText(code);
  if (!normalized) return null;

  const { data, error } = await supabase
    .from("pricing_offers")
    .select("code, title, credits, stripe_price_id_full, stripe_price_id_discount")
    .eq("code", normalized)
    .maybeSingle();

  if (error) {
    console.error("[stripe] pricing offer lookup by code failed:", error.message);
    return null;
  }

  return (data as PricingOffer | null) ?? null;
}

export async function findPricingOfferByPriceId(
  supabase: { from: (table: string) => any },
  priceId: string | undefined,
): Promise<PricingOffer | null> {
  const normalized = sanitizeText(priceId);
  if (!normalized) return null;

  const { data, error } = await supabase
    .from("pricing_offers")
    .select("code, title, credits, stripe_price_id_full, stripe_price_id_discount")
    .or(`stripe_price_id_full.eq.${normalized},stripe_price_id_discount.eq.${normalized}`)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[stripe] pricing offer lookup by price id failed:", error.message);
    return null;
  }

  return (data as PricingOffer | null) ?? null;
}

export async function retrieveCheckoutSession(sessionId: string): Promise<{
  sessionId: string;
  user_id: string | null;
  pricing_offer_code: string | null;
  price_id: string | null;
  amount_total: number | null;
  payment_status: string | null;
} | null> {
  const stripe = createStripeClient();
  if (!stripe) return null;

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items", "line_items.data.price"],
    }) as {
      id: string;
      metadata?: Record<string, string> | null;
      client_reference_id?: string | null;
      amount_total?: number | null;
      payment_status?: string | null;
      line_items?: { data?: Array<{ price?: { id?: string } }> };
    };

    const metadata = session.metadata ?? {};
    return {
      sessionId: session.id,
      user_id: metadata.user_id ?? session.client_reference_id ?? null,
      pricing_offer_code: metadata.pricing_offer_code ?? metadata.plan ?? null,
      price_id: session.line_items?.data?.[0]?.price?.id ?? null,
      amount_total: session.amount_total ?? null,
      payment_status: session.payment_status ?? null,
    };
  } catch (error) {
    console.error("[stripe] retrieve session error:", error);
    return null;
  }
}

export async function resolveCheckoutSessionPayload(
  supabase: { from: (table: string) => any },
  session: SessionPayload,
): Promise<{ user_id: string; offer: PricingOffer; amountTotal: number | null } | null> {
  let user_id = (session.metadata?.user_id ?? session.client_reference_id) as string | undefined;
  let offer = await findPricingOfferByCode(supabase, session.metadata?.pricing_offer_code ?? session.metadata?.plan);
  let amountTotal = session.amount_total ?? null;

  if (!user_id || !offer) {
    const retrieved = await retrieveCheckoutSession(session.id);
    if (retrieved) {
      user_id = retrieved.user_id ?? undefined;
      offer = await findPricingOfferByCode(supabase, retrieved.pricing_offer_code)
        ?? await findPricingOfferByPriceId(supabase, retrieved.price_id ?? undefined);
      if (retrieved.amount_total != null) amountTotal = retrieved.amount_total;
    }
  }

  if (!user_id || !offer) {
    return null;
  }

  return { user_id, offer, amountTotal };
}

export async function creditAndRecordPurchase(
  supabase: { from: (table: string) => any },
  sessionId: string,
  user_id: string,
  offer: PricingOffer,
  amountTotal: number | null,
): Promise<{
  status: Extract<CheckoutFinalizeStatus, "processed_now" | "already_processed">
  purchaseId?: string
  creditsAdded?: number
}> {
  const { data: existing } = await supabase
    .from("user_purchases")
    .select("id, credits_added")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();

  if (existing?.id) {
    return {
      status: "already_processed",
      purchaseId: existing.id as string,
      creditsAdded: Number(existing.credits_added ?? 0),
    };
  }

  const creditsToAdd = offer.credits;
  const { data: purchaseRow, error: insertPurchaseError } = await supabase
    .from("user_purchases")
    .insert({ user_id, stripe_session_id: sessionId, plan: offer.code, credits_added: creditsToAdd, amount_cents: amountTotal })
    .select("id, credits_added")
    .single();

  if (insertPurchaseError) {
    if (insertPurchaseError.code === "23505") {
      const { data: duplicated } = await supabase
        .from("user_purchases")
        .select("id, credits_added")
        .eq("stripe_session_id", sessionId)
        .maybeSingle();

      if (duplicated?.id) {
        return {
          status: "already_processed",
          purchaseId: duplicated.id as string,
          creditsAdded: Number(duplicated.credits_added ?? 0),
        };
      }
    }

    throw new Error(`user_purchases insert failed: ${insertPurchaseError.message}`);
  }

  return {
    status: "processed_now",
    purchaseId: purchaseRow?.id as string | undefined,
    creditsAdded: Number(purchaseRow?.credits_added ?? creditsToAdd),
  };
}
