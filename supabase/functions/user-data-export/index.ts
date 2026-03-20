import { getAuthUser } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getPaidCreditsRemaining, getPurchasedCreditsTotal } from "../_shared/purchased-credits.ts";

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const { user, supabase } = await getAuthUser(req);

    if (req.method === "GET") {
      const [profileRes, scansRes, allergensRes, paidCreditsPurchased] = await Promise.all([
        supabase
          .from("user_profiles")
          .select("*")
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("scans")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase.from("allergens").select("id, name, slug"),
        getPurchasedCreditsTotal(supabase, user.id),
      ]);

      const profile = profileRes.data;
      const scans = scansRes.data ?? [];
      const allergens = allergensRes.data ?? [];

      const selectedAllergenNames = (profile?.preferences ?? [])
        .map((id: string) => {
          const a = allergens.find((al: { id: string }) => al.id === id);
          return a ? a.name : id;
        });

      const exportData = {
        exported_at: new Date().toISOString(),
        user_id: user.id,
        email: user.email,
        profile: profile
          ? {
              first_name: profile.first_name,
              last_name: profile.last_name,
              selected_allergens: selectedAllergenNames,
              free_scans_used: profile.free_scans_used,
              paid_scans_used: profile.paid_scans_used,
              paid_credits_purchased: paidCreditsPurchased,
              paid_credits_remaining: getPaidCreditsRemaining(
                paidCreditsPurchased,
                profile.paid_scans_used ?? 0,
              ),
              created_at: profile.created_at,
              updated_at: profile.updated_at,
            }
          : null,
        scans: scans.map((s: Record<string, unknown>) => ({
          id: s.id,
          product_name: s.product_name,
          result_json: s.result_json,
          created_at: s.created_at,
          pipeline_version: s.pipeline_version,
        })),
        total_scans: scans.length,
      };

      return new Response(JSON.stringify(exportData, null, 2), {
        headers: {
          ...cors,
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="yumiscan-data-${new Date().toISOString().slice(0, 10)}.json"`,
        },
        status: 200,
      });
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { headers: { ...cors, "Content-Type": "application/json" }, status: 405 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    const status = message.includes("token") || message.includes("auth")
      ? 401
      : 500;
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...cors, "Content-Type": "application/json" }, status }
    );
  }
});
