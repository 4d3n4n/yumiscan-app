import {
  DEFAULT_SCAN_BATCH_SIZE,
  MAX_SCAN_BATCH_SIZE,
  MIN_SCAN_BATCH_SIZE,
} from "../_shared/app-config.ts";
import { requireAdmin } from "../_shared/admin.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const COMPANY_CONFIG_KEYS = [
  "company_name",
  "legal_entity_name",
  "company_address",
  "company_country",
  "company_siret",
  "publication_director",
  "contact_page_path",
  "vat_number",
  "maintenance_mode_enabled",
  "scan_debug_enabled",
  "scan_ai_model",
  "scan_batch_size",
  "assistant_ai_model",
  "google_ocr_cost_eur_per_request",
  "scan_ai_cost_eur_per_request",
  "assistant_ai_cost_eur_per_request",
] as const;

type CompanyConfigKey = (typeof COMPANY_CONFIG_KEYS)[number];

function sanitizeValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function clampIntegerString(value: string, fallback: number, min: number, max: number): string {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return String(fallback);
  return String(Math.min(max, Math.max(min, parsed)));
}

function normalizeConfigValue(key: CompanyConfigKey, value: unknown): string {
  const sanitized = sanitizeValue(value);
  if (key === "maintenance_mode_enabled" || key === "scan_debug_enabled") {
    return sanitized.toLowerCase() === "true" ? "true" : "false";
  }
  if (key === "scan_batch_size") {
    return clampIntegerString(
      sanitized,
      DEFAULT_SCAN_BATCH_SIZE,
      MIN_SCAN_BATCH_SIZE,
      MAX_SCAN_BATCH_SIZE,
    );
  }

  return sanitized;
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

    if (req.method === "GET") {
      const { data, error } = await serviceClient
        .from("app_config")
        .select("key, value")
        .in("key", [...COMPANY_CONFIG_KEYS]);

      if (error) throw error;

      return new Response(JSON.stringify({ items: data ?? [] }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const payload = await req.json().catch(() => ({})) as Record<string, unknown>;
    const updates = Object.entries(payload)
      .filter(([key]) => COMPANY_CONFIG_KEYS.includes(key as CompanyConfigKey))
      .map(([key, value]) => ({
        key,
        value: normalizeConfigValue(key as CompanyConfigKey, value),
      }));

    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: "No valid config keys provided" }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const { error: upsertError } = await serviceClient
      .from("app_config")
      .upsert(updates, { onConflict: "key" });

    if (upsertError) throw upsertError;

    const { data, error } = await serviceClient
      .from("app_config")
      .select("key, value")
      .in("key", [...COMPANY_CONFIG_KEYS]);

    if (error) throw error;

    return new Response(JSON.stringify({ items: data ?? [] }), {
      headers: { ...cors, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    const status = message.includes("Forbidden") ? 403 : message.includes("token") || message.includes("auth") ? 401 : 500;
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...cors, "Content-Type": "application/json" },
      status,
    });
  }
});
