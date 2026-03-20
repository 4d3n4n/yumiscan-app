/**
 * Métadonnées non traduisibles des articles de blog.
 * Les contenus éditoriaux restent dans les fichiers blog.json des locales.
 */
export interface BlogArticle {
  slug: string
  image: string
  date: string
  readTime: number
  tags: string[]
}

export const blogArticles: BlogArticle[] = [
  {
    slug: 'voyage-japon-allergies-guide-survie',
    image: '/images/blog/voyage-japon-allergies-guide-survie.webp',
    date: '2025-02-01',
    readTime: 9,
    tags: ['travel', 'food_allergies', 'japan', 'gluten_free', 'restaurants', 'konbini'],
  },
  {
    slug: 'konbinis-etiquettes-alimentaires-japon',
    image: '/images/blog/konbinis-etiquettes-alimentaires-japon.webp',
    date: '2025-02-08',
    readTime: 8,
    tags: ['konbini', 'labels', 'allergens', 'kanji', 'japan', 'food_safety'],
  },
  {
    slug: 'preparer-voyage-japon-snacks-sans-risque',
    image: '/images/blog/preparer-voyage-japon-snacks-sans-risque.webp',
    date: '2025-02-15',
    readTime: 8,
    tags: ['snacks', 'travel', 'japan', 'food_allergies', 'souvenirs', 'safety'],
  },
]

export function getArticleBySlug(slug: string): BlogArticle | undefined {
  return blogArticles.find((a) => a.slug === slug)
}
