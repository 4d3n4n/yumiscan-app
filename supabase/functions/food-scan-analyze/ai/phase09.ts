import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import { logInfo } from "../logging/mod.ts";
import { STRUCTURAL_REPAIR_PROMPT } from "./prompts.ts";

export interface Phase09Output {
    repaired_text: string;
    was_repaired: boolean;
}

/**
 * Convert ArrayBuffer to base64 (Deno compatible).
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const uint8Array = new Uint8Array(buffer);
    let binary = "";
    const len = uint8Array.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
}

/**
 * Phase 0.9: Structural Repair (AI-Assisted)
 * Triggered only when parenthesis imbalance is detected.
 * Uses the original image + broken text to reconstruct the correct structure.
 */
export async function callPhase09(
    apiKey: string,
    modelName: string,
    imageBuffer: ArrayBuffer,
    imageProcessedBuffer: ArrayBuffer | null,
    brokenText: string,
    mimeType: string
): Promise<Phase09Output> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    logInfo("Starting Phase 0.9: Structural Repair", {
        brokenTextLength: brokenText.length
    });

    const parts: any[] = [];

    // 1. Add Prompt with the broken text injected
    // Use {{RAW_TEXT}} placeholder replacement for clarity
    const prompt = STRUCTURAL_REPAIR_PROMPT.replace("{{RAW_TEXT}}", brokenText);
    parts.push(prompt);

    // 2. Add Original Image
    parts.push({
        inlineData: {
            data: arrayBufferToBase64(imageBuffer),
            mimeType: mimeType,
        },
    });

    // 3. Add Processed Image (if available, for better contrast)
    if (imageProcessedBuffer) {
        parts.push({
            inlineData: {
                data: arrayBufferToBase64(imageProcessedBuffer),
                mimeType: mimeType,
            },
        });
    }

    try {
        const result = await model.generateContent(parts);
        const response = await result.response;
        const text = response.text();

        // Clean up markdown blocks if AI adds them
        let clean = text.replace(/```json/g, "").replace(/```/g, "").trim();

        // Remove any markdown code block wrapper specifically for text if present
        if (clean.startsWith('"\n')) clean = clean.substring(2);
        if (clean.endsWith('\n"')) clean = clean.substring(0, clean.length - 2);

        logInfo("Phase 0.9 complete", {
            repairedTextLength: clean.length,
            diff: clean.length - brokenText.length
        });

        return {
            repaired_text: clean,
            was_repaired: true
        };

    } catch (error) {
        // Fallback: Return original broken text if AI fails
        console.error("Phase 0.9 failed", error);
        return {
            repaired_text: brokenText,
            was_repaired: false
        };
    }
}
