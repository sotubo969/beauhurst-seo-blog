<script setup lang="ts">
import type { ColumnInfo } from '~~/shared/types'

const props = defineProps<{
  columns: ColumnInfo[]
  rows: Record<string, string>[]
}>()

const find = (role: ColumnInfo['role']) => props.columns.find(c => c.role === role)?.key
const rankKey = find('rank')
const nameKey = find('name')!
const urlKey = find('url')
const descKey = find('description')
const valueKey = find('value')
const extraKeys = props.columns.filter(c => c.role === 'category' || c.role === 'other').map(c => c.key)

const query = ref('')
// The full table is server-rendered for crawlers; filtering only hides rows on the client.
const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.rows
  return props.rows.filter(row => Object.values(row).some(v => v.toLowerCase().includes(q)))
})

const href = (raw?: string) => (raw && !/^https?:\/\//i.test(raw) ? `https://${raw}` : raw)
</script>

<template>
  <div class="ranking">
    <label class="table-search">
      <span class="visually-hidden">Filter companies</span>
      <input v-model="query" type="search" placeholder="Filter by name, region, stage…">
    </label>

    <div class="table-scroll" tabindex="0" role="region" aria-label="Company ranking table">
      <table>
        <thead>
          <tr>
            <th scope="col" class="num">{{ rankKey ?? 'Rank' }}</th>
            <th scope="col">{{ nameKey }}</th>
            <th v-for="key in extraKeys" :key="key" scope="col">{{ key }}</th>
            <th v-if="valueKey" scope="col" class="num">{{ valueKey }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in visible" :key="`${row[nameKey]}-${i}`">
            <td class="num rank">{{ rankKey ? row[rankKey] : i + 1 }}</td>
            <th scope="row" class="company">
              <a v-if="urlKey && row[urlKey]" :href="href(row[urlKey])" rel="nofollow noopener" target="_blank">{{ row[nameKey] }}</a>
              <template v-else>{{ row[nameKey] }}</template>
              <span v-if="descKey && row[descKey]" class="desc">{{ row[descKey] }}</span>
            </th>
            <td v-for="key in extraKeys" :key="key">{{ row[key] }}</td>
            <td v-if="valueKey" class="num value">{{ row[valueKey] }}</td>
          </tr>
          <tr v-if="!visible.length">
            <td :colspan="extraKeys.length + 3" class="muted">No companies match “{{ query }}”.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
