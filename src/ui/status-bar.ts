import * as vscode from 'vscode'
import { AuthData, AuthProblem, UsageCacheRecord } from '../types'
import { formatDuration } from '../utils/time-formatter'
import { staleAfterMs } from '../services/fetch-policy'
import {
  createMainTooltip,
  createAuthRequiredTooltip,
  createTokenExpiredTooltip,
  createInitializingTooltip,
  createErrorTooltip,
} from './tooltip-builder'

export interface ViewState {
  record: UsageCacheRecord
  auth: AuthData | null
  authProblem: AuthProblem | null
  intervalMs: number
  fetching: boolean
}

let statusBarItem: vscode.StatusBarItem

/**
 * Create and initialize the status bar item
 */
export function createStatusBarItem(): vscode.StatusBarItem {
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  )

  statusBarItem.text = '✼ $(sync~spin)'
  statusBarItem.tooltip = 'Starting Claude Status Bar...'
  statusBarItem.command = 'claude-usage.noop'
  statusBarItem.show()

  return statusBarItem
}

function usageText(usage: NonNullable<UsageCacheRecord['usage']>): string {
  const fiveHour = usage.five_hour?.utilization || 0
  const sevenDay = usage.seven_day?.utilization || 0

  const display = vscode.workspace
    .getConfiguration('claudeUsage')
    .get<string>('statusBarDisplay', 'both')

  switch (display) {
    case 'session':
      return `✼ ${fiveHour.toFixed(0)}%`
    case 'weekly':
      return `✼ ${sevenDay.toFixed(0)}%`
    case 'highest':
      return `✼ ${Math.max(fiveHour, sevenDay).toFixed(0)}%`
    default:
      return `✼ ${fiveHour.toFixed(0)}% · ${sevenDay.toFixed(0)}%`
  }
}

function apply(
  text: string,
  tooltip: vscode.MarkdownString,
  color?: vscode.ThemeColor,
): void {
  statusBarItem.text = text
  statusBarItem.color = color
  statusBarItem.backgroundColor = undefined
  statusBarItem.tooltip = tooltip
}

/**
 * Render the whole status bar from the shared state.
 *
 * Numbers already on screen are never replaced by a spinner: a poll that fails
 * or hangs leaves the last known figures visible, and the fact that they are old
 * is stated explicitly instead of being hidden behind a fresh-looking timestamp.
 */
export function render(state: ViewState): void {
  if (!statusBarItem) {
    return
  }

  const { record, authProblem, intervalMs, fetching } = state
  const now = Date.now()
  const warning = new vscode.ThemeColor('editorWarning.foreground')
  const error = new vscode.ThemeColor('errorForeground')

  const age = record.fetchedAt === null ? null : now - record.fetchedAt
  const stale = age === null || age > staleAfterMs(intervalMs)

  // No credentials at all: the extension cannot do anything until Claude Code
  // has been logged into.
  if (authProblem?.kind === 'missing' && record.usage === null) {
    apply('$(error)', createAuthRequiredTooltip(authProblem.reason), error)
    return
  }

  if (authProblem?.kind === 'expired' && record.usage === null) {
    apply(
      '$(warning)',
      createTokenExpiredTooltip(authProblem.expiresAt),
      warning,
    )
    return
  }

  if (record.usage !== null) {
    const degraded = stale || record.lastError !== null || authProblem !== null
    apply(
      degraded ? `${usageText(record.usage)} $(warning)` : usageText(record.usage),
      createMainTooltip({
        usage: record.usage,
        auth: state.auth,
        fetchedAt: record.fetchedAt,
        stale,
        lastError: record.lastError,
        authProblem,
        blockedUntil: record.blockedUntil,
        fetching,
      }),
      degraded ? warning : undefined,
    )
    return
  }

  // Nothing to show yet.
  if (record.lastError !== null) {
    const retryIn =
      record.blockedUntil > now ? record.blockedUntil - now : null
    const text =
      record.lastError.kind === 'rate-limited' && retryIn !== null
        ? `✼ $(watch) ${formatDuration(retryIn)}`
        : '$(warning)'
    apply(text, createErrorTooltip(record.lastError, retryIn), warning)
    return
  }

  apply('✼ $(sync~spin)', createInitializingTooltip(fetching))
}

/**
 * Get the status bar item
 */
export function getStatusBarItem(): vscode.StatusBarItem {
  return statusBarItem
}
