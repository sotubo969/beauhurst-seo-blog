<script setup lang="ts">
import { formatMoney } from '~~/shared/format'

const props = defineProps<{
  title: string
  items: { name: string, value: number }[]
  currency: string
}>()

const ROW = 34
const LABEL = 150
const WIDTH = 640
const max = computed(() => Math.max(...props.items.map(i => i.value), 1))
const height = computed(() => props.items.length * ROW + 8)
const barWidth = (value: number) => Math.max(2, (value / max.value) * (WIDTH - LABEL - 80))
const id = useId()
</script>

<template>
  <figure class="chart-card">
    <figcaption :id="`${id}-title`">{{ title }}</figcaption>
    <svg
      :viewBox="`0 0 ${WIDTH} ${height}`"
      role="img"
      :aria-labelledby="`${id}-title ${id}-desc`"
      class="leader-chart"
      preserveAspectRatio="xMinYMin meet"
    >
      <desc :id="`${id}-desc`">{{ items.map(i => `${i.name}: ${formatMoney(i.value, currency)}`).join('; ') }}</desc>
      <g v-for="(item, i) in items" :key="item.name" :transform="`translate(0, ${i * ROW + 4})`">
        <text x="0" :y="ROW / 2" dominant-baseline="middle" class="leader-name">
          {{ item.name.length > 20 ? `${item.name.slice(0, 19)}…` : item.name }}
        </text>
        <rect :x="LABEL" :y="ROW / 2 - 9" :width="barWidth(item.value)" height="18" rx="3" :class="i === 0 ? 'bar-lead' : 'bar'" />
        <text :x="LABEL + barWidth(item.value) + 8" :y="ROW / 2" dominant-baseline="middle" class="leader-value">
          {{ formatMoney(item.value, currency) }}
        </text>
      </g>
    </svg>
  </figure>
</template>
