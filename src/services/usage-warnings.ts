import { UsageRow } from '../ui/usage-rows'

export interface WarningDecision {
  /** Markers to store: row label -> the reset cycle it was warned about. */
  notifiedResets: Record<string, string>
  /** Limits that crossed the threshold and have not been announced yet. */
  warnings: string[]
}

/**
 * Decide which limits deserve a warning right now.
 *
 * Rows are whatever the tooltip is showing, so every limit on display can warn
 * and a limit the account does not have stays silent. A limit is announced once
 * per reset cycle: the marker is carried over while it stays above the
 * threshold, dropped once it falls back under, and rebuilt from the current rows
 * so a limit that is no longer reported leaves no marker behind.
 *
 * Limits the user's own work does not count against are skipped, matching the
 * banner and the highest-usage figure: there is nothing to act on.
 */
export function decideWarnings(
  rows: UsageRow[],
  previous: Record<string, string>,
  thresholdPercent: number,
): WarningDecision {
  const notifiedResets: Record<string, string> = {}
  const warnings: string[] = []

  for (const row of rows) {
    if (!row.isOwnLimit || row.utilization <= thresholdPercent) {
      continue
    }

    const cycle = row.resetsAt ?? 'unknown'
    notifiedResets[row.label] = cycle

    if (previous[row.label] !== cycle) {
      warnings.push(`${row.label} limit is ${row.utilization.toFixed(1)}% used`)
    }
  }

  return { notifiedResets, warnings }
}
