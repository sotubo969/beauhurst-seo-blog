import type { Blog, BlogSummary } from '~~/shared/types'

// Blogs are saved as JSON through Nitro storage (mounted on ./data/blogs in nuxt.config).
// New uploads show up straight away because pages read from storage at request time.
const store = () => useStorage<Blog>('blogs')

export const getBlog = (slug: string) => store().getItem(`${slug}.json`)

export const saveBlog = (blog: Blog) => store().setItem(`${blog.slug}.json`, blog)

export async function blogExists(slug: string) {
  return store().hasItem(`${slug}.json`)
}

export async function listBlogs(): Promise<BlogSummary[]> {
  const keys = (await store().getKeys()).filter(k => k.endsWith('.json'))
  const blogs = await Promise.all(keys.map(k => store().getItem(k)))

  return blogs
    .filter((b): b is Blog => !!b)
    .map(b => ({
      slug: b.slug,
      industry: b.industry,
      createdAt: b.createdAt,
      generatedBy: b.generatedBy,
      title: b.copy.title,
      metaDescription: b.copy.metaDescription,
      count: b.stats.count,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
