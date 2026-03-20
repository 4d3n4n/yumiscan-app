/**
 * OCR preprocessing.
 *
 * Production hotfix:
 * - keep the worker stable without remote ImageMagick WASM imports
 * - use the original image when the client has not provided a dedicated processed version
 */

export interface PreprocessResult {
    buffer: ArrayBuffer;
    mimeType: string;
    preprocessed: boolean;
}

export async function preprocessForOCR(
    buffer: ArrayBuffer,
    mimeType: string
): Promise<PreprocessResult> {
    return {
        buffer,
        mimeType,
        preprocessed: false,
    };
}
