import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

export default createConfigForNuxt({
  features: {
    stylistic: false,
    tooling: false,
  },
})
  .prepend({
    ignores: ['**/supabase/functions/**', '**/.nuxt/**', '**/node_modules/**'],
  })
  .override('nuxt/typescript/rules', {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  })
  .override('nuxt/vue/rules', {
    rules: {
      'vue/html-self-closing': 'warn',
      'vue/attributes-order': 'warn',
      'vue/first-attribute-linebreak': 'warn',
      // Interdire v-html pour prévenir les injections XSS (contenu non échappé)
      'vue/no-v-html': 'error',
    },
  })
  .override('nuxt/import/rules', {
    rules: { 'import/first': 'warn' },
  })
  .override('nuxt/rules', {
    rules: { 'no-empty': 'warn' },
  })
