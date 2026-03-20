import { z } from "https://esm.sh/zod@3.22.4";

import { getAuthUser } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  ASSISTANT_TTS_AUDIO_CONTENT_TYPE,
  buildAssistantTtsCachePayload,
  buildAssistantTtsStoragePath,
  computeAssistantTtsTextHash,
  DEFAULT_ASSISTANT_TTS_VOICE,
  readAssistantTtsCacheEntry,
} from "../_shared/scan-assistant-tts-cache.ts";

import type {
  ScanAssistantStorePhrase,
  ScanAssistantTtsResponse,
} from "../_shared/scan-ai-assistant.ts";

const RequestSchema = z.object({
  scan_id: z.string().uuid(),
  phrase_index: z.number().int().min(0),
  language: z.enum(["fr", "en"]).default("fr"),
});

const StorePhraseSchema = z.object({
  title: z.string().min(1),
  user_language: z.string().min(1),
  japanese: z.string().min(1),
  romaji: z.string().min(1),
});

const PersistedAssistantResponseSchema = z.object({
  mode: z.enum(["ambiguous", "allergen"]),
  analysis_summary: z.string().min(1),
  ambiguity_reasons: z.array(z.string().min(1)).min(1),
  checkpoints: z.array(z.string().min(1)).min(1),
  store_phrases: z.array(StorePhraseSchema).min(1),
  risk_level: z.enum(["probably_ok", "check_required", "avoid_if_uncertain"]),
  disclaimer: z.string().min(1),
});

const AssistantCacheEntrySchema = z.object({
  version: z.number(),
  source_signature: z.string().min(1),
  generated_at: z.string().min(1),
  response: PersistedAssistantResponseSchema,
});

const AssistantCachePayloadSchema = z.object({
  version: z.number(),
  entries: z.object({
    fr: AssistantCacheEntrySchema.optional(),
    en: AssistantCacheEntrySchema.optional(),
  }).partial(),
});

const TtsApiResponseSchema = z.object({
  audioContent: z.string().min(1),
});

type AssistantLanguage = z.infer<typeof RequestSchema>["language"];

