<script setup lang="ts">
useSeoMeta({ title: 'Generate a blog from a CSV', robots: 'noindex, nofollow' })

const file = ref<File | null>(null)
const industry = ref('')
const status = ref<'idle' | 'working' | 'error'>('idle')
const error = ref('')
const dragging = ref(false)

function pick(selected?: File | null) {
  if (!selected) return
  if (!selected.name.toLowerCase().endsWith('.csv')) {
    error.value = 'Please choose a .csv file.'
    return
  }
  error.value = ''
  file.value = selected
  // Suggest an industry from the file name, e.g. "uk-healthtech-top-100.csv" -> "healthtech"
  if (!industry.value) {
    industry.value = selected.name
      .replace(/\.csv$/i, '')
      .replace(/\b(top|uk|\d+|companies|data(set)?|list|ranking)\b/gi, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }
}

function onDrop(e: DragEvent) {
  dragging.value = false
  pick(e.dataTransfer?.files[0])
}

async function submit() {
  if (!file.value) return
  status.value = 'working'
  error.value = ''

  const body = new FormData()
  body.append('file', file.value)
  body.append('industry', industry.value.trim())

  try {
    const { slug } = await $fetch('/api/generate', { method: 'POST', body })
    await navigateTo(`/blog/${slug}`)
  }
  catch (e: any) {
    status.value = 'error'
    error.value = e?.data?.statusMessage || e?.statusMessage || 'Something went wrong generating the blog.'
  }
}
</script>

<template>
  <div class="container page narrow">
    <h1>Generate a blog from a CSV</h1>
    <p class="lead">
      Upload a ranked company dataset from any industry. Columns are detected automatically, statistics are
      calculated from the data, and an LLM writes the SEO copy around them.
    </p>

    <form class="upload-form" @submit.prevent="submit">
      <label
        class="dropzone"
        :class="{ dragging, 'has-file': file }"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop.prevent="onDrop"
      >
        <input type="file" accept=".csv,text/csv" class="visually-hidden" @change="pick(($event.target as HTMLInputElement).files?.[0])">
        <strong v-if="file">{{ file.name }}</strong>
        <strong v-else>Drop a CSV here or click to browse</strong>
        <span class="muted small">{{ file ? `${(file.size / 1024).toFixed(0)} KB` : 'Max 2 MB. Needs a header row and a company name column.' }}</span>
      </label>

      <label class="field">
        <span>Industry or topic</span>
        <input v-model="industry" type="text" placeholder="e.g. UK healthtech" maxlength="60">
        <span class="muted small">Used in the title and keywords. Suggested from the file name.</span>
      </label>

      <button class="button" type="submit" :disabled="!file || status === 'working'">
        {{ status === 'working' ? 'Generating… this can take up to a minute' : 'Generate blog' }}
      </button>

      <p v-if="error" class="error" role="alert">{{ error }}</p>
    </form>

    <details class="help">
      <summary>What does the CSV need?</summary>
      <ul>
        <li>One row per company, with a name column (e.g. <code>Company</code>).</li>
        <li>Optional: a rank column. If missing, rows are ranked by the value column.</li>
        <li>Optional: a numeric value column such as <code>Total Raised</code> or <code>Revenue</code> for statistics.</li>
        <li>Low-variety columns like <code>Region</code> or <code>Stage</code> become breakdown charts.</li>
        <li>Semicolon-separated columns like <code>Industries</code> become sub-sector counts.</li>
      </ul>
    </details>
  </div>
</template>
