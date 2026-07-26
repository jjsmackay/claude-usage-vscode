import { ClaudeUsage, UsageWindow } from '../types'

export interface UsageRow {
  label: string
  utilization: number
  resetsAt: string | null
  /** OAuth-app usage is reported but is not one of the user's own limits. */
  isOwnLimit: boolean
}

/**
 * Windows the API reports as their own top-level field, in the order Claude
 * Code's own Account & usage panel lists them. Absent allowances come back as
 * null, so a row only appears once the account actually has that limit.
 */
const NAMED_WINDOWS: Array<{
  label: string
  pick: (u: ClaudeUsage) => UsageWindow | null | undefined
  isOwnLimit?: boolean
}> = [
  { label: '5h', pick: (u) => u.five_hour },
  { label: '7d', pick: (u) => u.seven_day },
  { label: 'Opus', pick: (u) => u.seven_day_opus },
  { label: 'Sonnet', pick: (u) => u.seven_day_sonnet },
  { label: 'Cowork', pick: (u) => u.seven_day_cowork },
  { label: 'Apps', pick: (u) => u.seven_day_oauth_apps, isOwnLimit: false },
]

/**
 * Flatten everything the API reports into display rows.
 *
 * Per-model weekly allowances exist only inside `limits`, so they are pulled
 * from there; the `session` and `weekly_all` entries of that array are skipped
 * because they repeat `five_hour` and `seven_day`, which are already rows.
 */
export function buildUsageRows(usage: ClaudeUsage): UsageRow[] {
  const rows: UsageRow[] = []

  for (const { label, pick, isOwnLimit } of NAMED_WINDOWS) {
    const window = pick(usage)
    if (window == null) {
      continue
    }
    rows.push({
      label,
      utilization: window.utilization,
      resetsAt: window.resets_at,
      isOwnLimit: isOwnLimit ?? true,
    })
  }

  const seen = new Set(rows.map((r) => r.label.toLowerCase()))

  for (const limit of usage.limits ?? []) {
    if (limit.kind !== 'weekly_scoped') {
      continue
    }
    const name = limit.scope?.model?.display_name
    if (!name || seen.has(name.toLowerCase())) {
      continue
    }
    // A scoped allowance the account is not actually subject to is reported at
    // 0% and inactive. Claude Code leaves those out, and a row permanently
    // reading 0% carries no information, so only show one that is either in use
    // or marked active.
    if (limit.percent <= 0 && limit.is_active !== true) {
      continue
    }
    seen.add(name.toLowerCase())
    rows.push({
      label: name,
      utilization: limit.percent,
      resetsAt: limit.resets_at,
      isOwnLimit: true,
    })
  }

  return rows
}

/**
 * Highest utilization among the user's own limits, which drives the warning
 * banner. OAuth-app usage is excluded: it is not something the user can hit.
 */
export function highestOwnUtilization(rows: UsageRow[]): number {
  return rows
    .filter((r) => r.isOwnLimit)
    .reduce((max, r) => Math.max(max, r.utilization), 0)
}

/**
 * One-line summary of purchased usage credits, or null when the account has
 * none enabled.
 */
export function formatExtraUsage(usage: ClaudeUsage): string | null {
  const extra = usage.extra_usage
  if (!extra || !extra.is_enabled) {
    return null
  }

  const parts: string[] = []
  if (extra.utilization != null) {
    parts.push(`${Math.round(extra.utilization)}% used`)
  }
  if (extra.used_credits != null && extra.monthly_limit != null) {
    const currency = extra.currency ? ` ${extra.currency}` : ''
    parts.push(`${extra.used_credits} of ${extra.monthly_limit}${currency}`)
  }

  return parts.length > 0 ? parts.join(' · ') : 'enabled'
}
