export const DEFAULT_SCAN_AI_MODEL = "gemini-2.5-flash";
export const DEFAULT_ASSISTANT_AI_MODEL = "gemini-2.5-flash";
export const DEFAULT_SCAN_BATCH_SIZE = 8;
export const MIN_SCAN_BATCH_SIZE = 1;
export const MAX_SCAN_BATCH_SIZE = 16;

type AppConfigClient = {
  from: (table: string) => any;
};

export async function getAppConfigMap(
  serviceClient: AppConfigClient,
  keys: readonly string[],
): Promise<Record<string, string>> {
  if (keys.length === 0) return {};

  const { data, error } = await serviceClient
    .from("app_config")
    .select("key, value")
    .in("key", [...keys]);

  if (error) {
    throw new Error(error.message || "Failed to load app config");
  }

  return Object.fromEntries(
    (data ?? []).map((row: { key: string; value: string | null }) => [row.key, row.value?.trim() ?? ""]),
  );
}

export function getAppConfigBoolean(
  appConfigMap: Record<string, string>,
  key: string,
  fallback = false,
): boolean {
  const value = appConfigMap[key]?.trim().toLowerCase() ?? "";
  if (!value) return fallback;
  return value === "true";
}

export function getAppConfigString(
  appConfigMap: Record<string, string>,
  key: string,
  fallback = "",
): string {
  const value = appConfigMap[key]?.trim() ?? "";
  return value || fallback;
}

export function getAppConfigInteger(
  appConfigMap: Record<string, string>,
  key: string,
  fallback: number,
  min?: number,
  max?: number,
): number {
  const rawValue = appConfigMap[key]?.trim() ?? "";
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed)) return fallback;
  let value = parsed;
  if (typeof min === "number") value = Math.max(min, value);
  if (typeof max === "number") value = Math.min(max, value);
  return value;
}