function jsonResponse(cors: HeadersInit, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function getGoogleTtsApiKey(): string | null {
  const candidates = [
    Deno.env.get("GOOGLE_CLOUD_TEXT_TO_SPEECH_API_KEY"),
    Deno.env.get("GOOGLE_CLOUD_TTS_API_KEY"),
    Deno.env.get("GOOGLE_TTS_API_KEY"),
  ];

  for (const candidate of candidates) {
    if (candidate?.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function getBrowserFacingSupabaseOrigin(): string | null {
  const candidates = [
    Deno.env.get("SUPABASE_PUBLIC_URL"),
    Deno.env.get("PUBLIC_SUPABASE_URL"),
    Deno.env.get("NUXT_PUBLIC_SUPABASE_URL"),
    Deno.env.get("SUPABASE_URL"),
  ];

  for (const candidate of candidates) {
    if (!candidate?.trim()) continue;

    try {
      return new URL(candidate.trim()).origin;
    } catch {
      continue;
    }
  }

  return null;
}

function readAssistantPhrases(
  assistantCacheJson: unknown,
  language: AssistantLanguage,
): ScanAssistantStorePhrase[] | null {
  const parsedCache = AssistantCachePayloadSchema.safeParse(assistantCacheJson);
  if (!parsedCache.success) return null;

  const cachedEntry = parsedCache.data.entries[language];
  if (!cachedEntry) return null;

  return cachedEntry.response.store_phrases;
}

function decodeBase64Audio(content: string): Uint8Array {
  const binary = atob(content);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function createSignedAudioUrl(
  supabase: { storage: { from: (bucket: string) => any } },
  storagePath: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("assistant-audio")
    .createSignedUrl(storagePath, 3600);

  if (error || !data?.signedUrl) {
    return null;
  }

  const browserFacingOrigin = getBrowserFacingSupabaseOrigin();
  if (!browserFacingOrigin) {
    return data.signedUrl;
  }

  try {
    const signedUrl = new URL(data.signedUrl);
    const publicOrigin = new URL(browserFacingOrigin);
    signedUrl.protocol = publicOrigin.protocol;
    signedUrl.host = publicOrigin.host;
    return signedUrl.toString();
  } catch {
    return data.signedUrl;
  }
}

async function synthesizeJapaneseAudio(
  japaneseText: string,
  voice: string,
): Promise<Uint8Array> {
  const apiKey = getGoogleTtsApiKey();
  if (!apiKey) {
    throw new Error("Google Cloud TTS API key is not configured");
  }

  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: { text: japaneseText },
        voice: {
          languageCode: "ja-JP",
          name: voice,
        },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: 1,
          pitch: 0,
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google TTS synthesis failed: ${response.status} ${errorText}`);
  }

  const parsed = TtsApiResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("Google TTS returned an invalid payload");
  }

  return decodeBase64Audio(parsed.data.audioContent);
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return jsonResponse(cors, 405, { error: "Method not allowed" });
  }

  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return jsonResponse(cors, 400, { error: "Body JSON invalide" });
    }

    const body = RequestSchema.parse(rawBody);
    const { user, supabase } = await getAuthUser(req);
    const voice = DEFAULT_ASSISTANT_TTS_VOICE;

    const { data: scanRow, error: scanError } = await supabase
      .from("scans")
      .select("id, user_id, assistant_cache_json, assistant_tts_cache_json")
      .eq("id", body.scan_id)
      .eq("user_id", user.id)
      .single();

    if (scanError || !scanRow) {
      return jsonResponse(cors, 404, { error: "Scan introuvable ou acces refuse." });
    }

    const phrases = readAssistantPhrases(scanRow.assistant_cache_json ?? null, body.language);
    if (!phrases) {
      return jsonResponse(cors, 409, { error: "Le cache Assistant IA est indisponible pour ce scan." });
    }

    const phrase = phrases[body.phrase_index];
    if (!phrase?.japanese?.trim()) {
      return jsonResponse(cors, 400, { error: "Phrase japonaise introuvable pour cet index." });
    }

    const japaneseText = phrase.japanese.trim();
    const textHash = await computeAssistantTtsTextHash(japaneseText, voice);
    const cachedEntry = readAssistantTtsCacheEntry(
      scanRow.assistant_tts_cache_json ?? null,
      body.language,
      body.phrase_index,
    );

    if (
      cachedEntry &&
      cachedEntry.voice === voice &&
      cachedEntry.text_hash === textHash &&
      cachedEntry.storage_path
    ) {
      const signedUrl = await createSignedAudioUrl(supabase, cachedEntry.storage_path);
      if (signedUrl) {
        const payload: ScanAssistantTtsResponse = {
          audio_url: signedUrl,
          voice,
          cache_hit: true,
        };
        return jsonResponse(cors, 200, payload);
      }
    }

    const audioBytes = await synthesizeJapaneseAudio(japaneseText, voice);
    const storagePath = buildAssistantTtsStoragePath({
      userId: user.id,
      scanId: body.scan_id,
      language: body.language,
      phraseIndex: body.phrase_index,
      voice,
      textHash,
    });

    const previousPath = cachedEntry?.storage_path ?? null;
    if (previousPath && previousPath !== storagePath) {
      const { error: removePreviousError } = await supabase.storage
        .from("assistant-audio")
        .remove([previousPath]);

      if (removePreviousError) {
        console.warn("[scan-assistant-tts] Failed to remove stale audio:", removePreviousError.message);
      }
    }

    const { error: uploadError } = await supabase.storage
      .from("assistant-audio")
      .upload(storagePath, audioBytes, {
        contentType: ASSISTANT_TTS_AUDIO_CONTENT_TYPE,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(uploadError.message || "Failed to upload synthesized audio");
    }

    const nextCache = buildAssistantTtsCachePayload(
      scanRow.assistant_tts_cache_json ?? null,
      body.language,
      body.phrase_index,
      {
        voice,
        text_hash: textHash,
        storage_path: storagePath,
        generated_at: new Date().toISOString(),
        content_type: ASSISTANT_TTS_AUDIO_CONTENT_TYPE,
      },
    );

    const { error: persistError } = await supabase
      .from("scans")
      .update({ assistant_tts_cache_json: nextCache })
      .eq("id", body.scan_id)
      .eq("user_id", user.id);

    if (persistError) {
      const { error: rollbackError } = await supabase.storage
        .from("assistant-audio")
        .remove([storagePath]);
      if (rollbackError) {
        console.warn("[scan-assistant-tts] Failed to rollback uploaded audio:", rollbackError.message);
      }
      throw new Error(persistError.message || "Failed to persist TTS cache");
    }

    const signedUrl = await createSignedAudioUrl(supabase, storagePath);
    if (!signedUrl) {
      throw new Error("Impossible de signer l'audio genere.");
    }

    const payload: ScanAssistantTtsResponse = {
      audio_url: signedUrl,
      voice,
      cache_hit: false,
    };

    return jsonResponse(cors, 200, payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonResponse(cors, 400, {
        error: "Payload invalide",
        details: error.flatten(),
      });
    }

    const message = error instanceof Error ? error.message : "Erreur serveur";
    const status = /token|auth|expired/i.test(message) ? 401 : 500;
    console.error("[scan-assistant-tts]", message);
    return jsonResponse(cors, status, { error: message });
  }
});
