<script setup lang="ts">
/**
 * Back-office admin — Liste des utilisateurs.
 * Pagination, actions : réinit MDP, copier email, mailto, voir scans, supprimer.
 */
import { useQuery } from '@tanstack/vue-query'
import {
  PhShieldCheck,
  PhSpinnerGap,
  PhEnvelopeSimple,
  PhKey,
  PhTrash,
  PhList,
  PhCopy,
  PhMagnifyingGlass,
} from '@phosphor-icons/vue'
import type { AdminUserListItem } from '~/composables/useEdgeFunctions'
import { formatDateList, displayName, computeTotalPages } from '~/utils/admin-helpers'
import AppEmoji from '~/components/ui/AppEmoji.vue'
import { APP_EMOJI } from '~/utils/emojis'
import AppAdminSubNav from '~/components/app/AdminSubNav.vue'
import { retryQueryExceptAuth } from '~/utils/query'

definePageMeta({ middleware: ['admin'] })

useHead({
  title: 'Utilisateurs — Back-office YumiScan',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

const { user } = useAuth()
const { isAdmin, loading: adminLoading } = useAdmin()
const { adminUsersList, adminSendPasswordReset, adminDeleteUser } = useEdgeFunctions()

const page = ref(1)
const perPage = 50
const searchQuery = ref('')
const debouncedSearch = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null

watch(searchQuery, (val) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    debouncedSearch.value = val.trim()
    page.value = 1
  }, 300)
})

const feedbackMessage = ref<{ text: string; type: 'success' | 'error' } | null>(null)

function setFeedback(text: string, type: 'success' | 'error' = 'success') {
  feedbackMessage.value = { text, type }
  setTimeout(() => { feedbackMessage.value = null }, 4000)
}

const { data: listData, isLoading, error, refetch } = useQuery({
  queryKey: ['admin-users-list', page, debouncedSearch],
  queryFn: () => adminUsersList({ page: page.value, perPage, search: debouncedSearch.value }),
  enabled: computed(() => !!user.value && isAdmin.value === true && !adminLoading.value),
  retry: retryQueryExceptAuth,
})

const errorMessage = computed(() => error.value instanceof Error ? error.value.message : '')

const users = computed(() => listData.value?.users ?? [])
const total = computed(() => listData.value?.total ?? 0)
const totalPages = computed(() => computeTotalPages(total.value, perPage))

const resetLinkLoading = ref<string | null>(null)
const deleteTarget = ref<AdminUserListItem | null>(null)
const deleteLoading = ref(false)

async function writeClipboard(text: string) {
  if (!text || !navigator?.clipboard?.writeText) {
    throw new Error('Le presse-papier n est pas disponible sur cet appareil.')
  }
  await navigator.clipboard.writeText(text)
}

async function handleSendReset(user: AdminUserListItem) {
  if (!user.email) return
  resetLinkLoading.value = user.id
  try {
    const res = await adminSendPasswordReset({ user_id: user.id })
    setFeedback(res.message ?? 'Email de réinitialisation envoyé à l’utilisateur.')
  } catch (e) {
    setFeedback((e as Error).message, 'error')
  } finally {
    resetLinkLoading.value = null
  }
}

async function copyEmail(user: AdminUserListItem) {
  if (!user.email) return
  try {
    await writeClipboard(user.email)
    setFeedback('Email copié dans le presse-papier.')
  } catch {
    setFeedback('Impossible de copier l’email sur cet appareil.', 'error')
  }
}

function openDeleteConfirm(user: AdminUserListItem) {
  deleteTarget.value = user
}

function closeDeleteConfirm() {
  if (!deleteLoading.value) deleteTarget.value = null
}

function closeDeleteConfirmAfterSuccess() {
  deleteTarget.value = null
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleteLoading.value = true
  try {
    await adminDeleteUser(deleteTarget.value.id)
    setFeedback('Utilisateur supprimé.')
    closeDeleteConfirmAfterSuccess()
    await refetch()
  } catch (e) {
    setFeedback((e as Error).message, 'error')
  } finally {
    deleteLoading.value = false
  }
}

</script>

