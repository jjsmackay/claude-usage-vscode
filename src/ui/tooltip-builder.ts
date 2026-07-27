import * as vscode from 'vscode'
import { AuthData, AuthProblem, CachedError, ClaudeUsage } from '../types'
import { createProgressBar } from './progress-bar'
import {
  buildUsageRows,
  formatExtraUsage,
  highestWarningUtilization,
} from './usage-rows'
import { formatDuration, formatResetTime } from '../utils/time-formatter'

const USAGE_LINK = 'https://claude.ai/settings/usage'
const DOCS_LINK = 'https://docs.claude.com/en/docs/claude-code'
const REFRESH_LINK = 'command:claude-usage.refresh'
const SETTINGS_LINK =
  'command:workbench.action.openSettings?%22claudeUsage%22'

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

function clockTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function errorTitle(kind: CachedError['kind']): string {
  switch (kind) {
    case 'rate-limited':
      return 'Rate Limited'
    case 'unauthorized':
      return 'Authentication Rejected'
    case 'http-error':
      return 'Claude API Error'
    case 'network-error':
      return 'Network Error'
  }
}

function appendFooter(
  tooltip: vscode.MarkdownString,
  links: string[] = [
    `$(globe) [Usage](${USAGE_LINK})`,
    `$(sync) [Refresh](${REFRESH_LINK})`,
    `$(gear) [Settings](${SETTINGS_LINK})`,
  ],
): void {
  tooltip.appendMarkdown(`---\n\n`)
  tooltip.appendMarkdown(`${links.join(' · ')}\n\n`)
}

export interface MainTooltipState {
  usage: ClaudeUsage
  auth: AuthData | null
  fetchedAt: number | null
  stale: boolean
  lastError: CachedError | null
  authProblem: AuthProblem | null
  blockedUntil: number
  fetching: boolean
}

/**
 * Create the main tooltip with usage information
 */
export function createMainTooltip(
  state: MainTooltipState,
): vscode.MarkdownString {
  const { usage, auth, fetchedAt, stale, lastError, authProblem } = state
  const tooltip = makeTooltip()

  tooltip.appendMarkdown(`### Claude Usage\n\n`)

  // Account info
  if (auth) {
    const subType = auth.subscriptionType
      ? formatSubscriptionType(auth.subscriptionType)
      : null
    const parts = [auth.displayName, subType].filter(
      (p): p is string => p != null,
    )
    if (parts.length > 0) {
      tooltip.appendMarkdown(`$(account) ${parts.join(' · ')}\n\n`)
    }
    tooltip.appendMarkdown(`$(mail) ${auth.email}\n\n`)
  }

  tooltip.appendMarkdown(`---\n\n`)

  // Usage table
  const rows = buildUsageRows(usage)

  if (rows.length === 0) {
    tooltip.appendMarkdown(`$(info) No usage data available.\n\n`)
  } else {
    tooltip.appendMarkdown(`|  | Progress | | Resets in |\n`)
    tooltip.appendMarkdown(`|:--|:--:|:--:|:--:|\n`)
    for (const row of rows) {
      const bar = createProgressBar(row.utilization)
      const pct = Math.round(row.utilization)
      const icon = getStatusIcon(row.utilization)
      let resetCell = '—'
      if (row.resetsAt !== null) {
        const t = formatResetTime(row.resetsAt)
        if (t !== 'Reset time passed') {
          resetCell = t
        }
      }
      tooltip.appendMarkdown(
        `| **${row.label}** | \`${bar}\` | ${pct}% ${icon} | ${resetCell} |\n`,
      )
    }
    tooltip.appendMarkdown(`\n`)
  }

  const credits = formatExtraUsage(usage)
  if (credits !== null) {
    tooltip.appendMarkdown(`$(credit-card) Usage credits: ${credits}\n\n`)
  }

  // Alert section (excludes oauth apps)
  const highestUsage = highestWarningUtilization(rows)

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

  // Why these numbers may not match Claude Code's own view.
  if (stale || lastError !== null || authProblem !== null) {
    tooltip.appendMarkdown(`---\n\n`)

    if (authProblem?.kind === 'expired') {
      tooltip.appendMarkdown(
        `$(key) **Access token expired.** Run \`claude\` in a terminal to refresh it — this picks the new token up automatically.\n\n`,
      )
    } else if (authProblem?.kind === 'missing') {
      tooltip.appendMarkdown(`$(lock) **No credentials found.** ${authProblem.reason}\n\n`)
    }

    if (lastError !== null) {
      const retryIn = state.blockedUntil - Date.now()
      const retryNote =
        retryIn > 0 ? ` Retrying in ${formatDuration(retryIn)}.` : ''
      tooltip.appendMarkdown(
        `$(warning) **${errorTitle(lastError.kind)}** at ${clockTime(
          lastError.at,
        )} — ${lastError.message}${retryNote}\n\n`,
      )
    }
  }

  appendFooter(tooltip)

  if (fetchedAt === null) {
    tooltip.appendMarkdown(`$(clock) Never updated\n\n`)
  } else {
    const age = formatDuration(Date.now() - fetchedAt)
    const marker = stale ? '$(warning)' : '$(clock)'
    tooltip.appendMarkdown(
      `${marker} Data from ${clockTime(fetchedAt)} (${age} old)\n\n`,
    )
  }

  return tooltip
}

