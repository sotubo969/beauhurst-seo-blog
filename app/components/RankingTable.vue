<script setup lang="ts">
import Papa from 'papaparse'
import type { ColumnInfo } from '~~/shared/types'

const props = defineProps<{
  columns: ColumnInfo[]
  rows: Record<string, string>[]
  filename: string
}>()

const find = (role: ColumnInfo['role']) => props.columns.find(c => c.role === role)?.key
const rankKey = find('rank')!
const nameKey = find('name')!
const urlKey = find('url')
const descKey = find('description')
const valueKey = find('value')
const extraKeys = props.columns.filter(c => c.role === 'category' || c.role === 'other').map(c => c.key)

const query = ref('')
const sortKey = ref(rankKey)
const sortDir = ref<1 | -1>(1)

const toNumber = (v = '') => {
  const n = Number(v.replace(/[^\d.-]/g, ''))
  return v && Number.isFinite(n) ? n : null
}

// The full table is server-rendered in rank order for crawlers; filtering and sorting only happen on the client
const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  const filtered = q ? props.rows.filter(row => Object.values(row).some(v => v.toLowerCase().includes(q))) : props.rows
  const key = sortKey.value
  return [...filtered].sort((a, b) => {
    const [x, y] = [toNumber(a[key]), toNumber(b[key])]
    const diff = x !== null && y !== null ? x - y : (a[key] ?? '').localeCompare(b[key] ?? '')
    return diff * sortDir.value
  })
})

function sortBy(key: string) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 1 ? -1 : 1
  else {
    sortKey.value = key
    sortDir.value = key === valueKey ? -1 : 1
  }
}

const ariaSort = (key: string) =>
  sortKey.value === key ? (sortDir.value === 1 ? 'ascending' : 'descending') : 'none'

function download() {
  const csv = Papa.unparse(visible.value)
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = Object.assign(document.createElement('a'), { href: url, download: props.filename })
  link.click()
  URL.revokeObjectURL(url)
}

const href = (raw?: string) => (raw && !/^https?:\/\//i.test(raw) ? `https://${raw}` : raw)
</script>

<template>
  <div class="ranking">
    <div class="table-toolbar">
      <label class="table-search">
        <span class="visually-hidden">Filter companies</span>
        <input v-model="query" type="search" placeholder="Search companies, regions, sectors…">
      </label>
      <span class="muted small" aria-live="polite">{{ visible.length }} of {{ rows.length }} companies</span>
      <button type="button" class="button button-ghost button-small" @click="download">Download CSV</button>
    </div>

    <div class="table-scroll" tabindex="0" role="region" aria-label="Company ranking table">
      <table class="ranking-table">
        <thead>
          <tr>
            <th v-for="key in [rankKey, nameKey, ...extraKeys, ...(valueKey ? [valueKey] : [])]" :key="key" scope="col" :aria-sort="ariaSort(key)" :class="{ num: key === rankKey || key === valueKey }">
              <button type="button" class="sort-button" @click="sortBy(key)">
                {{ key }}
                <span class="sort-icon" aria-hidden="true">{{ sortKey === key ? (sortDir === 1 ? '▲' : '▼') : '↕' }}</span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in visible" :key="`${row[rankKey]}-${row[nameKey]}`">
            <td class="num rank">{{ row[rankKey] }}</td>
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
