<script setup lang="ts">
const { data: blogs } = await useFetch('/api/blogs')

useSeoMeta({
  title: 'Company rankings and industry insights',
  description: 'Data-led rankings of the top UK companies by industry, with statistics and insights on funding, location and growth stage.',
})
</script>

<template>
  <div class="container page">
    <h1>Company rankings and industry insights</h1>
    <p class="lead">
      Each post ranks the leading companies in a sector and pulls out the key statistics from the data.
    </p>

    <ul v-if="blogs?.length" class="card-list">
      <li v-for="blog in blogs" :key="blog.slug" class="card">
        <h2><NuxtLink :to="`/blog/${blog.slug}`">{{ blog.title }}</NuxtLink></h2>
        <p>{{ blog.metaDescription }}</p>
        <p class="muted small">
          {{ blog.count }} companies ·
          <time :datetime="blog.createdAt">{{ new Date(blog.createdAt).toLocaleDateString('en-GB', { dateStyle: 'long' }) }}</time>
        </p>
      </li>
    </ul>

    <div v-else class="empty">
      <p>No blogs yet.</p>
      <NuxtLink to="/upload" class="button">Upload a CSV to create one</NuxtLink>
    </div>
  </div>
</template>
