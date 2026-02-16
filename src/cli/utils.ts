export function formatTable(headers: string[], rows: string[][]): string {
  const colWidths = headers.map((h, i) => {
    const maxRowWidth = rows.reduce((max, row) => Math.max(max, (row[i] || '').length), 0)
    return Math.max(h.length, maxRowWidth)
  })

  const separator = colWidths.map(w => '-'.repeat(w + 2)).join('+')
  const headerRow = headers.map((h, i) => ` ${h.padEnd(colWidths[i])} `).join('|')
  const dataRows = rows.map(row =>
    row.map((cell, i) => ` ${(cell || '').padEnd(colWidths[i])} `).join('|'),
  )

  return [headerRow, separator, ...dataRows].join('\n')
}

export function formatDuration(ms: number): string {
  if (ms < 1000)
    return `${ms}ms`
  if (ms < 60000)
    return `${(ms / 1000).toFixed(1)}s`
  if (ms < 3600000)
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`
}

export function formatStatus(status: string): string {
  const icons: Record<string, string> = {
    pending: '⏳',
    running: '🔄',
    waiting_user: '⚠️',
    completed: '✅',
    failed: '❌',
    cancelled: '🚫',
  }
  return `${icons[status] || '❓'} ${status}`
}

export interface JsonOutput {
  success: boolean
  data?: unknown
  error?: string
}

export function outputJson(result: JsonOutput): void {
  console.log(JSON.stringify(result, null, 2))
}

export function formatUserQuery(query: { question: string, options: Array<{ id: string, label: string, description?: string }> }): string {
  const lines = [`\n❓ ${query.question}\n`]
  query.options.forEach((opt, i) => {
    lines.push(`  ${i + 1}. ${opt.label}${opt.description ? ` - ${opt.description}` : ''}`)
  })
  lines.push('')
  return lines.join('\n')
}
