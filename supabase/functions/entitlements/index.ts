import { getAuthUser } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Log immédiat pour confirmer que l'Edge Function s'exécute
  const authHeader = req.headers.get("Authorization");
  const apikeyHeader = req.headers.get("apikey");

  console.log("[entitlements] Edge Function called:", {
    method: req.method,
    url: req.url,
    origin: req.headers.get("origin"),
    hasAuthHeader: !!authHeader,
    hasApikey: !!apikeyHeader,
  });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("[entitlements] Attempting to authenticate user...");
    await getAuthUser(req);
    console.log("[entitlements] User authenticated successfully.");

    // Pas de pass/abonnement : les scans gratuits sont gérés par app_config (free_scans_count).
    // On retourne toujours "aucun pass actif" pour garder le contrat API attendu par la page Compte.
    return new Response(
      JSON.stringify({
        isActive: false,
        endsAt: null,
        status: null,
        plan: null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: error.message.includes("token") ? 401 : 500,
      }
    );
  }
});
