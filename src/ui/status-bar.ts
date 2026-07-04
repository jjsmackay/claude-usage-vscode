import * as vscode from 'vscode'
import { ClaudeUsage, AuthData } from '../types'
import {
  createMainTooltip,
  createAuthRequiredTooltip,
  createAuthErrorTooltip,
  createUpdatingTooltip,
  createFetchErrorTooltip,
  createUpdateErrorTooltip,
} from './tooltip-builder'

let statusBarItem: vscode.StatusBarItem

// Persisted collapsed/expanded state and the storage backing it.
const COLLAPSED_KEY = 'claudeUsage.collapsed'
// Icon-only text shown when collapsed. Hovering still reveals the full tooltip.
const COLLAPSED_TEXT = '✼'

let persistedState: vscode.Memento | undefined
let collapsed = false

// Cache of the last successful render so toggling can re-render instantly,
// without waiting for the next poll or making a network call.
let lastUsage: ClaudeUsage | undefined
let lastAuthData: AuthData | undefined

/**
 * Create and initialize the status bar item
 */
export function createStatusBarItem(
  context: vscode.ExtensionContext,
): vscode.StatusBarItem {
  persistedState = context.globalState
  collapsed = persistedState.get<boolean>(COLLAPSED_KEY, false)

  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  )

  statusBarItem.text = collapsed ? COLLAPSED_TEXT : '✼ $(sync~spin)'
  statusBarItem.tooltip = 'Initializing Claude Stats Monitor...'
  statusBarItem.command = 'claude-usage.toggle'
  statusBarItem.show()

  return statusBarItem
}

/**
 * Build the expanded status bar text from usage data, honouring the
 * user's statusBarDisplay preference.
 */
function formatUsageText(usage: ClaudeUsage): string {
  const fiveHourPercent = usage.five_hour?.utilization || 0
  const sevenDayPercent = usage.seven_day?.utilization || 0

  const config = vscode.workspace.getConfiguration('claudeUsage')
  const display = config.get<string>('statusBarDisplay', 'both')

  switch (display) {
    case 'session':  return `✼ ${fiveHourPercent.toFixed(0)}%`
    case 'weekly':   return `✼ ${sevenDayPercent.toFixed(0)}%`
    case 'highest':  return `✼ ${Math.max(fiveHourPercent, sevenDayPercent).toFixed(0)}%`
    default:         return `✼ ${fiveHourPercent.toFixed(0)}% · ${sevenDayPercent.toFixed(0)}%`
  }
}

/**
 * Update status bar with usage data
 */
export function updateStatusBar(usage: ClaudeUsage, authData: AuthData) {
  lastUsage = usage
  lastAuthData = authData

  statusBarItem.color = undefined
  statusBarItem.backgroundColor = undefined
  statusBarItem.command = 'claude-usage.toggle'

  statusBarItem.text = collapsed ? COLLAPSED_TEXT : formatUsageText(usage)
  statusBarItem.tooltip = createMainTooltip(usage, authData)
}

/**
 * Toggle between the collapsed (icon-only) and expanded (percentages) views.
 * The state is persisted and re-rendered from cached usage data, so clicking
 * reliably collapses and expands in both directions without a network call.
 */
export async function toggleCollapsed() {
  collapsed = !collapsed
  await persistedState?.update(COLLAPSED_KEY, collapsed)

  if (lastUsage) {
    statusBarItem.text = collapsed ? COLLAPSED_TEXT : formatUsageText(lastUsage)
    if (lastAuthData) {
      statusBarItem.tooltip = createMainTooltip(lastUsage, lastAuthData)
    }
  } else {
    // No data cached yet (still initializing) — keep the spinner when expanded.
    statusBarItem.text = collapsed ? COLLAPSED_TEXT : '✼ $(sync~spin)'
  }
}

/**
 * Show authentication required state
 */
export function showAuthRequired() {
  statusBarItem.text = '$(error)'
  statusBarItem.color = new vscode.ThemeColor('errorForeground')
  statusBarItem.tooltip = createAuthRequiredTooltip()
  statusBarItem.command = 'claude-usage.noop'
}

/**
 * Show authentication error state
 */
export function showAuthError(error: unknown) {
  statusBarItem.text = '$(error)'
  statusBarItem.color = new vscode.ThemeColor('errorForeground')
  statusBarItem.tooltip = createAuthErrorTooltip(error)
}

/**
 * Show updating state
 */
export function showUpdating() {
  statusBarItem.text = collapsed ? COLLAPSED_TEXT : '✼ $(sync~spin)'
  statusBarItem.color = undefined
  statusBarItem.tooltip = createUpdatingTooltip()
}

/**
 * Show fetch error state
 */
export function showFetchError() {
  statusBarItem.text = '$(warning)'
  statusBarItem.color = new vscode.ThemeColor('editorWarning.foreground')
  statusBarItem.tooltip = createFetchErrorTooltip()
}

/**
 * Show update error state
 */
export function showUpdateError(error: unknown) {
  statusBarItem.text = '$(warning)'
  statusBarItem.color = new vscode.ThemeColor('editorWarning.foreground')
  statusBarItem.tooltip = createUpdateErrorTooltip(error)
}

/**
 * Get the status bar item
 */
export function getStatusBarItem(): vscode.StatusBarItem {
  return statusBarItem
}
