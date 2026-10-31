export type ColumnRole =
  | 'rank'
  | 'name'
  | 'value'
  | 'category'
  | 'tags'
  | 'description'
  | 'url'
  | 'other'
  | 'ignore'

export const COLUMN_ROLES: ColumnRole[] = ['rank', 'name', 'value', 'category', 'tags', 'description', 'url', 'other', 'ignore']

export interface ColumnInfo {
  key: string
  role: ColumnRole
}

export interface GroupStat {
  label: string
  count: number
  share: number
  value: number
  valueShare: number
  average: number
  leader: string
}

export interface Breakdown {
  column: string
  items: GroupStat[]
}

export interface Insight {
  title: string
  text: string
}

export interface DatasetStats {
  count: number
  valueColumn: string | null
  currency: string
  total: number
  mean: number
  median: number
  gini: number
  top: { name: string, value: number } | null
  bottom: { name: string, value: number } | null
  top10Total: number
  top10Share: number
  leaders: { name: string, value: number }[]
  distribution: { label: string, count: number }[]
  breakdowns: Breakdown[]
  tags: { column: string, items: GroupStat[] } | null
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

export interface CopyReview {
  mode: 'ai' | 'data'
  provider: string
  checkedClaims: number
  rejected: string[]
}

export interface Blog {
  slug: string
  industry: string
  createdAt: string
  sourceFile: string
  columns: ColumnInfo[]
  rows: Record<string, string>[]
  stats: DatasetStats
  insights: Insight[]
  copy: BlogCopy
  review: CopyReview
}

export type BlogSummary = Pick<Blog, 'slug' | 'industry' | 'createdAt'> & {
  title: string
  metaDescription: string
  count: number
  total: string | null
  topName: string | null
}

export interface DatasetPreview {
  rowCount: number
  columns: ColumnInfo[]
  sample: Record<string, string>[]
}
