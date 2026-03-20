/**
 * Admin : envoie un email de réinitialisation mot de passe à un utilisateur.
 * Important : generateLink ne suffit pas, car il ne déclenche pas l'envoi de l'email.
 */
import { requireAdmin } from "../_shared/admin.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_PUBLISHABLE_KEY =
  Deno.env.get("PUBLISHABLE_KEY") ??
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("NUXT_PUBLIC_SUPABASE_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY") ??
  "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SECRET_KEY") ??
  Deno.env.get("SUPABASE_SECRET_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "";
const SITE_URL = (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");

type AdminSendPasswordResetBody = { user_id?: string; email?: string }

function getRecoveryApiKey() {
  return SUPABASE_PUBLISHABLE_KEY || SUPABASE_SERVICE_ROLE_KEY
}

function buildRecoveryRedirectTo() {
  if (!SITE_URL) {
    throw new Error("SITE_URL manquant: impossible de construire le lien de réinitialisation.");
  }

  // Le flow recovery front est traité sur /login.
  // Cette URL doit aussi exister dans Authentication > URL Configuration côté Supabase Cloud,
  // sinon Supabase retombe sur Site URL et l'utilisateur arrive sur la home.
  return `${SITE_URL}/login`
}

async function sendRecoveryEmail(email: string): Promise<void> {
  const apiKey = getRecoveryApiKey()
  if (!apiKey) {
    throw new Error("Clé Supabase manquante: impossible d'envoyer l'email de réinitialisation.");
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
    method: "POST",
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      redirect_to: buildRecoveryRedirectTo(),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || "Échec envoi email de récupération");
  }
}

function jsonResponse(
  cors: HeadersInit,
  body: Record<string, unknown>,
  status: number,
) {
  return new Response(JSON.stringify(body), {
    headers: { ...cors, "Content-Type": "application/json" },
    status,
  });
}

function getErrorStatus(message: string) {
  if (message.includes("Forbidden")) {
    return 403;
  }

  if (message.includes("token") || message.includes("auth")) {
    return 401;
  }

  return 500;
}

async function resolveTargetEmail(
  serviceClient: Awaited<ReturnType<typeof requireAdmin>>["serviceClient"],
  body: AdminSendPasswordResetBody,
) {
  const email = body.email?.trim();
  const userId = body.user_id?.trim();

  if (!email && !userId) {
    return { email: null, error: "user_id ou email requis", status: 400 };
  }

  if (email) {
    return { email, error: null, status: 200 };
  }

  const { data, error: emailLookupError } = await serviceClient.rpc("admin_get_user_email", {
    p_user_id: userId,
  });

  if (emailLookupError) {
    throw new Error(emailLookupError.message || "Impossible de retrouver l'email utilisateur");
  }

  const targetEmail = typeof data === "string" ? data.trim() : "";

  if (!targetEmail) {
    return { email: null, error: "Email introuvable pour cet utilisateur", status: 404 };
  }

  return { email: targetEmail, error: null, status: 200 };
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  if (req.method !== "POST") {
    return jsonResponse(cors, { error: "Method not allowed" }, 405);
  }
  try {
    const { serviceClient } = await requireAdmin(req);

    const body = await req.json().catch(() => ({})) as AdminSendPasswordResetBody;
    const target = await resolveTargetEmail(serviceClient, body);

    if (!target.email) {
      return jsonResponse(cors, { error: target.error }, target.status);
    }

    await sendRecoveryEmail(target.email);

    return jsonResponse(cors, {
      success: true,
      message: "Email de réinitialisation envoyé à l'utilisateur.",
      link: null,
    }, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return jsonResponse(cors, { error: message }, getErrorStatus(message));
  }
});
