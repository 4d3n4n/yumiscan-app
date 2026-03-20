import { getAuthUser, verifyUserPassword } from "../_shared/auth.ts";
import { deleteAccountDataOrThrow } from "../_shared/account-delete.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "DELETE") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { headers: { ...cors, "Content-Type": "application/json" }, status: 405 }
    );
  }

  try {
    const { user, supabase } = await getAuthUser(req);
    const userId = user.id;
    const body = await req.json().catch(() => ({})) as { current_password?: string };
    const currentPassword = body.current_password?.trim();

    if (!user.email) {
      throw new Error("Adresse email introuvable pour reverifier le compte.");
    }

    if (!currentPassword) {
      return new Response(
        JSON.stringify({ error: "Le mot de passe actuel est requis." }),
        { headers: { ...cors, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const isPasswordValid = await verifyUserPassword(user.email, currentPassword);
    if (!isPasswordValid) {
      return new Response(
        JSON.stringify({ error: "Le mot de passe actuel est incorrect." }),
        { headers: { ...cors, "Content-Type": "application/json" }, status: 403 }
      );
    }

    console.log(`[user-account-delete] Deleting account for user ${userId}`);
    await deleteAccountDataOrThrow(supabase, userId, "[user-account-delete]");

    console.log(`[user-account-delete] Account ${userId} fully deleted`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Compte supprimé définitivement.",
      }),
      { headers: { ...cors, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    const status = message.includes("token") || message.includes("auth")
      ? 401
      : 500;
    console.error("[user-account-delete] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...cors, "Content-Type": "application/json" }, status }
    );
  }
});
