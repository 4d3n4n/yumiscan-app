import type {
  AssistantEvidenceMatrix,
  AssistantSelectedCriterion,
  ScanIngredientWithReason,
} from "../_shared/assistant-evidence.ts";

export const DEFAULT_ASSISTANT_CARD_COUNT = 3;
export const MAX_ASSISTANT_CARD_COUNT = 6;

export type AssistantLanguage = "fr" | "en";
export type AssistantPerspective = "assistant" | "user";
export type AssistantCriteriaFocusKind = "profile" | "allergen" | "mixed";
export type FallbackEvidenceClassification =
  | "direct_blocker"
  | "ambiguous_scoped"
  | "ambiguous_global";

export type AssistantScanContext = {
  scanId: string;
  productStatus: string;
  certifiedRawText: string | null;
  detectedLanguage: string;
  selectedAllergenIds: string[];
  selectedAllergens: string[];
  selectedCriteria: AssistantSelectedCriterion[];
  selectedProfileLabels: string[];
  selectedAllergenLabels: string[];
  ambiguousIngredients: ScanIngredientWithReason[];
  allergenIngredients: ScanIngredientWithReason[];
  evidenceMatrix: AssistantEvidenceMatrix;
  assistantCacheJson: unknown;
  assistantTtsCacheJson: unknown;
};

export type AssistantGenerationOptions = {
  forceRegeneration?: boolean;
  previousResponse?: import("../_shared/scan-ai-assistant.ts").ScanAmbiguousAssistantResponse | null;
  regenerationAttempt?: number;
};

export type AssistantDbClient = {
  from: (table: string) => any;
};

export type AssistantServiceClient = AssistantDbClient & {
  storage: {
    from: (bucket: string) => any;
  };
};
