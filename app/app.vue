<script setup lang="ts">
const { public: { siteName } } = useRuntimeConfig()

useHead({
  titleTemplate: title => (title ? `${title} | ${siteName}` : siteName),
})
</script>

<template>
  <div class="site">
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header">
      <div class="container header-inner">
        <NuxtLink to="/" class="brand">{{ siteName }}</NuxtLink>
        <nav aria-label="Main">
          <NuxtLink to="/">Blogs</NuxtLink>
          <NuxtLink to="/upload" class="button button-small">New blog</NuxtLink>
        </nav>
      </div>
    </header>

    <main id="main">
      <NuxtPage />
    </main>

    <footer class="site-footer">
      <div class="container">
        Rankings generated from company datasets. Copy written with AI and checked against the data.
      </div>
    </footer>
  </div>
</template>
