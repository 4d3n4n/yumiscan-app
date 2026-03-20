<script setup lang="ts">
import { computed } from 'vue'
/**
 * Bouton ou lien unifié — style Bold (bold-btn).
 * Même rendu partout : variant (couleur / fond), taille, pill.
 * Si `to` est défini, rend un NuxtLink ; sinon un <button>.
 */
type AppButtonVariant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'destructive'
type AppButtonSize = 'sm' | 'md' | 'lg'

const props = withDefaults(
  defineProps<{
    /** Route ou URL pour rendre un lien (NuxtLink). Si absent, rend un bouton. */
    to?: string
    /** Style visuel : couleur de fond et texte. */
    variant?: AppButtonVariant
    /** Taille du bouton. */
    size?: AppButtonSize
    /** Coins en pill (arrondi complet). */
    pill?: boolean
    /** Désactive le bouton (ignoré si `to` est défini). */
    disabled?: boolean
    /** Type du bouton (si pas de `to`). */
    type?: 'button' | 'submit' | 'reset'
  }>(),
  {
    variant: 'primary',
    size: 'md',
    pill: false,
    disabled: false,
    type: 'button',
  }
)

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const variantClass = computed(() => {
  const map: Record<AppButtonVariant, string> = {
    primary: 'bold-btn--primary',
    secondary: 'bold-btn--secondary',
    ghost: 'bold-btn--ghost',
    accent: 'bold-btn--accent',
    destructive: 'bold-btn--destructive',
  }
  return map[props.variant]
})

const sizeClass = computed(() => {
  const map: Record<AppButtonSize, string> = {
    sm: 'bold-btn--sm',
    md: 'bold-btn--md',
    lg: 'bold-btn--lg',
  }
  return map[props.size]
})

const buttonClass = computed(
  () =>
    `bold-btn ${variantClass.value} ${sizeClass.value} ${props.pill ? 'bold-btn--pill' : ''}`.trim()
)

function onClick(e: MouseEvent) {
  if (props.to) return
  emit('click', e)
}
</script>

<template>
  <NuxtLink
    v-if="to"
    :to="to"
    :class="buttonClass"
    class="inline-flex"
  >
    <slot />
  </NuxtLink>
  <button
    v-else
    :type="type"
    :class="buttonClass"
    :disabled="disabled"
    @click="onClick"
  >
    <slot />
  </button>
</template>
