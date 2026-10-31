<script setup lang="ts">
import type { Insight } from '~~/shared/types'

defineProps<{ insights: Insight[] }>()
</script>

<template>
  <ol class="insights">
    <li v-for="(insight, i) in insights" :key="insight.title">
      <span class="insight-index" aria-hidden="true">{{ String(i + 1).padStart(2, '0') }}</span>
      <div>
        <h3>{{ insight.title }}</h3>
        <p>{{ insight.text }}</p>
      </div>
    </li>
  </ol>
</template>
