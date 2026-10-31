<script setup lang="ts">
const { public: { siteName } } = useRuntimeConfig()
</script>

<template>
  <div class="site">
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header">
      <div class="container header-inner">
        <NuxtLink to="/" class="brand">
          <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="currentColor" /><path d="M8 22V10h3v12zm6.5 0V14h3v8zM21 22v-5h3v5z" fill="#fff" /></svg>
          {{ siteName }}
        </NuxtLink>
        <nav aria-label="Main">
          <NuxtLink to="/">Insights</NuxtLink>
          <NuxtLink to="/upload" class="button button-small">Create article</NuxtLink>
        </nav>
      </div>
    </header>

    <main id="main">
      <slot />
    </main>

    <footer class="site-footer">
      <div class="container footer-inner">
        <span>© {{ new Date().getFullYear() }} {{ siteName }}</span>
        <span>Figures are calculated from the source data for each ranking.</span>
      </div>
    </footer>
  </div>
</template>
