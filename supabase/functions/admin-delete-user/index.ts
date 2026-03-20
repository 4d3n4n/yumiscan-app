/**
 * Admin : supprime un utilisateur cible (target_user_id).
 * Même logique que user-account-delete mais pour un user_id passé en body.
 * Exclut l'admin connecté (interdit de se supprimer soi-même).
 */
import { requireAdmin } from "../_shared/admin.ts";
import { deleteAccountDataOrThrow } from "../_shared/account-delete.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...cors, "Content-Type": "application/json" },
      status: 405,
    });
  }
  try {
    const { user: adminUser, serviceClient } = await requireAdmin(req);

    const body = await req.json().catch(() => ({})) as { target_user_id?: string };
    const targetUserId = body.target_user_id?.trim();

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: "target_user_id requis" }),
        { headers: { ...cors, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (targetUserId === adminUser.id) {
      return new Response(
        JSON.stringify({ error: "Vous ne pouvez pas supprimer votre propre compte depuis le back-office." }),
        { headers: { ...cors, "Content-Type": "application/json" }, status: 403 }
      );
    }

    await deleteAccountDataOrThrow(serviceClient, targetUserId, "[admin-delete-user]");

    return new Response(
      JSON.stringify({ success: true, message: "Utilisateur supprimé." }),
      { headers: { ...cors, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    const status = message.includes("Forbidden") ? 403 : message.includes("token") || message.includes("auth") ? 401 : 500;
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...cors, "Content-Type": "application/json" },
      status,
    });
  }
});
