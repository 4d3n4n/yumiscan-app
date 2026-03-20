import { AppError, ErrorCode } from "../errors/mod.ts";
import { IMAGE_CONFIG } from "../validation/schemas.ts";

/**
 * Magic bytes for supported image formats.
 */
const MAGIC_BYTES = {
    JPEG: [0xFF, 0xD8, 0xFF],
    PNG: [0x89, 0x50, 0x4E, 0x47],
    WEBP_RIFF: [0x52, 0x49, 0x46, 0x46],
    WEBP_MARKER: [0x57, 0x45, 0x42, 0x50], // at offset 8-11
} as const;

/**
 * Result of MIME validation.
 */
export interface MimeValidationResult {
    isValid: boolean;
    mimeType: "image/jpeg" | "image/png" | "image/webp" | null;
    error?: string;
}

/**
 * Validate that a buffer contains a valid image by checking magic bytes.
 * Returns the actual MIME type based on content (not file extension).
 */
export function validateImageBuffer(buffer: ArrayBuffer): MimeValidationResult {
    const bytes = new Uint8Array(buffer);

    if (bytes.length < 12) {
        return { isValid: false, mimeType: null, error: "Buffer too small to be a valid image" };
    }

    // Check size limit
    if (bytes.length > IMAGE_CONFIG.MAX_SIZE_BYTES) {
        return { isValid: false, mimeType: null, error: `Image exceeds maximum size of ${IMAGE_CONFIG.MAX_SIZE_BYTES / (1024 * 1024)}MB` };
    }

    // Check JPEG
    if (
        bytes[0] === MAGIC_BYTES.JPEG[0] &&
        bytes[1] === MAGIC_BYTES.JPEG[1] &&
        bytes[2] === MAGIC_BYTES.JPEG[2]
    ) {
        return { isValid: true, mimeType: "image/jpeg" };
    }

    // Check PNG
    if (
        bytes[0] === MAGIC_BYTES.PNG[0] &&
        bytes[1] === MAGIC_BYTES.PNG[1] &&
        bytes[2] === MAGIC_BYTES.PNG[2] &&
        bytes[3] === MAGIC_BYTES.PNG[3]
    ) {
        return { isValid: true, mimeType: "image/png" };
    }

    // Check WEBP (RIFF....WEBP)
    if (
        bytes[0] === MAGIC_BYTES.WEBP_RIFF[0] &&
        bytes[1] === MAGIC_BYTES.WEBP_RIFF[1] &&
        bytes[2] === MAGIC_BYTES.WEBP_RIFF[2] &&
        bytes[3] === MAGIC_BYTES.WEBP_RIFF[3] &&
        bytes[8] === MAGIC_BYTES.WEBP_MARKER[0] &&
        bytes[9] === MAGIC_BYTES.WEBP_MARKER[1] &&
        bytes[10] === MAGIC_BYTES.WEBP_MARKER[2] &&
        bytes[11] === MAGIC_BYTES.WEBP_MARKER[3]
    ) {
        return { isValid: true, mimeType: "image/webp" };
    }

    return { isValid: false, mimeType: null, error: "Unsupported image format. Use JPEG, PNG, or WEBP." };
}

/**
 * Decode a base64 string to ArrayBuffer.
 * Handles data URLs (strips prefix) and validates the result.
 */
export function decodeBase64ToBuffer(base64Input: string): ArrayBuffer {
    // Strip data URL prefix if present
    const cleanBase64 = base64Input.replace(/^data:image\/\w+;base64,/, "");

    if (!cleanBase64 || cleanBase64.length === 0) {
        throw new AppError(ErrorCode.INVALID_BASE64, "Empty base64 string");
    }

    // Basic base64 validation
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleanBase64)) {
        throw new AppError(ErrorCode.INVALID_BASE64, "Invalid base64 characters");
    }

    try {
        const binary = atob(cleanBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    } catch (error) {
        throw new AppError(
            ErrorCode.INVALID_BASE64,
            `Failed to decode base64: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

/**
 * Encode an ArrayBuffer to base64 string.
 */
export function encodeBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Validate and decode an image from base64.
 * Returns the buffer and detected MIME type.
 */
export function validateAndDecodeImage(base64Input: string): { buffer: ArrayBuffer; mimeType: string } {
    const buffer = decodeBase64ToBuffer(base64Input);
    const validation = validateImageBuffer(buffer);

    if (!validation.isValid || !validation.mimeType) {
        throw new AppError(ErrorCode.INVALID_MIME, validation.error);
    }

    return { buffer, mimeType: validation.mimeType };
}
