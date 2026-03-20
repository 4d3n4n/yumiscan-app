/**
 * Phase 1.5: Translation Only
 *
 * This phase translates raw tokens to French.
 * No classification, just pure translation.
 */

import { AppError, ErrorCode } from "../errors/mod.ts";
import { Phase15OutputSchema, type Phase15Output, AI_CONFIG, type OutputLanguage } from "../validation/schemas.ts";
import { buildPhase15Prompt } from "./prompts.ts";

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
 * Call Gemini API for Phase 1.5: Translation Only.
 *
 * @param geminiKey - Gemini API key
 * @param rawTokens - Raw tokens from Phase 1 (CODE parsing)
 * @returns Phase 1.5 output with translated items
 */
export async function callPhase15(
    geminiKey: string,
    modelName: string,
    rawTokens: string[],
    outputLanguage: OutputLanguage,
): Promise<Phase15Output> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`;

    const prompt = buildPhase15Prompt(rawTokens, outputLanguage);

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
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0.2,
                },
            }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            const errMsg = data?.error?.message ?? data?.message ?? JSON.stringify(data);
            console.error("[Phase15] Gemini API error:", response.status, errMsg);
            throw new AppError(ErrorCode.GEMINI_API_ERROR, `Gemini API ${response.status}: ${errMsg}`);
        }

        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) {
            console.error("[Phase15] No text in response");
            // Fallback: return raw tokens as-is with no translation
            return {
                items: rawTokens.map(raw => ({ raw, normalized_fr: raw })),
            };
        }

        // Parse JSON
        const jsonStr = extractJsonFromResponse(rawText);
        let parsed: unknown;
        try {
            parsed = JSON.parse(jsonStr);
        } catch {
            console.error("[Phase15] Failed to parse JSON");
            return {
                items: rawTokens.map(raw => ({ raw, normalized_fr: raw })),
            };
        }

        // Validate schema
        const result = Phase15OutputSchema.safeParse(parsed);
        if (!result.success) {
            console.error("[Phase15] Schema validation failed:", result.error.errors);
            return {
                items: rawTokens.map(raw => ({ raw, normalized_fr: raw })),
            };
        }

        return result.data;
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            throw new AppError(ErrorCode.AI_TIMEOUT, "Phase 1.5 translation timed out");
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}
