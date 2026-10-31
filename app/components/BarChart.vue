<script setup lang="ts">
const props = defineProps<{
  title: string
  items: { label: string, value: number, note?: string }[]
}>()

const max = computed(() => Math.max(...props.items.map(i => i.value), 1))
</script>

<template>
  <figure class="chart-card bar-chart">
    <figcaption>{{ title }}</figcaption>
    <ul>
      <li v-for="item in items" :key="item.label">
        <span class="bar-label" :title="item.label">{{ item.label }}</span>
        <span class="bar-track" aria-hidden="true">
          <span class="bar-fill" :style="{ width: `${(item.value / max) * 100}%` }" />
        </span>
        <span class="bar-value">{{ item.value }}<template v-if="item.note"> <span class="muted">· {{ item.note }}</span></template></span>
      </li>
    </ul>
  </figure>
</template>
