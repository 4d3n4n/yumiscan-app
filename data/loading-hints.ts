import { EMOJI_MAP } from '~/utils/emojis'

export type LoadingHintKey =
  | 'decision_reading'
  | 'conbini_translation'
  | 'travel_zero_surprises'
  | 'ambiguity_flagged'
  | 'quick_recheck_memory'
  | 'vertical_micro_labels'
  | 'critical_headings'
  | 'allergens_ground_reality'
  | 'often_missed_allergens'
  | 'hidden_parentheses'
  | 'hidden_dashi_extracts'
  | 'hidden_pork_derivatives'
  | 'hidden_alcohol_seasoning'
  | 'gluten_beyond_wheat'
  | 'milk_tripwire'
  | 'seafood_indirect_signals'
  | 'soba_red_flag'
  | 'peanut_and_nuts'
  | 'industrial_umami'
  | 'additives_by_role'
  | 'polyols_warning'
  | 'trace_factory_language'
  | 'gmo_wording'
  | 'manufacturer_contact'
  | 'japanese_dates'
  | 'salt_equivalent'
  | 'multiple_scripts'
  | 'catch_all_words'
  | 'conbini_plan_b'
  | 'frequent_products_cache'
  | 'photo_guidance'
  | 'final_verdict'

export type LoadingHintMeta = {
  emoji: keyof typeof LOADING_HINT_EMOJI_PATHS | string
  key: LoadingHintKey
}

/** Associe chaque clé emoji des hints aux images webp du dossier public/images/emojis */
export const LOADING_HINT_EMOJI_PATHS: Record<string, string> = {
  thinking: EMOJI_MAP.thinking,
  geek: EMOJI_MAP.geek,
  'thumbs-up': EMOJI_MAP['thumbs-up'],
  asking: EMOJI_MAP.asking,
  sleeping: EMOJI_MAP.sleeping,
  surprised: EMOJI_MAP.surprised,
  angry: EMOJI_MAP.angry,
  happy: EMOJI_MAP.happy,
  broken: EMOJI_MAP.broken,
}

export const LOADING_HINTS: LoadingHintMeta[] = [
  {
    emoji: 'thinking',
    key: 'decision_reading',
  },
  {
    emoji: 'geek',
    key: 'conbini_translation',
  },
  {
    emoji: 'thumbs-up',
    key: 'travel_zero_surprises',
  },
  {
    emoji: 'asking',
    key: 'ambiguity_flagged',
  },
  {
    emoji: 'sleeping',
    key: 'quick_recheck_memory',
  },

  // +25 hints (pour voyageurs au Japon)
  {
    emoji: 'geek',
    key: 'vertical_micro_labels',
  },
  {
    emoji: 'surprised',
    key: 'critical_headings',
  },
  {
    emoji: 'surprised',
    key: 'allergens_ground_reality',
  },
  {
    emoji: 'thinking',
    key: 'often_missed_allergens',
  },
  {
    emoji: 'thinking',
    key: 'hidden_parentheses',
  },
  {
    emoji: 'geek',
    key: 'hidden_dashi_extracts',
  },
  {
    emoji: 'angry',
    key: 'hidden_pork_derivatives',
  },
  {
    emoji: 'asking',
    key: 'hidden_alcohol_seasoning',
  },
  {
    emoji: 'surprised',
    key: 'gluten_beyond_wheat',
  },
  {
    emoji: 'thinking',
    key: 'milk_tripwire',
  },
  {
    emoji: 'surprised',
    key: 'seafood_indirect_signals',
  },
  {
    emoji: 'angry',
    key: 'soba_red_flag',
  },
  {
    emoji: 'surprised',
    key: 'peanut_and_nuts',
  },
  {
    emoji: 'geek',
    key: 'industrial_umami',
  },
  {
    emoji: 'thinking',
    key: 'additives_by_role',
  },
  {
    emoji: 'asking',
    key: 'polyols_warning',
  },
  {
    emoji: 'asking',
    key: 'trace_factory_language',
  },
  {
    emoji: 'thinking',
    key: 'gmo_wording',
  },
  {
    emoji: 'geek',
    key: 'manufacturer_contact',
  },
  {
    emoji: 'happy',
    key: 'japanese_dates',
  },
  {
    emoji: 'geek',
    key: 'salt_equivalent',
  },
  {
    emoji: 'thinking',
    key: 'multiple_scripts',
  },
  {
    emoji: 'surprised',
    key: 'catch_all_words',
  },
  {
    emoji: 'thumbs-up',
    key: 'conbini_plan_b',
  },
  {
    emoji: 'sleeping',
    key: 'frequent_products_cache',
  },
  {
    emoji: 'broken',
    key: 'photo_guidance',
  },
  {
    emoji: 'happy',
    key: 'final_verdict',
  },
]
