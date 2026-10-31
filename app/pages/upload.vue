<script setup lang="ts">
import type { ColumnRole, DatasetPreview } from '~~/shared/types'
import { COLUMN_ROLES } from '~~/shared/types'

useSeoMeta({ title: 'Create a ranking article', robots: 'noindex, nofollow' })

const ROLE_LABELS: Record<ColumnRole, string> = {
  rank: 'Rank',
  name: 'Company name',
  value: 'Ranking value (numeric)',
  category: 'Category (charted)',
  tags: 'Tags / sub-sectors',
  description: 'Description',
  url: 'Website',
  other: 'Show in table only',
  ignore: 'Ignore',
}

const file = ref<File | null>(null)
const preview = ref<DatasetPreview | null>(null)
const roles = ref<Record<string, ColumnRole>>({})
const industry = ref('')
const mode = ref<'ai' | 'data'>('ai')
const status = ref<'idle' | 'previewing' | 'generating'>('idle')
const error = ref('')
const dragging = ref(false)

const hasName = computed(() => Object.values(roles.value).includes('name'))

function upload(path: string, extra: Record<string, string> = {}) {
  const body = new FormData()
  body.append('file', file.value!)
  for (const [k, v] of Object.entries(extra)) body.append(k, v)
  return $fetch(path, { method: 'POST', body })
}

const message = (e: any) => e?.data?.statusMessage || e?.statusMessage || 'Something went wrong. Please try again.'

async function pick(selected?: File | null) {
  if (!selected) return
  if (!selected.name.toLowerCase().endsWith('.csv')) {
    error.value = 'Please choose a .csv file.'
    return
  }
  error.value = ''
  file.value = selected
  preview.value = null
  industry.value = selected.name
    .replace(/\.csv$/i, '')
    .replace(/\b(top|\d+|companies|data(set)?|list|ranking)\b/gi, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  status.value = 'previewing'
  try {
    preview.value = await upload('/api/preview') as DatasetPreview
    roles.value = Object.fromEntries(preview.value.columns.map(c => [c.key, c.role]))
  }
  catch (e) {
    error.value = message(e)
    file.value = null
  }
  finally {
    status.value = 'idle'
  }
}

async function generate() {
  status.value = 'generating'
  error.value = ''
  try {
    const { slug } = await upload('/api/generate', {
      industry: industry.value.trim(),
      mode: mode.value,
      roles: JSON.stringify(roles.value),
    }) as { slug: string }
    await navigateTo(`/blog/${slug}`)
  }
  catch (e) {
    error.value = message(e)
    status.value = 'idle'
  }
}

function reset() {
  file.value = null
  preview.value = null
  error.value = ''
}
</script>

<template>
  <div class="container page narrow-wide">
    <p class="eyebrow">Content studio</p>
    <h1>Create a ranking article</h1>
    <p class="lead">
      Upload a company dataset from any sector. Statistics, charts and key findings are calculated from the data;
      you choose whether a language model polishes the narrative.
    </p>

    <ol class="steps">
      <li :class="{ done: preview }">
        <h2><span class="step-number">1</span> Upload dataset</h2>
        <label
          class="dropzone"
          :class="{ dragging, 'has-file': file }"
          @dragover.prevent="dragging = true"
          @dragleave="dragging = false"
          @drop.prevent="dragging = false; pick($event.dataTransfer?.files[0])"
        >
          <input type="file" accept=".csv,text/csv" class="visually-hidden" @change="pick(($event.target as HTMLInputElement).files?.[0])">
          <template v-if="file">
            <strong>{{ file.name }}</strong>
            <span class="muted small">
              {{ status === 'previewing' ? 'Analysing columns…' : `${preview?.rowCount ?? 0} rows · ${(file.size / 1024).toFixed(0)} KB · click to replace` }}
            </span>
          </template>
          <template v-else>
            <strong>Drop a CSV here or click to browse</strong>
            <span class="muted small">Up to 2 MB, with a header row and one row per company</span>
          </template>
        </label>
      </li>

      <li v-if="preview" class="done">
        <h2><span class="step-number">2</span> Check column mapping</h2>
        <p class="muted small">Detected automatically. Adjust anything that looks wrong.</p>
        <div class="table-scroll">
          <table class="mapping-table">
            <thead>
              <tr>
                <th scope="col">Column</th>
                <th scope="col">Used as</th>
                <th scope="col">Example values</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="column in preview.columns" :key="column.key">
                <th scope="row">{{ column.key }}</th>
                <td>
                  <select v-model="roles[column.key]" :aria-label="`Role for ${column.key}`">
                    <option v-for="role in COLUMN_ROLES" :key="role" :value="role">{{ ROLE_LABELS[role] }}</option>
                  </select>
                </td>
                <td class="muted small sample-cell">{{ preview.sample.slice(0, 3).map(r => r[column.key]).filter(Boolean).join(' · ') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="!hasName" class="error">Choose which column holds the company name.</p>
      </li>

      <li v-if="preview">
        <h2><span class="step-number">3</span> Article settings</h2>
        <label class="field">
          <span>Sector or topic</span>
          <input v-model="industry" type="text" placeholder="e.g. UK healthtech" maxlength="60">
          <span class="muted small">Used in the headline, URL and keywords.</span>
        </label>

        <fieldset class="mode-picker">
          <legend>Narrative</legend>
          <label :class="{ selected: mode === 'ai' }">
            <input v-model="mode" type="radio" value="ai">
            <span>
              <strong>AI-assisted, fact-checked</strong>
              <span class="muted small">An LLM writes the prose from the computed findings. Any passage with a figure not found in the data is removed.</span>
            </span>
          </label>
          <label :class="{ selected: mode === 'data' }">
            <input v-model="mode" type="radio" value="data">
            <span>
              <strong>Data-only</strong>
              <span class="muted small">Rules-based copy generated straight from the statistics. No external services, instant and deterministic.</span>
            </span>
          </label>
        </fieldset>

        <div class="actions">
          <button class="button" type="button" :disabled="!hasName || status !== 'idle'" @click="generate">
            {{ status === 'generating' ? (mode === 'ai' ? 'Writing and fact-checking…' : 'Generating…') : 'Generate article' }}
          </button>
          <button class="button button-ghost" type="button" :disabled="status !== 'idle'" @click="reset">Start again</button>
        </div>
      </li>
    </ol>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </div>
</template>
