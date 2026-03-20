<script setup lang="ts">
import { PhCaretLeft, PhCaretRight } from '@phosphor-icons/vue'
import { blogArticles } from '~/data/blog'
import homeSections from '~/assets/css/home-sections.module.css'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const localePath = useLocalePath()

const latestArticles = computed(() => blogArticles.slice(0, 3))
const blogIndex = ref(0)
let blogInterval: ReturnType<typeof setInterval> | null = null

const nextBlog = () => {
  blogIndex.value = (blogIndex.value + 1) % latestArticles.value.length
}
const prevBlog = () => {
  blogIndex.value = (blogIndex.value - 1 + latestArticles.value.length) % latestArticles.value.length
}

const startAutoBlog = () => {
  if (blogInterval) clearInterval(blogInterval)
  blogInterval = setInterval(nextBlog, 6000)
}
const stopAutoBlog = () => {
  if (blogInterval) {
    clearInterval(blogInterval)
    blogInterval = null
  }
}

onMounted(() => startAutoBlog())
onUnmounted(() => stopAutoBlog())
</script>

<template>
  <section>
    <h2 :class="homeSections.sectionTitle">{{ t('home.blog.title') }}</h2>

    <div
      :class="homeSections.carouselWrapper"
      @mouseenter="stopAutoBlog"
      @mouseleave="startAutoBlog"
    >
      <button
        :class="homeSections.carouselBtn"
        @click="prevBlog"
        :aria-label="t('home.blog_section.btn_prev')"
      >
        <PhCaretLeft :size="18" weight="bold" />
      </button>

      <div :class="homeSections.carouselViewport">
        <div
          :class="homeSections.carouselTrack"
          :style="{ transform: `translateX(-${blogIndex * 100}%)` }"
        >
          <div
            v-for="article in latestArticles"
            :key="article.slug"
            :class="homeSections.carouselSlide"
            class=" !px-4 md:!px-6 !bg-transparent !border-0 !shadow-none overflow-visible flex items-center justify-center py-4 md:py-6"
          >
            <BlogArticleCard :article="article" class="h-full w-full max-w-md" />
          </div>
        </div>
      </div>

      <button
        :class="homeSections.carouselBtn"
        @click="nextBlog"
        :aria-label="t('home.blog_section.btn_next')"
      >
        <PhCaretRight :size="18" weight="bold" />
      </button>
    </div>

    <div :class="homeSections.carouselDots" class="mt-4">
      <button
        v-for="(_, i) in latestArticles"
        :key="'blog-dot-' + i"
        :class="[homeSections.carouselDot, blogIndex === i ? homeSections.carouselDotActive : '']"
        @click="blogIndex = i"
        :aria-label="t('home.blog_section.btn_dot', { numero: i + 1 })"
      />
    </div>

    <div class="mt-6 flex justify-center">
      <NuxtLink
        :to="localePath('/blog')"
        class="bold-btn bold-btn--secondary bold-btn--pill bold-btn--sm"
      >
        {{ t('home.blog.cta_all') }}
      </NuxtLink>
    </div>
  </section>
</template>
