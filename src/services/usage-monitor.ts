import * as vscode from 'vscode'
import { ClaudeAPIClient } from '../claude-client'
import { AuthData, ClaudeUsage } from '../types'
import {
  updateStatusBar,
  showUpdating,
  showFetchError,
  showUpdateError,
} from '../ui/status-bar'
import { MOCK_AUTH, MOCK_USAGE } from '../mock-data'

let apiClient: ClaudeAPIClient | undefined
let currentAuthData: AuthData | undefined

/**
 * Initialize the usage monitor with authentication data
 */
export function initializeMonitor(_authData: AuthData) {
  currentAuthData = MOCK_AUTH
  apiClient = new ClaudeAPIClient(MOCK_AUTH)
}

/**
 * Update usage statistics
 */
export async function updateUsage() {
  if (!apiClient || !currentAuthData) {
    console.error('Missing API client or auth data')
    return
  }

  try {
    showUpdating()

    const usage = MOCK_USAGE

    if (usage) {
      updateStatusBar(usage, currentAuthData)

      // Check if we should show notifications
      const config = vscode.workspace.getConfiguration('claudeUsage')
      const showNotifications = config.get<boolean>('showNotifications')

      if (showNotifications) {
        checkUsageWarnings(usage)
      }
    } else {
      showFetchError()
    }
  } catch (error) {
    console.error('Error updating usage:', error)
    showUpdateError(error)
  }
}

/**
 * Check usage and show warnings if needed
 */
function checkUsageWarnings(usage: ClaudeUsage) {
  const warnings: string[] = []

  if (usage.five_hour && usage.five_hour.utilization > 90) {
    warnings.push(
      `5-hour limit is ${usage.five_hour.utilization.toFixed(1)}% used`,
    )
  }

  if (usage.seven_day && usage.seven_day.utilization > 90) {
    warnings.push(
      `7-day limit is ${usage.seven_day.utilization.toFixed(1)}% used`,
    )
  }

  if (usage.seven_day_opus && usage.seven_day_opus.utilization > 90) {
    warnings.push(
      `7-day Opus limit is ${usage.seven_day_opus.utilization.toFixed(
        1,
      )}% used`,
    )
  }

  if (warnings.length > 0) {
    vscode.window.showWarningMessage(
      `Claude Stats Warning: ${warnings.join(', ')}`,
    )
  }
}

/**
 * Get current auth data
 */
export function getCurrentAuthData(): AuthData | undefined {
  return currentAuthData
}
