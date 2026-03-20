/**
 * Phase 0: Gatekeeper & Draft OCR (Cloud Vision + Gemini Text)
 *
 * 1. Google Cloud Vision API for OCR.
 * 2. Gemini (Text Only) to clean/format and validate: locate 原材料名, extract & clean, return is_valid_product + raw_text_draft.
 */

import { AppError, ErrorCode } from "../errors/mod.ts";
import { Phase0OutputSchema, type Phase0Output, AI_CONFIG } from "../validation/schemas.ts";
import { buildPhase0TextPrompt } from "./prompts.ts";
import { preprocessForOCR } from "../image/preprocess_for_ocr.ts";

/**
 * Extract JSON from Gemini response text.
 */
function extractJsonFromResponse(raw: string): string {
    let s = (raw || "").trim();
    const jsonBlock = /```(?:json)?\s*([\s\S]*?)```/.exec(s);
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
    for (const byte of uint8Array) {
        binary += String.fromCodePoint(byte);
    }
    return btoa(binary);
}

type VisionSymbol = {
    text?: string;
    property?: {
        detectedBreak?: {
            type?: string;
        };
    };
};

function appendDetectedBreak(text: string, symbol: VisionSymbol): string {
    const breakType = symbol.property?.detectedBreak?.type;

    if (breakType === "LINE_BREAK" || breakType === "EOL_SURE_SPACE") {
        return `${text}\n`;
    }

    if (breakType === "SPACE" || breakType === "SURE_SPACE") {
        return `${text} `;
    }

    return text;
}

// deno-lint-ignore no-explicit-any
function* iterateVisionSymbols(fullTextAnnotation: any): Generator<VisionSymbol> {
    const pages = fullTextAnnotation?.pages ?? [];

    for (const page of pages) {
        for (const block of page.blocks ?? []) {
            for (const paragraph of block.paragraphs ?? []) {
                for (const word of paragraph.words ?? []) {
                    for (const symbol of word.symbols ?? []) {
                        yield symbol as VisionSymbol;
                    }
                }
            }
        }
    }
}

/**
 * Reconstruct text from Cloud Vision symbol-level data.
 *
 * Cloud Vision's `fullTextAnnotation.text` can drop characters (especially
 * commas 、 at the start of physical lines on Japanese labels).
 *
 * This function iterates through every detected symbol and rebuilds the text
 * char-by-char, inserting detected breaks (LINE_BREAK → \n, SPACE → space).
 * This preserves ALL detected characters including line-start commas.
 */
// deno-lint-ignore no-explicit-any
function reconstructTextFromSymbols(fullTextAnnotation: any): string | null {
    try {
        const pages = fullTextAnnotation?.pages;
        if (!pages || pages.length === 0) return null;

        let text = "";

        for (const symbol of iterateVisionSymbols(fullTextAnnotation)) {
            text += symbol.text || "";
            text = appendDetectedBreak(text, symbol);
        }

        return text.length > 0 ? text : null;
    } catch (e) {
        console.warn("[Phase0][CloudVision] Symbol reconstruction failed:", e);
        return null;
    }
}

/**
 * Call Google Cloud Vision API for OCR.
 *
 * Uses symbol-level reconstruction to preserve commas at line boundaries.
 * Falls back to fullTextAnnotation.text if symbol parsing fails.
 */
export async function callCloudVisionOCR(
    apiKey: string,
    imageOriginal: ArrayBuffer
): Promise<string> {
    const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
    const base64Image = arrayBufferToBase64(imageOriginal);

    const body = {
        requests: [
            {
                image: {
                    content: base64Image
                },
                features: [
                    {
                        type: "DOCUMENT_TEXT_DETECTION"
                    }
                ],
                imageContext: {
                    languageHints: ["ja"], // Japanese priority
                    textDetectionParams: {
                        enableTextDetectionConfidenceScore: true
                    }
                }
            }
        ]
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("[Phase0][CloudVision] Error:", response.status, errText);
            throw new AppError(ErrorCode.GEMINI_API_ERROR, `Cloud Vision API error: ${response.status}`);
        }

        const data = await response.json();
        const fullTextAnnotation = data.responses?.[0]?.fullTextAnnotation;
        const fallbackText = fullTextAnnotation?.text || "";

        if (!fallbackText) {
            console.warn("[Phase0][CloudVision] No text detected via OCR");
            return "";
        }

        // Try symbol-level reconstruction (preserves line-start commas)
        const reconstructed = reconstructTextFromSymbols(fullTextAnnotation);

        if (reconstructed) {
            // Log differences for debugging
            if (reconstructed !== fallbackText) {
                console.log("[Phase0][CloudVision] Symbol reconstruction differs from raw text — using reconstructed version");
                // Find specific differences (commas added/preserved)
                const reconCommas = (reconstructed.match(/、/g) || []).length;
                const fallbackCommas = (fallbackText.match(/、/g) || []).length;
                if (reconCommas !== fallbackCommas) {
                    console.log(`[Phase0][CloudVision] Comma count: reconstructed=${reconCommas}, fallback=${fallbackCommas}`);
                }
            }
            return reconstructed;
        }

        // Fallback to raw text if reconstruction failed
        console.warn("[Phase0][CloudVision] Symbol reconstruction returned null, using fallback text");
        return fallbackText;

    } catch (error) {
        console.error("[Phase0][CloudVision] Exception:", error);
        throw new AppError(ErrorCode.GEMINI_API_ERROR, "Cloud Vision OCR failed");
    }
}

