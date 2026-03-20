/**
 * Image resizing module.
 *
 * NOTE: Deno Edge Functions have limited access to native image processing libraries.
 * For production, consider:
 * 1. Client-side resizing before upload (recommended)
 * 2. Using a WASM-based image library
 *
 * This module provides a basic check and relies on client-side processing.
 */

import { IMAGE_CONFIG } from "../validation/schemas.ts";

/**
 * Result of image resize operation.
 */
export interface ResizeResult {
    buffer: ArrayBuffer;
    resized: boolean;
    originalWidth?: number;
    originalHeight?: number;
    newWidth?: number;
    newHeight?: number;
}

/**
 * Estimate if image needs resizing based on file size.
 * Returns metadata about the image without actual resizing.
 *
 * For actual resizing, implement client-side or use WASM library.
 */
export function checkIfResizeNeeded(buffer: ArrayBuffer): { needsResize: boolean; reason?: string } {
    const bytes = new Uint8Array(buffer);

    // If file is over 2MB, suggest resize
    if (bytes.length > 2 * 1024 * 1024) {
        return {
            needsResize: true,
            reason: `Image is ${(bytes.length / (1024 * 1024)).toFixed(1)}MB, consider resizing`
        };
    }

    return { needsResize: false };
}

/**
 * Placeholder for image resize functionality.
 * In production, implement with WASM-based library or rely on client-side.
 */
export function resizeImage(
    buffer: ArrayBuffer,
    _maxDimension: number = IMAGE_CONFIG.MAX_DIMENSION_PX
): ResizeResult {
    // For now, return the original buffer with a flag
    // indicating resize was not performed server-side
    const check = checkIfResizeNeeded(buffer);

    return {
        buffer,
        resized: false,
        // Note: Actual dimensions would require parsing image headers
    };
}

/**
 * Calculate target dimensions maintaining aspect ratio.
 */
export function calculateResizeDimensions(
    width: number,
    height: number,
    maxDimension: number
): { width: number; height: number } {
    if (width <= maxDimension && height <= maxDimension) {
        return { width, height };
    }

    const aspectRatio = width / height;

    if (width > height) {
        return {
            width: maxDimension,
            height: Math.round(maxDimension / aspectRatio),
        };
    } else {
        return {
            width: Math.round(maxDimension * aspectRatio),
            height: maxDimension,
        };
    }
}
