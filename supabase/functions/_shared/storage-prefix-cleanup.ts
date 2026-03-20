type StorageFileLike = {
  name?: string | null;
  id?: string | null;
  metadata?: Record<string, unknown> | null;
};

type StorageBucketClient = {
  list: (path?: string, options?: Record<string, unknown>) => Promise<{ data: StorageFileLike[] | null; error: { message?: string } | null }>;
  remove: (paths: string[]) => Promise<{ error: { message?: string } | null }>;
};

type StorageClient = {
  from: (bucket: string) => StorageBucketClient;
};

function isFileEntry(entry: StorageFileLike) {
  return Boolean(entry.id) || Boolean(entry.metadata);
}

async function collectStoragePathsRecursively(
  bucket: StorageBucketClient,
  prefix: string,
): Promise<string[]> {
  const normalizedPrefix = prefix.replace(/^\/+|\/+$/g, "");
  const { data, error } = await bucket.list(normalizedPrefix, {
    limit: 1000,
    offset: 0,
    sortBy: { column: "name", order: "asc" },
  });

  if (error) {
    throw new Error(error.message || `Failed to list storage prefix ${normalizedPrefix}`);
  }

  const entries = data ?? [];
  const nestedResults = await Promise.all(entries.map(async (entry) => {
    const name = entry.name?.trim();
    if (!name) return [];

    const fullPath = normalizedPrefix ? `${normalizedPrefix}/${name}` : name;
    if (isFileEntry(entry)) {
      return [fullPath];
    }

    return collectStoragePathsRecursively(bucket, fullPath);
  }));

  return nestedResults.flat();
}

export async function removeStorageFilesUnderPrefix(
  storage: StorageClient,
  bucketName: string,
  prefix: string,
): Promise<string[]> {
  const normalizedPrefix = prefix.replace(/^\/+|\/+$/g, "");
  if (!normalizedPrefix) return [];

  const bucket = storage.from(bucketName);
  const filePaths = await collectStoragePathsRecursively(bucket, normalizedPrefix);
  if (filePaths.length === 0) {
    return [];
  }

  const { error } = await bucket.remove(filePaths);
  if (error) {
    throw new Error(error.message || `Failed to remove files under ${normalizedPrefix}`);
  }

  return filePaths;
}
