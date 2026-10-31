<script setup lang="ts">
import { formatMoney, formatPercent, slugify, titleCase } from '~~/shared/format'

const route = useRoute()
const { public: { siteUrl, siteName } } = useRuntimeConfig()

const { data: blog } = await useFetch(`/api/blogs/${route.params.slug}`)
if (!blog.value) {
  throw createError({ statusCode: 404, statusMessage: 'Blog not found', fatal: true })
}

const b = blog.value
const base = siteUrl.replace(/\/$/, '')
const url = `${base}/blog/${b.slug}`
const money = (n: number) => formatMoney(n, b.stats.currency)
const publishedLabel = new Date(b.createdAt).toLocaleDateString('en-GB', { dateStyle: 'long' })
const nameKey = b.columns.find(c => c.role === 'name')!.key
const metric = b.stats.valueColumn

const statCards = [
  { label: 'Companies ranked', value: String(b.stats.count) },
  ...(metric && b.stats.top
    ? [
        { label: `Combined ${metric.toLowerCase()}`, value: money(b.stats.total) },
        { label: 'Median per company', value: money(b.stats.median) },
        { label: 'Held by the top 10', value: formatPercent(b.stats.top10Share) },
      ]
    : []),
]

// Breakdowns with a single value carry no comparison, so they are covered in the copy rather than charted
const breakdowns = b.stats.breakdowns.filter(x => x.items.length > 1)

const toc = [
  { id: 'key-findings', text: 'Key findings' },
  ...b.copy.sections.map(s => ({ id: slugify(s.heading), text: s.heading })),
  { id: 'statistics', text: 'Statistics in detail' },
  { id: 'ranking', text: 'Full ranking' },
  ...(b.copy.faq.length ? [{ id: 'faq', text: 'FAQs' }] : []),
  { id: 'methodology', text: 'Methodology' },
]

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
  articleSection: titleCase(b.industry),
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
      articleSection: titleCase(b.industry),
      keywords: b.copy.keywords.join(', '),
      publisher: { '@type': 'Organization', name: siteName },
    },
    {
      '@type': 'ItemList',
      name: b.copy.title,
      numberOfItems: b.rows.length,
      itemListOrder: 'https://schema.org/ItemListOrderAscending',
      itemListElement: b.rows.map((row, i) => ({ '@type': 'ListItem', position: i + 1, name: row[nameKey] })),
    },
    {
      '@type': 'Dataset',
      name: `${b.copy.title} dataset`,
      description: b.copy.metaDescription,
      url,
      variableMeasured: metric ?? undefined,
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Insights', item: `${base}/` },
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
  <article v-if="blog" class="article">
    <header class="article-hero">
      <div class="container">
        <nav aria-label="Breadcrumb" class="breadcrumb">
          <ol>
            <li><NuxtLink to="/">Insights</NuxtLink></li>
            <li aria-current="page">{{ titleCase(blog.industry) }}</li>
          </ol>
        </nav>
        <p class="eyebrow">{{ titleCase(blog.industry) }} · Company ranking</p>
        <h1>{{ blog.copy.title }}</h1>
        <p class="article-meta">
          Published <time :datetime="blog.createdAt">{{ publishedLabel }}</time>
          <span aria-hidden="true">·</span> {{ blog.stats.count }} companies analysed
          <template v-if="metric"><span aria-hidden="true">·</span> Ranked by {{ metric.toLowerCase() }}</template>
        </p>
        <StatCards :cards="statCards" />
      </div>
    </header>

    <div class="container article-layout">
      <aside class="toc" aria-labelledby="toc-heading">
        <h2 id="toc-heading">On this page</h2>
        <ol>
          <li v-for="item in toc" :key="item.id"><a :href="`#${item.id}`">{{ item.text }}</a></li>
        </ol>
      </aside>

      <div class="article-body">
        <div class="prose">
          <p v-for="(p, i) in blog.copy.intro" :key="i" :class="{ lead: i === 0 }">{{ p }}</p>
        </div>

        <section v-if="blog.insights.length" id="key-findings">
          <h2>Key findings</h2>
          <InsightCards :insights="blog.insights.slice(0, 6)" />
        </section>

        <section v-for="section in blog.copy.sections" :id="slugify(section.heading)" :key="section.heading" class="prose">
          <h2>{{ section.heading }}</h2>
          <p v-for="(p, i) in section.paragraphs" :key="i">{{ p }}</p>
        </section>

        <section id="statistics">
          <h2>Statistics in detail</h2>
          <div class="chart-grid">
            <LeaderChart
              v-if="blog.stats.leaders.length"
              class="span-2"
              :title="`Top 10 by ${metric?.toLowerCase()}`"
              :items="blog.stats.leaders"
              :currency="blog.stats.currency"
            />
            <BarChart
              v-if="blog.stats.distribution.length"
              :title="`Companies by ${metric?.toLowerCase()} band`"
              :items="blog.stats.distribution.map(d => ({ label: d.label, value: d.count }))"
            />
            <BarChart
              v-if="blog.stats.tags"
              :title="`Most common ${blog.stats.tags.column.toLowerCase()}`"
              :items="blog.stats.tags.items.slice(0, 8).map(i => ({ label: i.label, value: i.count }))"
            />
          </div>

          <GroupTable
            v-for="breakdown in breakdowns"
            :key="breakdown.column"
            :caption="`${titleCase(blog.industry)} companies by ${breakdown.column.toLowerCase()}`"
            :label="breakdown.column"
            :items="breakdown.items"
            :currency="blog.stats.currency"
            :value-label="metric"
          />
        </section>

        <section id="ranking">
          <h2>Full ranking: top {{ blog.stats.count }} {{ titleCase(blog.industry) }} companies</h2>
          <RankingTable :columns="blog.columns" :rows="blog.rows" :filename="`${blog.slug}.csv`" />
        </section>

        <section v-if="blog.copy.faq.length" id="faq" class="prose">
          <h2>Frequently asked questions</h2>
          <details v-for="(item, i) in blog.copy.faq" :key="item.question" class="faq-item" :open="i === 0">
            <summary><h3>{{ item.question }}</h3></summary>
            <p>{{ item.answer }}</p>
          </details>
        </section>

        <section id="methodology" class="methodology">
          <h2>Methodology</h2>
          <p>
            Rankings, statistics, charts and key findings are calculated directly from the source dataset
            ({{ blog.sourceFile }}, {{ blog.stats.count }} rows){{ metric ? `, ordered by ${metric.toLowerCase()}` : '' }}.
            <template v-if="metric">
              The Gini coefficient ({{ blog.stats.gini.toFixed(2) }}) measures how evenly {{ metric.toLowerCase() }}
              is spread, from 0 (perfectly even) to 1 (held by a single company).
            </template>
          </p>
          <p v-if="blog.review.mode === 'ai'">
            The narrative was drafted with a language model from the verified figures above. Every number in the
            draft was checked against the dataset; {{ blog.review.checkedClaims }} passages were checked and
            {{ blog.review.rejected.length }} were removed because a figure could not be verified.
          </p>
          <p v-else>The narrative was written by our rules-based editorial engine from the figures above.</p>
        </section>
      </div>
    </div>
  </article>
</template>
