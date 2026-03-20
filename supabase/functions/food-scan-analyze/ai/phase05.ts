/**
 * Phase 0.5: Auditor / Corrector
 *
 * Receives the original image (compressed 2000px) and, when provided, the processed image
 * (contrast/sharpening from front) for better comma visibility, plus draft and OCR raw ref.
 */

import { AppError, ErrorCode } from "../errors/mod.ts";
import { Phase05OutputSchema, type Phase05Output, AI_CONFIG } from "../validation/schemas.ts";
import { buildPhase05Prompt } from "./prompts.ts";

/**
 * Extract JSON from Gemini response text.
 */
function extractJsonFromResponse(raw: string): string {
    let s = (raw || "").trim();

    const jsonBlock = s.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonBlock) {
        s = (jsonBlock[1] || "").trim();
    }

    const firstBrace = s.indexOf("{");
    if (firstBrace >= 0) {
        let depth = 0;
        let end = -1;
        for (let i = firstBrace; i < s.length; i++) {
            const ch = s[i];
            if (ch === "{") depth++;
            else if (ch === "}") {
                depth--;
                if (depth === 0) {
                    end = i;
                    break;
                }
            }
        }
        if (end >= 0) {
            s = s.slice(firstBrace, end + 1);
        }
    }

    return s;
}

/**
 * Convert ArrayBuffer to base64.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const uint8Array = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
}

/**
 * Call Gemini API for Phase 0.5: Auditor / Corrector.
 *
 * @param geminiKey - Gemini API key
 * @param imageOriginal - Original image (compressed 2000px)
 * @param imageProcessed - Processed image (contrast/sharpening, compressed 2000px) when provided by front
 * @param rawTextDraft - Draft raw text from Phase 0
 * @param mimeOriginal - MIME for original image
 * @param mimeProcessed - MIME for processed image (when imageProcessed is set)
 * @param ocrRawRef - Optional raw OCR from Cloud Vision for comma recovery
 * @returns Phase 0.5 output with certified raw text
 */
export async function callPhase05(
    geminiKey: string,
    modelName: string,
    imageOriginal: ArrayBuffer,
    imageProcessed: ArrayBuffer | null,
    rawTextDraft: string,
    mimeOriginal: string,
    mimeProcessed?: string,
    ocrRawRef?: string
): Promise<Phase05Output> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`;

    const hasProcessed = imageProcessed != null && imageProcessed.byteLength > 0;
    const prompt = buildPhase05Prompt(rawTextDraft, ocrRawRef, hasProcessed);

    const imageParts: Array<{ inline_data: { mime_type: string; data: string } }> = [
        { inline_data: { mime_type: mimeOriginal, data: arrayBufferToBase64(imageOriginal) } }
    ];
    if (hasProcessed && mimeProcessed) {
        imageParts.push({
            inline_data: { mime_type: mimeProcessed, data: arrayBufferToBase64(imageProcessed) }
        });
    }

    // Setup timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_CONFIG.TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        ...imageParts
                    ]
                }],
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0.1,
                },
            }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            const errMsg = data?.error?.message ?? data?.message ?? JSON.stringify(data);
            console.error("[Phase05] Gemini API error:", response.status, errMsg);
            throw new AppError(ErrorCode.GEMINI_API_ERROR, `Gemini API ${response.status}: ${errMsg}`);
        }

        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) {
            // If no response, use the draft as-is
            console.warn("[Phase05] No text in response, using draft");
            return { certified_raw_text: rawTextDraft };
        }

        // Parse JSON
        const jsonStr = extractJsonFromResponse(rawText);
        let parsed: unknown;
        try {
            parsed = JSON.parse(jsonStr);
        } catch {
            console.warn("[Phase05] Failed to parse JSON, using draft");
            return { certified_raw_text: rawTextDraft };
        }

        // Validate schema
        const result = Phase05OutputSchema.safeParse(parsed);
        if (!result.success) {
            console.warn("[Phase05] Schema validation failed, using draft");
            return { certified_raw_text: rawTextDraft };
        }

        if (result.data.certified_raw_text) {
            // STRIP LINE NUMBERS (consistency with Phase 0)
            result.data.certified_raw_text = result.data.certified_raw_text
                .replace(/^line\d+\s*[:：]\s*/gm, "")
                .replace(/\\nline\d+\s*[:：]\s*/g, "\n");
        }

        return result.data;
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            throw new AppError(ErrorCode.AI_TIMEOUT, "Phase 0.5 analysis timed out");
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}
