/**
 * Image compression for API calls.
 *
 * Production hotfix:
 * - do not depend on remote ImageMagick WASM inside the Edge runtime
 * - trust the client-side prepared images and keep the server path deterministic
 */

export interface CompressResult {
    buffer: ArrayBuffer;
    mimeType: string;
    compressed: boolean;
}

export async function compressImageForApi(
    buffer: ArrayBuffer,
    mimeType: string,
): Promise<CompressResult> {
    return {
        buffer,
        mimeType,
        compressed: false,
    };
}
