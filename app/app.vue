<script setup lang="ts">
const { public: { siteName } } = useRuntimeConfig()

useHead({
  titleTemplate: title => (title ? `${title} | ${siteName}` : siteName),
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