<template>
  <div class="min-h-screen flex flex-col bg-background pt-4 pb-24 md:pt-20 md:pb-0">
    <main id="main-content" class="flex-1 container mx-auto px-4 py-8 max-w-lg">
      <div class="flex items-center gap-2 mb-6">
        <PhShieldCheck :size="24" weight="duotone" class="text-primary" />
        <h1 class="text-xl font-black font-heading tracking-tight uppercase">Back-office</h1>
      </div>

      <AppAdminSubNav current="users" />

      <div
        v-if="feedbackMessage"
        class="bold-card--static p-3 mb-4 text-sm font-bold flex items-start gap-2"
        :class="feedbackMessage.type === 'error' ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300' : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'"
        style="border: 2px solid var(--bold-border-color); border-radius: var(--bold-radius);"
      >
        <AppEmoji :name="feedbackMessage.type === 'success' ? APP_EMOJI.success : APP_EMOJI.loginError" :size="22" class="shrink-0" />
        <span>{{ feedbackMessage.text }}</span>
      </div>

      <div v-if="error" class="bold-card--static p-4 mb-4 border-red-200 bg-red-50 dark:bg-red-950/30 flex items-start gap-2" style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius);">
        <AppEmoji :name="APP_EMOJI.scanError" :size="28" class="shrink-0" />
        <p class="text-sm font-bold text-red-700 dark:text-red-300">{{ errorMessage }}</p>
      </div>

      <div v-if="isLoading" class="flex items-center justify-center py-12" aria-busy="true">
        <PhSpinnerGap class="h-8 w-8 animate-spin text-primary" />
      </div>

      <div v-else class="space-y-4">
        <!-- Search input -->
        <div class="relative">
          <PhMagnifyingGlass :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Rechercher par email, nom ou prénom…"
            class="bold-input pl-9 text-sm"
          />
        </div>

        <div class="flex items-center justify-between">
          <p class="text-sm text-muted-foreground font-medium">
            {{ debouncedSearch ? `${users.length} résultat${users.length > 1 ? 's' : ''}` : `${total} utilisateur${total > 1 ? 's' : ''} au total` }}
          </p>
          <div v-if="totalPages > 1" class="flex gap-2">
            <button
              type="button"
              class="bold-btn bold-btn--secondary bold-btn--pill text-sm px-3 py-1.5"
              :disabled="page <= 1"
              @click="page = Math.max(1, page - 1)"
            >
              Préc.
            </button>
            <span class="text-xs font-bold self-center">{{ page }} / {{ totalPages }}</span>
            <button
              type="button"
              class="bold-btn bold-btn--secondary bold-btn--pill text-sm px-3 py-1.5"
              :disabled="page >= totalPages"
              @click="page = Math.min(totalPages, page + 1)"
            >
              Suiv.
            </button>
          </div>
        </div>

        <div v-if="users.length === 0" class="bold-card--static p-8 text-center" style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius);">
          <AppEmoji :name="APP_EMOJI.emptyScan" :size="48" class="mx-auto opacity-70 mb-2" />
          <p class="text-sm font-bold text-muted-foreground">{{ debouncedSearch ? 'Aucun utilisateur trouvé.' : 'Aucun autre utilisateur (hors vous).' }}</p>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="u in users"
            :key="u.id"
            class="bold-card--static p-3 flex flex-col gap-2"
            style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius); box-shadow: var(--bold-shadow-sm);"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0 flex-1">
                <p class="text-sm font-black font-heading truncate">{{ u.email ?? 'Sans email' }}</p>
                <p class="text-xs text-muted-foreground">{{ displayName({ first_name: u.first_name, last_name: u.last_name }) }}</p>
                <p class="text-[11px] text-muted-foreground/80 mt-0.5">{{ formatDateList(u.created_at) }} · {{ u.scans_count }} scan{{ u.scans_count > 1 ? 's' : '' }}</p>
              </div>
              <div class="flex flex-wrap gap-1 shrink-0">
                <button
                  type="button"
                  class="p-2 rounded-lg hover:bg-muted/60 transition-colors"
                  title="Copier l'email"
                  :disabled="!u.email"
                  @click="copyEmail(u)"
                >
                  <PhCopy :size="16" class="text-muted-foreground" />
                </button>
                <a
                  v-if="u.email"
                  :href="`mailto:${u.email}`"
                  class="p-2 rounded-lg hover:bg-muted/60 transition-colors"
                  title="Ouvrir mailto"
                >
                  <PhEnvelopeSimple :size="16" class="text-muted-foreground" />
                </a>
                <button
                  type="button"
                  class="p-2 rounded-lg hover:bg-muted/60 transition-colors"
                  title="Envoyer lien réinit MDP"
                  :disabled="!u.email || resetLinkLoading === u.id"
                  @click="handleSendReset(u)"
                >
                  <PhSpinnerGap v-if="resetLinkLoading === u.id" :size="16" class="animate-spin text-primary" />
                  <PhKey v-else :size="16" class="text-muted-foreground" />
                </button>
                <NuxtLink
                  :to="`/app/admin/users/${u.id}`"
                  class="p-2 rounded-lg hover:bg-muted/60 transition-colors"
                  title="Voir les scans"
                >
                  <PhList :size="16" class="text-muted-foreground" />
                </NuxtLink>
                <button
                  type="button"
                  class="p-2 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors"
                  title="Supprimer l'utilisateur"
                  @click="openDeleteConfirm(u)"
                >
                  <PhTrash :size="16" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <Teleport to="body">
      <Transition name="modal">
        <div v-if="deleteTarget" class="fixed inset-0 z-[100] flex items-center justify-center p-4" @click.self="closeDeleteConfirm">
          <div class="fixed inset-0 bg-black/60 backdrop-blur-sm" @click="closeDeleteConfirm" />
          <div
            class="relative z-10 w-full max-w-sm bg-card overflow-hidden animate-pop-in"
            style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius-lg); box-shadow: var(--bold-shadow-lg);"
          >
            <div class="px-6 pt-8 pb-2 text-center">
              <div class="w-14 h-14 flex items-center justify-center mx-auto mb-3 bg-red-500/10" style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius);">
                <AppEmoji :name="APP_EMOJI.destructiveWarning" :size="36" />
              </div>
              <h2 class="text-xl font-black font-heading tracking-tight mb-1">Supprimer cet utilisateur ?</h2>
              <p class="text-sm text-muted-foreground leading-relaxed">
                {{ deleteTarget?.email }} — Compte et données définitivement supprimés. Irréversible.
              </p>
            </div>
            <div class="px-6 pb-8 flex gap-3 justify-center">
              <button type="button" class="bold-btn flex-1" style="border: 2.5px solid var(--bold-border-color);" @click="closeDeleteConfirm">
                Annuler
              </button>
              <button type="button" class="bold-btn bold-btn--primary flex-1" :disabled="deleteLoading" @click="confirmDelete">
                <PhSpinnerGap v-if="deleteLoading" :size="18" class="animate-spin" />
                <PhTrash v-else :size="18" />
                Supprimer
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
