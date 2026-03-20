/**
 * Vérifie que l'appelant est admin (user_profiles.is_admin = true).
 * À utiliser en début de chaque Edge Function admin.
 */
import { getAuthUser } from "./auth.ts";

export async function requireAdmin(req: Request): Promise<{
  user: { id: string; email?: string };
  serviceClient: import("https://esm.sh/@supabase/supabase-js@2.39.0").SupabaseClient;
}> {
  const { user, supabase: serviceClient } = await getAuthUser(req);
  const { data } = await serviceClient
    .from("user_profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .single() as { data: { is_admin: boolean } | null };

  if (data?.is_admin !== true) {
    throw new Error("Forbidden: admin only");
  }
  return { user, serviceClient };
}
