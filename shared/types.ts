export type ColumnRole =
  | 'rank'
  | 'name'
  | 'value'
  | 'category'
  | 'tags'
  | 'description'
  | 'url'
  | 'other'

export interface ColumnInfo {
  key: string
  role: ColumnRole
}

export interface Breakdown {
  column: string
  items: { label: string, count: number, share: number, value: number }[]
}

export interface DatasetStats {
  count: number
  valueColumn: string | null
  currency: string
  total: number
  mean: number
  median: number
  top: { name: string, value: number } | null
  bottom: { name: string, value: number } | null
  top10Total: number
  top10Share: number
  breakdowns: Breakdown[]
  tags: { column: string, items: { label: string, count: number }[] } | null
}

export interface BlogSection {
  heading: string
  paragraphs: string[]
}

export interface BlogCopy {
  title: string
  metaDescription: string
  intro: string[]
  sections: BlogSection[]
  faq: { question: string, answer: string }[]
  keywords: string[]
}

export interface Blog {
  slug: string
  industry: string
  createdAt: string
  sourceFile: string
  generatedBy: string
  columns: ColumnInfo[]
  rows: Record<string, string>[]
  stats: DatasetStats
  copy: BlogCopy
}

export type BlogSummary = Pick<Blog, 'slug' | 'industry' | 'createdAt' | 'generatedBy'> & {
  title: string
  metaDescription: string
  count: number
}
