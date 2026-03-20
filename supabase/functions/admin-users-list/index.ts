import { requireAdmin } from "../_shared/admin.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const PER_PAGE = 50;

async function getRequestPayload(req: Request): Promise<{ page?: string; perPage?: string; search?: string }> {
  if (req.method !== "POST") return {};
  return await req.json().catch(() => ({})) as { page?: string; perPage?: string; search?: string };
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
    const { user: adminUser, serviceClient } = await requireAdmin(req);
    const url = new URL(req.url);
    const payload = await getRequestPayload(req);
    const page = Math.max(1, parseInt(payload.page ?? url.searchParams.get("page") ?? "1", 10));
    const perPage = Math.min(100, Math.max(1, parseInt(payload.perPage ?? url.searchParams.get("perPage") ?? String(PER_PAGE), 10)));
    const search = (payload.search ?? url.searchParams.get("search") ?? "").trim();
    const searchParam = search.length >= 2 ? search : null;
    const { data: users, error: listError } = await serviceClient.rpc("admin_list_users", {
      p_admin_user_id: adminUser.id,
      p_page: page,
      p_per_page: perPage,
      p_search: searchParam,
    });

    if (listError) {
      throw new Error(listError.message || "Failed to list users");
    }

    const { data: totalCount, error: countError } = await serviceClient.rpc("admin_count_users", {
      p_admin_user_id: adminUser.id,
      p_search: searchParam,
    });

    if (countError) {
      throw new Error(countError.message || "Failed to count users");
    }

    return new Response(
      JSON.stringify({
        users: users ?? [],
        total: Number(totalCount ?? 0),
        page,
        perPage,
      }),
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
