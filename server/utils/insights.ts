import type { DatasetStats, GroupStat, Insight } from '../../shared/types'
import { formatMoney, formatPercent } from '../../shared/format'

const MIN_GROUP = 5

/** Turns the statistics into ranked, plain-English findings. No LLM involved. */
export function buildInsights(stats: DatasetStats, industry: string): Insight[] {
  const money = (n: number) => formatMoney(n, stats.currency)
  const metric = stats.valueColumn?.toLowerCase()
  const insights: Insight[] = []

  if (stats.top && stats.bottom && metric) {
    const multiple = stats.bottom.value ? stats.top.value / stats.bottom.value : 0
    insights.push({
      title: `${stats.top.name} leads the ranking`,
      text: `${stats.top.name} ranks first with ${money(stats.top.value)} in ${metric}`
        + (multiple >= 2 ? `, ${multiple.toFixed(1)}x the ${money(stats.bottom.value)} recorded by the company in last place.` : '.'),
    })

    const topShareOfList = Math.min(10, stats.count) / stats.count
    if (stats.count > 10) {
      insights.push({
        title: 'Value is concentrated at the top',
        text: `The top 10 companies hold ${formatPercent(stats.top10Share)} of the combined ${metric} (${money(stats.top10Total)}), `
          + `${(stats.top10Share / topShareOfList).toFixed(1)}x what an even split would give them.`,
      })
    }

    const skew = stats.median ? stats.mean / stats.median : 1
    insights.push({
      title: skew > 1.2 ? 'A few large rounds pull the average up' : 'Value is evenly spread',
      text: `The median company has ${money(stats.median)}, against an average of ${money(stats.mean)}. `
        + (skew > 1.2
          ? `The gap shows that a small number of companies account for an outsized share.`
          : `The two figures are close, so most companies sit near the middle of the range.`),
    })
  }

  for (const breakdown of stats.breakdowns) {
    const column = breakdown.column.toLowerCase()
    const byCount = [...breakdown.items].sort((a, b) => b.count - a.count)
    const lead = byCount[0]!

    if (lead.share === 1) {
      insights.push({
        title: `Every company shares the same ${column}`,
        text: `All ${stats.count} companies in the list share the same ${column}: ${lead.label}.`,
      })
      continue
    }

    if (lead.share >= 0.6) {
      insights.push({
        title: `${lead.label} dominates by ${column}`,
        text: `${lead.label} accounts for ${lead.count} of the ${stats.count} companies (${formatPercent(lead.share)})`
          + (metric ? ` and ${formatPercent(lead.valueShare)} of the combined ${metric}.` : '.'),
      })
    }

    if (metric) {
      const best = highestAverage(breakdown.items, stats.mean, lead)
      if (best) {
        insights.push({
          title: `${best.label} punches above its weight`,
          text: `The ${best.count} companies in ${best.label} (by ${column}) average ${money(best.average)}, compared with ${money(stats.mean)} across the full list.`,
        })
      }
    }
  }

  if (stats.tags?.items.length) {
    const [first, second] = stats.tags.items
    insights.push({
      title: `${first!.label} is the most common sub-sector`,
      text: `${first!.count} of the ${stats.count} ${industry} companies are classed as ${first!.label}`
        + (second ? `, followed by ${second.label} (${second.count}).` : '.'),
    })

    if (metric) {
      const best = highestAverage(stats.tags.items, stats.mean)
      if (best) {
        insights.push({
          title: `${best.label} attracts the most per company`,
          text: `Among sub-sectors with at least ${MIN_GROUP} companies, ${best.label} has the highest average at ${money(best.average)}.`,
        })
      }
    }
  }

  return insights
}

/** The group with the highest average value, if it is big enough to be meaningful and clearly above the mean. */
function highestAverage(items: GroupStat[], mean: number, exclude?: GroupStat) {
  const best = items
    .filter(i => i.count >= MIN_GROUP && i !== exclude)
    .sort((a, b) => b.average - a.average)[0]
  return best && best.average > mean * 1.1 ? best : null
}
