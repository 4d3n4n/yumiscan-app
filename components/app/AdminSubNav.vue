<script setup lang="ts">
/**
 * Sous-navigation du back-office admin (Tableau de bord / Utilisateurs).
 * Style aligné sur le reste de l'app (bold pills).
 */
defineProps<{
  current: 'dashboard' | 'users' | 'settings'
}>()

const localePath = useLocalePath()
const warmedPaths = new Set<string>()

async function warmRoute(path: string) {
  if (typeof window === 'undefined' || typeof preloadRouteComponents !== 'function') return
  if (warmedPaths.has(path)) return

  warmedPaths.add(path)

  try {
    await preloadRouteComponents(path)
  } catch {
    warmedPaths.delete(path)
  }
}

onMounted(() => {
  for (const path of [
    localePath('/app/admin'),
    localePath('/app/admin/users'),
    localePath('/app/admin/settings'),
  ]) {
    void warmRoute(path)
  }
})
</script>

<template>
  <nav class="flex gap-2 mb-6 overflow-x-auto no-scrollbar py-2">
    <NuxtLink
      to="/app/admin"
      :class="[
        'shrink-0 px-4 py-2 text-sm font-bold transition-all duration-150',
        current === 'dashboard' ? 'bg-primary text-white' : 'bg-card text-foreground hover:bg-muted/50',
      ]"
      style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius-pill); box-shadow: var(--bold-shadow-xs);"
    >
      Tableau de bord
    </NuxtLink>
    <NuxtLink
      to="/app/admin/users"
      :class="[
        'shrink-0 px-4 py-2 text-sm font-bold transition-all duration-150',
        current === 'users' ? 'bg-primary text-white' : 'bg-card text-foreground hover:bg-muted/50',
      ]"
      style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius-pill); box-shadow: var(--bold-shadow-xs);"
    >
      Utilisateurs
    </NuxtLink>
    <NuxtLink
      to="/app/admin/settings"
      :class="[
        'shrink-0 px-4 py-2 text-sm font-bold transition-all duration-150',
        current === 'settings' ? 'bg-primary text-white' : 'bg-card text-foreground hover:bg-muted/50',
      ]"
      style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius-pill); box-shadow: var(--bold-shadow-xs);"
    >
      Entreprise
    </NuxtLink>
  </nav>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