/**
 * Create authentication required tooltip
 */
export function createAuthRequiredTooltip(
  reason?: string,
): vscode.MarkdownString {
  const tooltip = makeTooltip()

  tooltip.appendMarkdown(`### $(lock) Authentication Required\n\n`)
  tooltip.appendMarkdown(`Login to Claude Code to enable usage tracking.\n\n`)
  if (reason) {
    tooltip.appendMarkdown(`\`${reason}\`\n\n`)
  }
  tooltip.appendMarkdown(`**Steps**\n\n`)
  tooltip.appendMarkdown(`1. Run \`claude\` in your terminal to login\n`)
  tooltip.appendMarkdown(`2. Allow access to your system credential store\n\n`)
  tooltip.appendMarkdown(
    `No window reload needed — the credentials are re-read on every poll.\n\n`,
  )
  appendFooter(tooltip, [
    `$(book) [Documentation](${DOCS_LINK})`,
    `$(sync) [Check now](${REFRESH_LINK})`,
  ])

  return tooltip
}

/**
 * Create expired access token tooltip
 */
export function createTokenExpiredTooltip(
  expiresAt: number,
): vscode.MarkdownString {
  const tooltip = makeTooltip()
  const ago = formatDuration(Date.now() - expiresAt)

  tooltip.appendMarkdown(`### $(key) Access Token Expired\n\n`)
  tooltip.appendMarkdown(
    `The Claude Code token expired ${ago} ago (at ${clockTime(expiresAt)}).\n\n`,
  )
  tooltip.appendMarkdown(
    `Claude Code refreshes it the next time it runs. Start \`claude\` in a terminal, or open the Claude Code panel.\n\n`,
  )
  tooltip.appendMarkdown(
    `$(info) The new token is picked up automatically — no window reload required.\n\n`,
  )
  appendFooter(tooltip, [`$(sync) [Check now](${REFRESH_LINK})`])

  return tooltip
}

/**
 * Create the tooltip shown before the first successful fetch
 */
export function createInitializingTooltip(
  fetching: boolean,
): vscode.MarkdownString {
  const tooltip = makeTooltip()

  tooltip.appendMarkdown(`### Claude Usage\n\n`)
  tooltip.appendMarkdown(
    fetching
      ? `$(sync~spin) Fetching usage...\n\n`
      : `$(watch) Waiting for the first update...\n\n`,
  )

  return tooltip
}

/**
 * Create the tooltip for a failure with no usable cached data.
 *
 * Reports what the API actually said, so a rate limit is never presented as a
 * possible network problem.
 */
export function createErrorTooltip(
  error: CachedError,
  retryInMs: number | null,
): vscode.MarkdownString {
  const tooltip = makeTooltip()

  tooltip.appendMarkdown(`### $(warning) ${errorTitle(error.kind)}\n\n`)
  tooltip.appendMarkdown(`**Claude API:** ${error.message}\n\n`)
  tooltip.appendMarkdown(
    `Failed at ${clockTime(error.at)}${
      error.status ? ` · HTTP ${error.status}` : ''
    }\n\n`,
  )

  if (retryInMs !== null) {
    tooltip.appendMarkdown(
      `$(watch) Next attempt in ${formatDuration(retryInMs)}.\n\n`,
    )
  }

  tooltip.appendMarkdown(`---\n\n`)

  switch (error.kind) {
    case 'rate-limited':
      tooltip.appendMarkdown(
        `The usage endpoint is limited per access token, and every VS Code window shares that one token.\n\n`,
      )
      tooltip.appendMarkdown(
        `- Only one window polls at a time, so extra windows cost nothing\n`,
      )
      tooltip.appendMarkdown(
        `- Raising \`updateInterval\` reduces the request rate further\n`,
      )
      tooltip.appendMarkdown(
        `- The limit clears on its own; the wait doubles after each failure\n\n`,
      )
      break
    case 'unauthorized':
      tooltip.appendMarkdown(
        `The token was rejected. Run \`claude\` in a terminal to re-authenticate — the refreshed token is picked up automatically.\n\n`,
      )
      break
    case 'network-error':
      tooltip.appendMarkdown(`Could not reach \`api.anthropic.com\`.\n\n`)
      tooltip.appendMarkdown(`- Check connectivity, VPN and proxy settings\n`)
      tooltip.appendMarkdown(`- The request times out after 15 seconds\n\n`)
      break
    case 'http-error':
      tooltip.appendMarkdown(
        `The Claude API returned an unexpected response. This is usually temporary.\n\n`,
      )
      break
  }

  appendFooter(tooltip, [
    `$(sync) [Retry now](${REFRESH_LINK})`,
    `$(gear) [Settings](${SETTINGS_LINK})`,
  ])

  return tooltip
}
