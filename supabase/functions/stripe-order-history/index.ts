import { getAuthUser } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface PurchaseRow {
  id: string;
  user_id: string;
  stripe_session_id: string;
  plan: string;
  credits_added: number;
  amount_cents: number | null;
  created_at: string;
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...cors, "Content-Type": "application/json" },
      status: 405,
    });
  }

  try {
    const { user, supabase: _ } = await getAuthUser(req);
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: purchases, error: fetchError } = await serviceClient
      .from("user_purchases")
      .select("id, stripe_session_id, plan, credits_added, amount_cents, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (fetchError) {
      throw fetchError;
    }

    const list = (purchases ?? []) as PurchaseRow[];
    const result: Array<{
      id: string;
      created_at: string;
      plan: string;
      credits_added: number;
      amount_cents: number | null;
      receipt_url: string | null;
    }> = [];

    if (STRIPE_SECRET && list.length > 0) {
      for (const p of list) {
        let receipt_url: string | null = null;
        try {
          const res = await fetch(
            `https://api.stripe.com/v1/checkout/sessions/${p.stripe_session_id}?expand[]=payment_intent&expand[]=payment_intent.latest_charge`,
            {
              headers: {
                Authorization: `Bearer ${STRIPE_SECRET}`,
                "Stripe-Version": "2026-02-25.clover",
              },
            }
          );
          const session = await res.json();
          const charge =
            session.payment_intent && typeof session.payment_intent === "object"
              ? session.payment_intent.latest_charge
              : null;
          if (charge && typeof charge === "object" && charge.receipt_url) {
            receipt_url = charge.receipt_url;
          }
        } catch {
          // ignore per-purchase errors
        }
        result.push({
          id: p.id,
          created_at: p.created_at,
          plan: p.plan,
          credits_added: p.credits_added,
          amount_cents: p.amount_cents,
          receipt_url,
        });
      }
    } else {
      result.push(
        ...list.map((p) => ({
          id: p.id,
          created_at: p.created_at,
          plan: p.plan,
          credits_added: p.credits_added,
          amount_cents: p.amount_cents,
          receipt_url: null as string | null,
        }))
      );
    }

    return new Response(JSON.stringify({ orders: result }), {
      headers: { ...cors, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    const status =
      message.includes("token") || message.includes("auth") ? 401 : 500;
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...cors, "Content-Type": "application/json" },
      status,
    });
  }
});
