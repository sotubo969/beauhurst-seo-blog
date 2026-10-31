<script setup lang="ts">
import { formatMoney, formatPercent, slugify } from '~~/shared/format'

const route = useRoute()
const { public: { siteUrl, siteName } } = useRuntimeConfig()

const { data: blog } = await useFetch(`/api/blogs/${route.params.slug}`)
if (!blog.value) {
  throw createError({ statusCode: 404, statusMessage: 'Blog not found', fatal: true })
}

const b = blog.value
const url = `${siteUrl.replace(/\/$/, '')}/blog/${b.slug}`
const money = (n: number) => formatMoney(n, b.stats.currency)
const published = new Date(b.createdAt)
const nameKey = b.columns.find(c => c.role === 'name')!.key

const statCards = computed(() => {
  const s = b.stats
  const cards = [{ label: 'Companies ranked', value: String(s.count) }]
  if (s.valueColumn && s.top) {
    cards.push(
      { label: `Combined ${s.valueColumn.toLowerCase()}`, value: money(s.total) },
      { label: 'Median per company', value: money(s.median) },
      { label: `Share held by the top 10`, value: formatPercent(s.top10Share) },
    )
  }
  return cards
})

const toc = computed(() => [
  ...b.copy.sections.map(s => ({ id: slugify(s.heading), text: s.heading })),
  { id: 'key-statistics', text: 'Key statistics' },
  { id: 'ranking', text: `Full ranking of the top ${b.stats.count}` },
  ...(b.copy.faq.length ? [{ id: 'faq', text: 'Frequently asked questions' }] : []),
])

useSeoMeta({
  title: b.copy.title,
  description: b.copy.metaDescription,
  keywords: b.copy.keywords.join(', '),
  ogType: 'article',
  ogTitle: b.copy.title,
  ogDescription: b.copy.metaDescription,
  ogUrl: url,
  ogSiteName: siteName,
  twitterCard: 'summary',
  twitterTitle: b.copy.title,
  twitterDescription: b.copy.metaDescription,
  articlePublishedTime: b.createdAt,
})

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Article',
      headline: b.copy.title,
      description: b.copy.metaDescription,
      datePublished: b.createdAt,
      dateModified: b.createdAt,
      mainEntityOfPage: url,
      keywords: b.copy.keywords.join(', '),
      publisher: { '@type': 'Organization', name: siteName },
    },
    {
      '@type': 'ItemList',
      name: b.copy.title,
      numberOfItems: b.rows.length,
      itemListElement: b.rows.slice(0, 100).map((row, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: row[nameKey],
      })),
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Blogs', item: `${siteUrl.replace(/\/$/, '')}/` },
        { '@type': 'ListItem', position: 2, name: b.copy.title, item: url },
      ],
    },
    ...(b.copy.faq.length
      ? [{
          '@type': 'FAQPage',
          mainEntity: b.copy.faq.map(f => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: f.answer },
          })),
        }]
      : []),
  ],
}

useHead({
  link: [{ rel: 'canonical', href: url }],
  script: [{ type: 'application/ld+json', innerHTML: JSON.stringify(jsonLd) }],
})
</script>

<template>
  <article v-if="blog" class="container page article">
    <nav aria-label="Breadcrumb" class="breadcrumb">
      <NuxtLink to="/">Blogs</NuxtLink> <span aria-hidden="true">/</span> <span>{{ blog.industry }}</span>
    </nav>

    <header>
      <h1>{{ blog.copy.title }}</h1>
      <p class="muted small">
        Published <time :datetime="blog.createdAt">{{ published.toLocaleDateString('en-GB', { dateStyle: 'long' }) }}</time>
        · Based on data for {{ blog.stats.count }} companies
      </p>
      <p v-for="(p, i) in blog.copy.intro" :key="i" :class="{ lead: i === 0 }">{{ p }}</p>
    </header>

    <StatCards :cards="statCards" />

    <nav class="toc" aria-labelledby="toc-heading">
      <h2 id="toc-heading">In this article</h2>
      <ol>
        <li v-for="item in toc" :key="item.id"><a :href="`#${item.id}`">{{ item.text }}</a></li>
      </ol>
    </nav>

    <section v-for="section in blog.copy.sections" :id="slugify(section.heading)" :key="section.heading">
      <h2>{{ section.heading }}</h2>
      <p v-for="(p, i) in section.paragraphs" :key="i">{{ p }}</p>
    </section>

    <section id="key-statistics">
      <h2>Key statistics</h2>
      <dl v-if="blog.stats.top" class="facts">
        <div><dt>Ranked first</dt><dd>{{ blog.stats.top.name }} ({{ money(blog.stats.top.value) }})</dd></div>
        <div><dt>Average {{ blog.stats.valueColumn?.toLowerCase() }}</dt><dd>{{ money(blog.stats.mean) }}</dd></div>
        <div><dt>Top 10 combined</dt><dd>{{ money(blog.stats.top10Total) }}</dd></div>
        <div><dt>Entry point to the list</dt><dd>{{ money(blog.stats.bottom!.value) }}</dd></div>
      </dl>

      <div class="chart-grid">
        <BarChart
          v-for="breakdown in blog.stats.breakdowns"
          :key="breakdown.column"
          :title="`Companies by ${breakdown.column.toLowerCase()}`"
          :items="breakdown.items.map(i => ({ label: i.label, value: i.count, note: formatPercent(i.share) }))"
        />
        <BarChart
          v-if="blog.stats.tags"
          :title="`Most common ${blog.stats.tags.column.toLowerCase()}`"
          :items="blog.stats.tags.items.map(i => ({ label: i.label, value: i.count }))"
        />
      </div>
    </section>

    <section id="ranking">
      <h2>Full ranking of the top {{ blog.stats.count }} {{ blog.industry }} companies</h2>
      <RankingTable :columns="blog.columns" :rows="blog.rows" />
    </section>

    <section v-if="blog.copy.faq.length" id="faq">
      <h2>Frequently asked questions</h2>
      <div v-for="item in blog.copy.faq" :key="item.question" class="faq-item">
        <h3>{{ item.question }}</h3>
        <p>{{ item.answer }}</p>
      </div>
    </section>

    <aside class="methodology">
      <h2>Methodology</h2>
      <p>
        Statistics and the ranking table are calculated directly from the source dataset
        ({{ blog.sourceFile }}){{ blog.stats.valueColumn ? `, ranked by ${blog.stats.valueColumn.toLowerCase()}` : '' }}.
        The written copy was drafted by {{ blog.generatedBy === 'template' ? 'a rules-based template' : 'an AI model' }} using only those figures.
      </p>
    </aside>
  </article>
</template>
