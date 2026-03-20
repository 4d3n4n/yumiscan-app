import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

import { removeStorageFilesUnderPrefix } from "./storage-prefix-cleanup.ts";

type StoredScanRow = {
  image_storage_path?: string | null;
};

function uniqueStoragePaths(scans: StoredScanRow[] | null | undefined): string[] {
  return Array.from(new Set(
    (scans ?? [])
      .map(scan => scan.image_storage_path?.trim())
      .filter((path): path is string => Boolean(path))
  ));
}

export async function deleteAccountDataOrThrow(
  supabase: SupabaseClient,
  userId: string,
  loggerPrefix: string,
): Promise<void> {
  const { data: scans, error: scansError } = await supabase
    .from("scans")
    .select("image_storage_path")
    .eq("user_id", userId);

  if (scansError) {
    console.error(`${loggerPrefix} Failed to load scans before deletion:`, scansError);
    throw new Error("Impossible de charger les scans du compte.");
  }

  const paths = uniqueStoragePaths(scans as StoredScanRow[] | null | undefined);
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage.from("scan-images").remove(paths);
    if (storageError) {
      console.error(`${loggerPrefix} Failed to delete scan images from storage:`, storageError);
      throw new Error("Impossible de supprimer les images du compte.");
    }
  }

  try {
    await removeStorageFilesUnderPrefix(supabase.storage, "assistant-audio", userId);
  } catch (assistantAudioPrefixError) {
    console.error(`${loggerPrefix} Failed to delete assistant audio prefix from storage:`, assistantAudioPrefixError);
    throw new Error("Impossible de supprimer tous les audios Assistant IA du compte.");
  }

  const { error: scansDeleteError } = await supabase
    .from("scans")
    .delete()
    .eq("user_id", userId);

  if (scansDeleteError) {
    console.error(`${loggerPrefix} Failed to delete scans:`, scansDeleteError);
    throw new Error("Impossible de supprimer les scans du compte.");
  }

  const { error: profileDeleteError } = await supabase
    .from("user_profiles")
    .delete()
    .eq("user_id", userId);

  if (profileDeleteError) {
    console.error(`${loggerPrefix} Failed to delete user profile:`, profileDeleteError);
    throw new Error("Impossible de supprimer le profil utilisateur.");
  }

  const { error: authDeleteError } = await supabase.rpc(
    "admin_delete_auth_user",
    { p_user_id: userId },
  );

  if (authDeleteError) {
    console.error(`${loggerPrefix} Auth delete error:`, authDeleteError);
    throw new Error("Impossible de supprimer le compte d'authentification.");
  }
}
