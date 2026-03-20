import { getAuthUser } from "../_shared/auth.ts";
import { removeStorageFilesUnderPrefix } from "../_shared/storage-prefix-cleanup.ts";

function getCorsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("origin");
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "http://127.0.0.1:54321";
  const allowedOrigins: string[] = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:3003",
    supabaseUrl,
  ];
  let siteUrl = (Deno.env.get("SITE_URL") ?? "").trim();
  if (siteUrl.endsWith("/")) siteUrl = siteUrl.slice(0, -1);
  if (siteUrl && !allowedOrigins.includes(siteUrl)) allowedOrigins.push(siteUrl);
  const extraOrigins = Deno.env.get("ALLOWED_ORIGINS");
  if (extraOrigins) {
    extraOrigins.split(",").map((o) => o.trim()).filter(Boolean).forEach((o) => {
      if (!allowedOrigins.includes(o)) allowedOrigins.push(o);
    });
  }
  const allowOrigin =
    origin && allowedOrigins.includes(origin) ? origin : null;
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (allowOrigin) {
    headers["Access-Control-Allow-Origin"] = allowOrigin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  return headers;
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { headers: { ...cors, "Content-Type": "application/json" }, status: 405 }
    );
  }

  try {
    const { user, supabase } = await getAuthUser(req);
    let body: { scanId?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Body JSON invalide" }),
        { headers: { ...cors, "Content-Type": "application/json" }, status: 400 }
      );
    }
    const scanId = body?.scanId;
    if (!scanId || typeof scanId !== "string") {
      return new Response(
        JSON.stringify({ error: "scanId requis" }),
        { headers: { ...cors, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { data: scan, error: fetchError } = await supabase
      .from("scans")
      .select("id, user_id, image_storage_path")
      .eq("id", scanId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !scan) {
      return new Response(
        JSON.stringify({ error: "Scan introuvable ou accès refusé" }),
        { headers: { ...cors, "Content-Type": "application/json" }, status: 404 }
      );
    }

    const path = scan.image_storage_path as string | null | undefined;
    if (path && path.trim() !== "") {
      const { error: storageError } = await supabase.storage
        .from("scan-images")
        .remove([path]);
      if (storageError) {
        console.error("[scan-delete] Storage error:", storageError);
        throw new Error("Échec de la suppression de l'image du scan.");
      }
    }

    try {
      await removeStorageFilesUnderPrefix(
        supabase.storage,
        "assistant-audio",
        `${user.id}/${scanId}`,
      );
    } catch (audioPrefixError) {
      console.error("[scan-delete] Assistant audio prefix cleanup error:", audioPrefixError);
      throw new Error("Échec de la suppression des audios Assistant IA.");
    }

    const { error: deleteError } = await supabase
      .from("scans")
      .delete()
      .eq("id", scanId)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("[scan-delete] DB delete error:", deleteError);
      throw new Error("Échec de la suppression du scan.");
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...cors, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    const status =
      message.includes("token") || message.includes("auth") ? 401 : 500;
    console.error("[scan-delete] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...cors, "Content-Type": "application/json" }, status }
    );
  }
});
