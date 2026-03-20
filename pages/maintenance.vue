<script setup lang="ts">
definePageMeta({
  layout: 'default',
})

useHead({
  title: 'Maintenance — YumiScan',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

const { t } = useI18n()
const { user } = useAuth()
const localePath = useLocalePath()
const supabase = useSupabase()
const maintenanceCache = useState<{ enabled: boolean; fetchedAt: number }>('maintenance-mode-cache', () => ({
  enabled: true,
  fetchedAt: 0,
}))

let intervalId: ReturnType<typeof setInterval> | null = null

async function refreshMaintenanceState() {
  const { data } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'maintenance_mode_enabled')
    .maybeSingle() as { data: { value: string } | null }

  const enabled = (data?.value?.trim().toLowerCase() ?? '') === 'true'
  maintenanceCache.value = {
    enabled,
    fetchedAt: Date.now(),
  }

  if (!enabled) {
    await navigateTo(user.value ? localePath('/app/dashboard') : localePath('/'))
  }
}

onMounted(() => {
  void refreshMaintenanceState()
  intervalId = setInterval(() => {
    void refreshMaintenanceState()
  }, 3_000)
})

onBeforeUnmount(() => {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
})
</script>

<template>
  <div class="min-h-screen bg-background">
    <main class="container mx-auto px-4 py-12 md:py-20 max-w-3xl">
      <section
        class="bold-card--static relative overflow-hidden p-6 md:p-8"
        style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius); box-shadow: var(--bold-shadow-lg);"
      >
        <div class="space-y-6">
          <div class="flex justify-center">
            <div
              class="w-24 h-24 md:w-28 md:h-28 rounded-full bg-white flex items-center justify-center"
              style="border: 2.5px solid var(--bold-border-color); box-shadow: var(--bold-shadow-lg);"
            >
              <img
                src="/images/logo-primary.png"
                alt="YumiScan"
                class="w-16 h-16 md:w-20 md:h-20 object-contain select-none"
              />
            </div>
          </div>

          <div class="flex justify-center">
            <div class="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-primary" style="border: 2px solid var(--bold-border-color); box-shadow: var(--bold-shadow-xs);">
              {{ t('common.maintenance.badge') }}
            </div>
          </div>

          <div class="space-y-3 text-center">
            <h1 class="text-3xl md:text-5xl font-black font-heading tracking-tight text-foreground">
              {{ t('common.maintenance.title') }}
            </h1>
            <p class="mx-auto text-base md:text-lg text-muted-foreground font-medium leading-relaxed max-w-2xl">
              {{ t('common.maintenance.description') }}
            </p>
          </div>

          <div class="rounded-[var(--bold-radius-sm)] bg-muted/20 p-4 md:p-5" style="border: 2px solid var(--bold-border-color); box-shadow: var(--bold-shadow-xs);">
            <p class="text-sm md:text-base text-foreground font-semibold leading-relaxed text-center">
              {{ t('common.maintenance.reassurance') }}
            </p>
          </div>

          <div class="flex justify-center">
            <NuxtLink
              :to="user ? localePath('/app/dashboard') : localePath('/login')"
              class="bold-btn bold-btn--primary inline-flex justify-center px-6 py-3"
            >
              {{ user ? t('common.maintenance.btn_admin') : t('common.maintenance.btn_login') }}
            </NuxtLink>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
