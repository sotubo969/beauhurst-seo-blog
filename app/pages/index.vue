<script setup lang="ts">
import { titleCase } from '~~/shared/format'

const { data: blogs } = await useFetch('/api/blogs')

useSeoMeta({
  title: 'Company rankings and sector insights',
  description: 'Data-led rankings of the top UK companies by sector, with statistics and analysis on funding, location and growth stage.',
})
</script>

<template>
  <div>
    <section class="home-hero">
      <div class="container">
        <p class="eyebrow">Insights</p>
        <h1>Company rankings and sector insights</h1>
        <p class="lead">
          Data-led rankings of the UK's leading private companies, with the statistics behind each sector.
        </p>
      </div>
    </section>

    <div class="container page">
      <ul v-if="blogs?.length" class="card-list">
        <li v-for="blog in blogs" :key="blog.slug" class="card">
          <p class="eyebrow">{{ titleCase(blog.industry) }}</p>
          <h2><NuxtLink :to="`/blog/${blog.slug}`" class="card-link">{{ blog.title }}</NuxtLink></h2>
          <p class="card-text">{{ blog.metaDescription }}</p>
          <dl class="card-stats">
            <div><dt>Companies</dt><dd>{{ blog.count }}</dd></div>
            <div v-if="blog.total"><dt>Combined</dt><dd>{{ blog.total }}</dd></div>
            <div v-if="blog.topName"><dt>Ranked first</dt><dd>{{ blog.topName }}</dd></div>
          </dl>
          <p class="muted small">
            <time :datetime="blog.createdAt">{{ new Date(blog.createdAt).toLocaleDateString('en-GB', { dateStyle: 'long' }) }}</time>
          </p>
        </li>
      </ul>

      <div v-else class="empty">
        <h2>No articles yet</h2>
        <p class="muted">Upload a company dataset to publish the first ranking.</p>
        <NuxtLink to="/upload" class="button">Create an article</NuxtLink>
      </div>
    </div>
  </div>
</template>
