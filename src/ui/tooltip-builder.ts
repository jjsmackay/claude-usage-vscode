import * as vscode from 'vscode'
import { ClaudeUsage, AuthData } from '../types'
import { createProgressBar } from './progress-bar'
import { formatResetTime } from '../utils/time-formatter'

function makeTooltip(): vscode.MarkdownString {
  const t = new vscode.MarkdownString()
  t.isTrusted = true
  t.supportThemeIcons = true
  return t
}

function getStatusIcon(percent: number): string {
  if (percent >= 90) {
    return '$(error)'
  }
  if (percent >= 75) {
    return '$(warning)'
  }
  return '$(check)'
}

function formatSubscriptionType(raw: string): string {
  if (raw === 'max') {
    return 'Max'
  }
  if (raw === 'pro') {
    return 'Pro'
  }
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

/**
 * Create the main tooltip with usage information
 */
export function createMainTooltip(
  usage: ClaudeUsage,
  authData: AuthData,
): vscode.MarkdownString {
  const tooltip = makeTooltip()

  tooltip.appendMarkdown(`### Claude Usage\n\n`)

  // Account info
  const subType = authData.subscriptionType
    ? formatSubscriptionType(authData.subscriptionType)
    : null
  const parts = [authData.displayName, subType].filter(
    (p): p is string => p != null,
  )
  if (parts.length > 0) {
    tooltip.appendMarkdown(`$(account) ${parts.join(' · ')}\n\n`)
  }
  tooltip.appendMarkdown(`$(mail) ${authData.email}\n\n`)

  tooltip.appendMarkdown(`---\n\n`)

  // Usage table
  const allWindows = [
    { label: '5h', window: usage.five_hour },
    { label: '7d', window: usage.seven_day },
    { label: 'Opus', window: usage.seven_day_opus },
    { label: 'Apps', window: usage.seven_day_oauth_apps },
  ]

  const hasData = allWindows.some((w) => w.window != null)

  if (!hasData) {
    tooltip.appendMarkdown(`$(info) No usage data available.\n\n`)
  } else {
    tooltip.appendMarkdown(`|  | Progress | | Resets in |\n`)
    tooltip.appendMarkdown(`|:--|:--:|:--:|:--:|\n`)
    for (const { label, window: w } of allWindows) {
      if (w == null) {
        continue
      }
      const bar = createProgressBar(w.utilization)
      const pct = Math.round(w.utilization)
      const icon = getStatusIcon(w.utilization)
      let resetCell = '—'
      if (w.resets_at !== null) {
        const t = formatResetTime(w.resets_at)
        if (t !== 'Reset time passed') {
          resetCell = t
        }
      }
      tooltip.appendMarkdown(
        `| **${label}** | \`${bar}\` | ${pct}% ${icon} | ${resetCell} |\n`,
      )
    }
    tooltip.appendMarkdown(`\n`)
  }

  // Alert section (excludes oauth apps)
  const highestUsage = Math.max(
    usage.five_hour?.utilization || 0,
    usage.seven_day?.utilization || 0,
    usage.seven_day_opus?.utilization || 0,
  )

  if (highestUsage > 75) {
    tooltip.appendMarkdown(`---\n\n`)
    if (highestUsage >= 90) {
      tooltip.appendMarkdown(`$(error) High usage detected.\n\n`)
    } else {
      tooltip.appendMarkdown(
        `$(lightbulb) You're approaching your usage limits.\n\n`,
      )
    }
  }

  tooltip.appendMarkdown(`---\n\n`)

  // Footer
  tooltip.appendMarkdown(
    `$(globe) [Usage](https://claude.ai/settings/usage) · $(sync) [Refresh](command:claude-usage.refresh) · $(gear) [Settings](command:workbench.action.openSettings?%22claudeUsage%22)\n\n`,
  )
  const timeStr = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
  tooltip.appendMarkdown(`$(clock) Updated ${timeStr}\n\n`)

  return tooltip
}

/**
 * Create authentication required tooltip
 */
export function createAuthRequiredTooltip(): vscode.MarkdownString {
  const tooltip = makeTooltip()

  tooltip.appendMarkdown(`### $(lock) Authentication Required\n\n`)
  tooltip.appendMarkdown(`Login to Claude Code to enable usage tracking.\n\n`)
  tooltip.appendMarkdown(`**Steps**\n\n`)
  tooltip.appendMarkdown(`1. Run \`claude\` in your terminal to login\n`)
  tooltip.appendMarkdown(`2. Allow access to your system keychain\n`)
  tooltip.appendMarkdown(`3. Reload VS Code (\`Developer: Reload Window\`)\n\n`)
  tooltip.appendMarkdown(`---\n\n`)
  tooltip.appendMarkdown(
    `$(book) [Documentation](https://docs.claude.com/en/docs/claude-code)\n\n`,
  )

  return tooltip
}

/**
 * Create error loading authentication tooltip
 */
export function createAuthErrorTooltip(error: unknown): vscode.MarkdownString {
  const tooltip = makeTooltip()

  tooltip.appendMarkdown(`### $(error) Authentication Error\n\n`)
  tooltip.appendMarkdown(`${String(error)}\n\n`)
  tooltip.appendMarkdown(`**Troubleshooting**\n\n`)
  tooltip.appendMarkdown(
    `- Verify Claude Code credentials exist in your system keychain\n`,
  )
  tooltip.appendMarkdown(`- Login to Claude Code again via terminal\n`)
  tooltip.appendMarkdown(`- Reload the VS Code window\n\n`)
  tooltip.appendMarkdown(`---\n\n`)
  tooltip.appendMarkdown(`$(sync) [Retry](command:claude-usage.refresh)\n\n`)

  return tooltip
}

/**
 * Create updating tooltip
 */
export function createUpdatingTooltip(): vscode.MarkdownString {
  const tooltip = makeTooltip()

  tooltip.appendMarkdown(`### Claude Usage\n\n`)
  tooltip.appendMarkdown(`$(sync~spin) Updating...\n\n`)

  return tooltip
}

/**
 * Create unable to fetch usage tooltip
 */
export function createFetchErrorTooltip(): vscode.MarkdownString {
  const tooltip = makeTooltip()

  tooltip.appendMarkdown(`### $(warning) Unable to Fetch Usage\n\n`)
  tooltip.appendMarkdown(
    `Could not retrieve usage data from the Claude API.\n\n`,
  )
  tooltip.appendMarkdown(`**Possible causes**\n\n`)
  tooltip.appendMarkdown(`- Network connectivity issues\n`)
  tooltip.appendMarkdown(`- Claude service temporarily unavailable\n`)
  tooltip.appendMarkdown(`- Authentication token may have expired\n\n`)
  tooltip.appendMarkdown(`---\n\n`)
  tooltip.appendMarkdown(`$(sync) [Retry](command:claude-usage.refresh)\n\n`)

  return tooltip
}

/**
 * Create update error tooltip
 */
export function createUpdateErrorTooltip(error: unknown): vscode.MarkdownString {
  const tooltip = makeTooltip()

  tooltip.appendMarkdown(`### $(warning) Update Error\n\n`)
  tooltip.appendMarkdown(`${String(error)}\n\n`)
  tooltip.appendMarkdown(`---\n\n`)
  tooltip.appendMarkdown(`$(sync) [Retry](command:claude-usage.refresh)\n\n`)

  return tooltip
}
