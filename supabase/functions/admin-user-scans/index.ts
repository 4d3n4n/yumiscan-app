/**
 * Admin : liste les scans d'un utilisateur cible (query user_id).
 * Retourne la même structure que le dashboard (id, created_at, product_status, etc.).
 */
import { requireAdmin } from "../_shared/admin.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

async function getRequestPayload(req: Request): Promise<{ user_id?: string }> {
  if (req.method !== "POST") return {};
  return await req.json().catch(() => ({})) as { user_id?: string };
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
    const { serviceClient } = await requireAdmin(req);

    const url = new URL(req.url);
    const payload = await getRequestPayload(req);
    const userId = (payload.user_id ?? url.searchParams.get("user_id") ?? "").trim();
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "user_id requis" }),
        { headers: { ...cors, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { data: scans, error } = await serviceClient
      .from("scans")
      .select("id, created_at, product_status, result_json, certified_raw_text, credit_consumed_type, image_storage_path")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message || "Erreur lecture scans");

    const scansWithSignedUrls = await Promise.all(
      (scans ?? []).map(async (scan) => {
        const path = scan.image_storage_path;
        if (!path) {
          return { ...scan, signed_image_url: null };
        }

        try {
          const { data: signed, error: signedError } = await serviceClient.storage
            .from("scan-images")
            .createSignedUrl(path, 3600, {
              transform: { width: 100, height: 100, resize: "cover" },
            });

          if (signedError || !signed?.signedUrl) {
            return { ...scan, signed_image_url: null };
          }

          return { ...scan, signed_image_url: signed.signedUrl };
        } catch {
          return { ...scan, signed_image_url: null };
        }
      }),
    );

    return new Response(
      JSON.stringify({ scans: scansWithSignedUrls }),
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
