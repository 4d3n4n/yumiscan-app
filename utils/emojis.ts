/**
 * Emojis webp du dossier public/images/emojis.
 * Fichiers présents : angry, asking, broken, geek, happy, hi, laughing, sad, sleeping, smile, surprised, thinking, thumbs-up
 */
export const EMOJI_MAP = {
  angry: '/images/emojis/angry.webp',
  asking: '/images/emojis/asking.webp',
  broken: '/images/emojis/broken.webp',
  geek: '/images/emojis/geek.webp',
  happy: '/images/emojis/happy.webp',
  hi: '/images/emojis/hi.webp',
  laughing: '/images/emojis/laughing.webp',
  sad: '/images/emojis/sad.webp',
  sleeping: '/images/emojis/sleeping.webp',
  smile: '/images/emojis/smile.webp',
  surprised: '/images/emojis/surprised.webp',
  thinking: '/images/emojis/thinking.webp',
  'thumbs-up': '/images/emojis/thumbs-up.webp',
} as const

export type EmojiId = keyof typeof EMOJI_MAP

/**
 * Retourne le chemin de l'emoji (pas de variante _white dans ce projet).
 */
export function getEmojiPath(id: EmojiId, _forDarkMode?: boolean): string {
  const baseId = (id as string).replace(/_white$/, '')
  return baseId in EMOJI_MAP ? EMOJI_MAP[baseId as EmojiId] : EMOJI_MAP[id]
}

/** Emojis pour les contextes d'app (états vides, erreurs, modales) */
export const APP_EMOJI = {
  emptyScan: 'sleeping' as const,
  noCredits: 'sad' as const,
  scanError: 'broken' as const,
  login: 'smile' as const,
  loginError: 'angry' as const,
  notFound: 'asking' as const,
  serverError: 'broken' as const,
  /** Succès générique (feedback, signup, forgot-password, etc.) */
  success: 'happy' as const,
  /** Erreur paiement / checkout */
  checkoutError: 'angry' as const,
  /** Avertissement action grave (suppression compte, suppression user) */
  destructiveWarning: 'surprised' as const,
  allergenDetected: 'surprised' as const,
} as const

/** Emojis pour le statut du résultat de scan (passport) */
export const STATUS_EMOJIS = {
  ok: 'happy' as const,
  contains_allergen: 'surprised' as const,
  ambiguous: 'thinking' as const,
} as const
