/**
 * Error codes for the YumiScan Edge Function.
 * Each code maps to a specific HTTP status and user-friendly message.
 */
export enum ErrorCode {
    // Image validation errors (4xx)
    INVALID_MIME = "INVALID_MIME",
    IMAGE_TOO_LARGE = "IMAGE_TOO_LARGE",
    IMAGE_BLURRY = "IMAGE_BLURRY",
    PROMPT_INJECTION_SUSPECTED = "PROMPT_INJECTION_SUSPECTED",
    NOT_INGREDIENTS_IMAGE = "NOT_INGREDIENTS_IMAGE",
    NO_TEXT_IN_IMAGE = "NO_TEXT_IN_IMAGE",
    IMAGE_DOWNLOAD_FAILED = "IMAGE_DOWNLOAD_FAILED",

    // Payload validation errors (4xx)
    INVALID_PAYLOAD = "INVALID_PAYLOAD",
    INVALID_BASE64 = "INVALID_BASE64",
    MISSING_IMAGE = "MISSING_IMAGE",
    INVALID_ALLERGEN_IDS = "INVALID_ALLERGEN_IDS",

    // Auth errors (401/403)
    NOT_AUTHENTICATED = "NOT_AUTHENTICATED",
    NO_ACTIVE_PASS = "NO_ACTIVE_PASS",

    // AI errors (5xx / partial 4xx)
    AI_PHASE1_INVALID_JSON = "AI_PHASE1_INVALID_JSON",
    AI_PHASE2_INVALID_JSON = "AI_PHASE2_INVALID_JSON",
    GEMINI_API_ERROR = "GEMINI_API_ERROR",
    AI_TIMEOUT = "AI_TIMEOUT",

    // Server errors (5xx)
    INTERNAL_ERROR = "INTERNAL_ERROR",
    CONFIG_MISSING = "CONFIG_MISSING",
}

/**
 * HTTP status codes for each error.
 */
export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
    [ErrorCode.INVALID_MIME]: 400,
    [ErrorCode.IMAGE_TOO_LARGE]: 400,
    [ErrorCode.IMAGE_BLURRY]: 400,
    [ErrorCode.PROMPT_INJECTION_SUSPECTED]: 400,
    [ErrorCode.NOT_INGREDIENTS_IMAGE]: 400,
    [ErrorCode.NO_TEXT_IN_IMAGE]: 400,
    [ErrorCode.IMAGE_DOWNLOAD_FAILED]: 404,

    [ErrorCode.INVALID_PAYLOAD]: 400,
    [ErrorCode.INVALID_BASE64]: 400,
    [ErrorCode.MISSING_IMAGE]: 400,
    [ErrorCode.INVALID_ALLERGEN_IDS]: 400,

    [ErrorCode.NOT_AUTHENTICATED]: 401,
    [ErrorCode.NO_ACTIVE_PASS]: 403,

    [ErrorCode.AI_PHASE1_INVALID_JSON]: 502,
    [ErrorCode.AI_PHASE2_INVALID_JSON]: 502,
    [ErrorCode.GEMINI_API_ERROR]: 502,
    [ErrorCode.AI_TIMEOUT]: 504,

    [ErrorCode.INTERNAL_ERROR]: 500,
    [ErrorCode.CONFIG_MISSING]: 500,
};

/**
 * User-facing error messages in French.
 */
export const ERROR_USER_MESSAGES: Record<ErrorCode, string> = {
    [ErrorCode.INVALID_MIME]: "Le fichier envoyé n'est pas une image valide (JPEG, PNG ou WEBP attendu).",
    [ErrorCode.IMAGE_TOO_LARGE]: "L'image est trop volumineuse. Taille maximale : 10 Mo.",
    [ErrorCode.IMAGE_BLURRY]: "L'image est trop floue. Veuillez reprendre une photo plus nette.",
    [ErrorCode.PROMPT_INJECTION_SUSPECTED]: "L'image contient du contenu suspect. Veuillez utiliser une photo d'ingrédients standard.",
    [ErrorCode.NOT_INGREDIENTS_IMAGE]: "L'image ne semble pas contenir une liste d'ingrédients. Veuillez scanner l'étiquette d'un produit alimentaire.",
    [ErrorCode.NO_TEXT_IN_IMAGE]: "Aucun texte détecté sur l'image. Veuillez photographier une étiquette lisible.",
    [ErrorCode.IMAGE_DOWNLOAD_FAILED]: "Impossible de télécharger l'image depuis le serveur.",

    [ErrorCode.INVALID_PAYLOAD]: "Requête invalide.",
    [ErrorCode.INVALID_BASE64]: "Données d'image invalides.",
    [ErrorCode.MISSING_IMAGE]: "Aucune image fournie.",
    [ErrorCode.INVALID_ALLERGEN_IDS]: "Certains allergènes sélectionnés sont invalides.",

    [ErrorCode.NOT_AUTHENTICATED]: "Vous devez être connecté pour utiliser cette fonctionnalité.",
    [ErrorCode.NO_ACTIVE_PASS]: "Votre pass n'est plus actif. Veuillez le renouveler.",

    [ErrorCode.AI_PHASE1_INVALID_JSON]: "L'analyse de l'image a échoué. Veuillez réessayer.",
    [ErrorCode.AI_PHASE2_INVALID_JSON]: "La validation de l'analyse a échoué. Veuillez réessayer.",
    [ErrorCode.GEMINI_API_ERROR]: "Une erreur technique est survenue lors de l'analyse. Veuillez réessayer.",
    [ErrorCode.AI_TIMEOUT]: "L'analyse a pris trop de temps. Veuillez réessayer.",

    [ErrorCode.INTERNAL_ERROR]: "Une erreur technique s'est produite. Réessayez dans quelques instants.",
    [ErrorCode.CONFIG_MISSING]: "Configuration serveur manquante. Contactez le support.",
};
