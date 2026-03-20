export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * CORS dynamique pour les appels depuis le navigateur (credentials).
 * Utilise SITE_URL et ALLOWED_ORIGINS (secrets Edge Functions) pour autoriser
 * l'origine de prod (ex. https://yumiscan.com).
 */
export function getCorsHeaders(req: Request): HeadersInit {
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
  const allowOrigin = origin && allowedOrigins.includes(origin)
    ? origin
    : null;
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  };
  if (allowOrigin) {
    headers["Access-Control-Allow-Origin"] = allowOrigin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  return headers;
}
