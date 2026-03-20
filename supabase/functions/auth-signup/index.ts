import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });
  }

  return new Response(
    JSON.stringify({
      error: "Deprecated endpoint. Public signup must use Supabase Auth signUp().",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 410 }
  );
});
