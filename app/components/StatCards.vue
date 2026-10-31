<script setup lang="ts">
defineProps<{ cards: { label: string, value: string }[] }>()
</script>

<template>
  <ul class="stat-cards">
    <li v-for="card in cards" :key="card.label">
      <span class="stat-value">{{ card.value }}</span>
      <span class="stat-label">{{ card.label }}</span>
    </li>
  </ul>
</template>