/**
 * Call Gemini (Text Only) to clean and format OCR text.
 * Locates 原材料名, extracts & cleans ingredient text, returns is_valid_product + raw_text_draft.
 */
async function callGeminiCleanText(
    apiKey: string,
    modelName: string,
    ocrText: string
): Promise<Phase0Output> {
    if (!ocrText || ocrText.trim().length === 0) {
        return {
            is_valid_product: false,
            raw_text_draft: "",
            notes: ["No text detected by OCR"]
        };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const prompt = buildPhase0TextPrompt(ocrText);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_CONFIG.TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0.1,
                },
            }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            const errMsg = data?.error?.message ?? data?.message ?? JSON.stringify(data);
            console.error("[Phase0] Gemini API error:", response.status, errMsg);
            throw new AppError(ErrorCode.GEMINI_API_ERROR, `Gemini API ${response.status}: ${errMsg}`);
        }

        const rawTextResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawTextResponse) {
            console.error("[Phase0] No text in Gemini response");
            throw new AppError(ErrorCode.AI_PHASE1_INVALID_JSON, "No response from AI");
        }

        const jsonStr = extractJsonFromResponse(rawTextResponse);
        let parsed: unknown;
        try {
            parsed = JSON.parse(jsonStr);
        } catch {
            console.error("[Phase0] Failed to parse JSON:", jsonStr.slice(0, 200));
            throw new AppError(ErrorCode.AI_PHASE1_INVALID_JSON, "Invalid JSON from AI");
        }

        const result = Phase0OutputSchema.safeParse(parsed);
        if (!result.success) {
            console.error("[Phase0] Schema validation failed:", result.error.errors);
            throw new AppError(
                ErrorCode.AI_PHASE1_INVALID_JSON,
                `Schema validation failed: ${result.error.errors.map((e: { message: string }) => e.message).join(", ")}`
            );
        }

        return result.data;
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            throw new AppError(ErrorCode.AI_TIMEOUT, "Phase 0 analysis timed out");
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Call Phase 0: OCR (Cloud Vision) then clean/validate (Gemini Text).
 *
 * @param geminiKey - API key for Cloud Vision and Gemini
 * @param imageOriginal - Image buffer
 * @param _mimeType - Unused (kept for interface compatibility)
 * @returns Phase 0 output (is_valid_product, raw_text_draft from Gemini; ocr_raw_text from Vision)
 */
export async function callPhase0(
    geminiKey: string,
    modelName: string,
    imageOriginal: ArrayBuffer,
    _mimeType: string
): Promise<Phase0Output> {
    // Preprocess: B&W + contrast + sharpen for better OCR accuracy
    const { buffer: ocrImage, preprocessed } = await preprocessForOCR(imageOriginal, _mimeType);
    if (preprocessed) {
        console.log("[Phase0] Using preprocessed B&W image for Cloud Vision OCR");
    }

    const ocrText = await callCloudVisionOCR(geminiKey, ocrImage);

    if (!ocrText || ocrText.trim().length < 10) {
        return {
            is_valid_product: false,
            raw_text_draft: ocrText || "",
            ocr_raw_text: ocrText || "",
            notes: ["No or insufficient text from OCR"]
        };
    }

    const result = await callGeminiCleanText(geminiKey, modelName, ocrText);
    return {
        ...result,
        ocr_raw_text: ocrText
    };
}
