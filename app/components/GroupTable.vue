<script setup lang="ts">
import type { GroupStat } from '~~/shared/types'
import { formatMoney, formatPercent } from '~~/shared/format'

defineProps<{
  caption: string
  label: string
  items: GroupStat[]
  currency: string
  valueLabel: string | null
}>()
</script>

<template>
  <div class="table-scroll">
    <table class="group-table">
      <caption>{{ caption }}</caption>
      <thead>
        <tr>
          <th scope="col">{{ label }}</th>
          <th scope="col" class="num">Companies</th>
          <th scope="col" class="num">Share</th>
          <template v-if="valueLabel">
            <th scope="col" class="num">Total {{ valueLabel.toLowerCase() }}</th>
            <th scope="col" class="num">Average</th>
          </template>
          <th scope="col">Highest ranked</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.label">
          <th scope="row">{{ item.label }}</th>
          <td class="num">{{ item.count }}</td>
          <td class="num">{{ formatPercent(item.share) }}</td>
          <template v-if="valueLabel">
            <td class="num">{{ formatMoney(item.value, currency) }}</td>
            <td class="num">{{ formatMoney(item.average, currency) }}</td>
          </template>
          <td>{{ item.leader }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
