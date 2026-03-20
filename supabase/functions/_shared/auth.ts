import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { getPaidCreditsRemaining, getPurchasedCreditsTotal } from "./purchased-credits.ts";

function getSupabaseCredentials() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey =
    Deno.env.get("PUBLISHABLE_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
    Deno.env.get("NUXT_PUBLIC_SUPABASE_KEY") ??
    Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceKey =
    Deno.env.get("SECRET_KEY") ??
    Deno.env.get("SUPABASE_SECRET_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    throw new Error("Server configuration error: missing Supabase credentials");
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceKey,
  };
}

export async function getAuthUser(req: Request) {
  let authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");

  if (!authHeader) {
    throw new Error("Missing Authorization header");
  }

  const { supabaseUrl, supabaseAnonKey, supabaseServiceKey } = getSupabaseCredentials();

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    throw new Error("Missing Bearer token");
  }

  let authUser: { id: string; email?: string | null } | null = null;

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user: authUserRecord },
    error,
  } = await authClient.auth.getUser(token);
  if (error || !authUserRecord) {
    throw new Error("Invalid or expired token");
  }
  authUser = { id: authUserRecord.id, email: authUserRecord.email ?? undefined };

  const user = {
    id: authUser.id,
    email: authUser.email ?? undefined,
  };

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return { user, supabase: serviceClient };
}

export async function verifyUserPassword(email: string, password: string): Promise<boolean> {
  const normalizedEmail = email.trim();
  const normalizedPassword = password.trim();
  if (!normalizedEmail || !normalizedPassword) {
    return false;
  }

  const { supabaseUrl, supabaseAnonKey } = getSupabaseCredentials();

  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({
      email: normalizedEmail,
      password: normalizedPassword,
    }),
  }).catch(() => null);

  return !!response?.ok;
}

async function getFreeScansCount(
  supabase: { from: (table: string) => any }
): Promise<number> {
  const { data } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "free_scans_count")
    .single();
  return data?.value ? parseInt(data.value, 10) : 3;
}

/**
 * Vérifie qu'il reste au moins 1 crédit (gratuit, journalier ou payant).
 * Priorité métier: journalier → gratuits inscription → payants.
 * Ici on vérifie seulement la disponibilité globale, pas l'ordre exact de consommation.
 */
export async function requireScanCredits(
  supabase: { from: (table: string) => any },
  user_id: string
): Promise<void> {
  const [freeAllowed, profile] = await Promise.all([
    getFreeScansCount(supabase),
    supabase
      .from("user_profiles")
      .select("free_scans_used, paid_scans_used, daily_credit_used_at")
      .eq("user_id", user_id)
      .single()
      .then((r: { data: any; error: any }) => r.data),
  ]);

  if (!profile) {
    throw new Error("Profil utilisateur introuvable");
  }

  const freeUsed = profile.free_scans_used ?? 0;
  const paidUsed = profile.paid_scans_used ?? 0;
  const paidCreditsPurchased = await getPurchasedCreditsTotal(supabase, user_id);
  const paidRemaining = getPaidCreditsRemaining(paidCreditsPurchased, paidUsed);

  // 1. Free credits remaining
  if (freeUsed < freeAllowed) return;

  // 2. Daily credit available (NULL or past date = available)
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const dailyUsedAt = profile.daily_credit_used_at;
  if (!dailyUsedAt || dailyUsedAt < today) return;

  // 3. Paid credits remaining
  if (paidRemaining > 0) return;

  throw new Error("Aucun crédit scan disponible. Achetez des crédits sur la page Tarifs.");
}
