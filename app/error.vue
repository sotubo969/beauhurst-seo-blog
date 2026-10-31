<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const notFound = props.error.statusCode === 404

useSeoMeta({ title: notFound ? 'Page not found' : 'Something went wrong', robots: 'noindex' })
</script>

<template>
  <NuxtLayout>
    <div class="container page narrow error-page">
      <p class="eyebrow">Error {{ error.statusCode }}</p>
      <h1>{{ notFound ? 'We couldn’t find that page' : 'Something went wrong' }}</h1>
      <p class="lead">{{ notFound ? 'The article may have been moved or never existed.' : error.statusMessage }}</p>
      <button class="button" type="button" @click="clearError({ redirect: '/' })">Back to all insights</button>
    </div>
  </NuxtLayout>
</template>
