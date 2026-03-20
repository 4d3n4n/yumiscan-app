// @ts-ignore Deno runtime resolves remote modules directly in Edge Functions.
export { z } from "https://esm.sh/zod@3.22.4";
// @ts-ignore Deno runtime resolves remote modules directly in Edge Functions.
import { z } from "https://esm.sh/zod@3.22.4";

import { MAX_ASSISTANT_CARD_COUNT } from "./types.ts";

export const RequestSchema = z.object({
  scan_id: z.string().uuid(),
  language: z.enum(["fr", "en"]).default("fr"),
  force: z.boolean().optional().default(false),
  append_cards: z.boolean().optional().default(false),
});

export const AssistantResponseSchema = z.object({
  analysis_summary: z.string().min(1),
  ambiguity_reasons: z.array(z.string().min(1)).min(1).max(4),
  checkpoints: z.array(z.string().min(1)).min(1).max(4),
  store_phrases: z.array(z.object({
    title: z.string().min(1),
    user_language: z.string().min(1),
    japanese: z.string().min(1),
    romaji: z.string().min(1),
  })).min(1).max(MAX_ASSISTANT_CARD_COUNT),
  risk_level: z.enum(["probably_ok", "check_required", "avoid_if_uncertain"]),
  disclaimer: z.string().min(1),
});

export const AdditionalCardsResponseSchema = z.object({
  store_phrases: z.array(z.object({
    title: z.string().min(1),
    user_language: z.string().min(1),
    japanese: z.string().min(1),
    romaji: z.string().min(1),
  })).min(1).max(3),
});

export const PersistedAssistantResponseSchema = AssistantResponseSchema.extend({
  mode: z.enum(["ambiguous", "allergen"]),
});
