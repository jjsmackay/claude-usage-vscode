import * as vscode from 'vscode'
import { ClaudeUsage, AuthData } from '../types'
import { createProgressBar } from './progress-bar'
import { formatResetTime } from '../utils/time-formatter'

/**
 * Create the main tooltip with usage information
 */
export function createMainTooltip(
  usage: ClaudeUsage,
  authData: AuthData,
): vscode.MarkdownString {
  const tooltip = new vscode.MarkdownString()
  tooltip.supportHtml = true
  tooltip.isTrusted = true
  tooltip.supportThemeIcons = true

  // Header section with centered title and icon
  tooltip.appendMarkdown('<div align="center">\n\n')
  tooltip.appendMarkdown(`## ⚡ Claude Stats Monitor\n\n`)
  tooltip.appendMarkdown('</div>\n\n')

  // Account info section
  if (authData.displayName) {
    tooltip.appendMarkdown(`👤 **${authData.displayName}**\n\n`)
  }

  tooltip.appendMarkdown(`📧 ${authData.email}\n\n`)

  if (authData.subscriptionType) {
    const subName =
      authData.subscriptionType === 'max'
        ? 'Claude MAX'
        : authData.subscriptionType.toUpperCase()
    tooltip.appendMarkdown(`💎 ${subName}\n\n`)
  }

  tooltip.appendMarkdown(`---\n\n`)

  // Usage Limits section with better visual hierarchy
  tooltip.appendMarkdown(`### 🚀 Usage Limits\n\n`)

  // 5-hour limit
  if (usage.five_hour) {
    const percent = usage.five_hour.utilization
    let limitIcon = '✅'
    if (percent >= 90) {limitIcon = '🔴'}
    else if (percent >= 75) {limitIcon = '🟡'}

    tooltip.appendMarkdown(`#### ${limitIcon} 5-Hour Limit\n\n`)
    tooltip.appendMarkdown(`${createProgressBar(percent)}\n\n`)

    if (usage.five_hour.resets_at) {
      const resetTime = formatResetTime(usage.five_hour.resets_at)
      tooltip.appendMarkdown(`⏱️ Resets in **${resetTime}**\n\n`)
    }
    tooltip.appendMarkdown(`\n`)
  }

  // 7-day limit
  if (usage.seven_day) {
    const percent = usage.seven_day.utilization
    let limitIcon = '✅'
    if (percent >= 90) {limitIcon = '🔴'}
    else if (percent >= 75) {limitIcon = '🟡'}

    tooltip.appendMarkdown(`#### ${limitIcon} 7-Day Limit\n\n`)
    tooltip.appendMarkdown(`${createProgressBar(percent)}\n\n`)

    if (usage.seven_day.resets_at) {
      const resetTime = formatResetTime(usage.seven_day.resets_at)
      tooltip.appendMarkdown(`⏱️ Resets in **${resetTime}**\n\n`)
    }
    tooltip.appendMarkdown(`\n`)
  }

  // 7-day Opus limit
  if (usage.seven_day_opus) {
    const percent = usage.seven_day_opus.utilization
    let limitIcon = '✅'
    if (percent >= 90) {limitIcon = '🔴'}
    else if (percent >= 75) {limitIcon = '🟡'}

    tooltip.appendMarkdown(`#### ${limitIcon} 7-Day Opus Limit\n\n`)
    tooltip.appendMarkdown(`${createProgressBar(percent)}\n\n`)

    if (usage.seven_day_opus.resets_at) {
      const resetTime = formatResetTime(usage.seven_day_opus.resets_at)
      tooltip.appendMarkdown(`⏱️ Resets in **${resetTime}**\n\n`)
    }
    tooltip.appendMarkdown(`\n`)
  }

  // 7-day OAuth apps limit
  if (usage.seven_day_oauth_apps) {
    const percent = usage.seven_day_oauth_apps.utilization
    let limitIcon = '✅'
    if (percent >= 90) {limitIcon = '🔴'}
    else if (percent >= 75) {limitIcon = '🟡'}

    tooltip.appendMarkdown(`#### ${limitIcon} 7-Day OAuth Apps Limit\n\n`)
    tooltip.appendMarkdown(`${createProgressBar(percent)}\n\n`)

    if (usage.seven_day_oauth_apps.resets_at) {
      const resetTime = formatResetTime(usage.seven_day_oauth_apps.resets_at)
      tooltip.appendMarkdown(`⏱️ Resets in **${resetTime}**\n\n`)
    }
    tooltip.appendMarkdown(`\n`)
  }

  // Usage Tips section (only show when usage is high)
  const highestUsage = Math.max(
    usage.five_hour?.utilization || 0,
    usage.seven_day?.utilization || 0,
    usage.seven_day_opus?.utilization || 0,
  )

  if (highestUsage > 75) {
    tooltip.appendMarkdown(`---\n\n`)
    tooltip.appendMarkdown(`### 💡 Tips\n\n`)

    if (highestUsage > 90) {
      tooltip.appendMarkdown(
        `> ⚠️ **High usage detected!** Consider reducing your request frequency.\n\n`,
      )
    } else if (highestUsage > 75) {
      tooltip.appendMarkdown(
        `> ℹ️ You're approaching your usage limits. Monitor your usage carefully.\n\n`,
      )
    }
  }

  tooltip.appendMarkdown(`\n\n---\n\n`)

  // Action buttons section with icons
  tooltip.appendMarkdown(`🔄 [Refresh Now](command:claude-usage.refresh) • `)
  tooltip.appendMarkdown(
    `⚙️ [Settings](command:workbench.action.openSettings?%22claudeUsage%22)\n\n`,
  )

  // Last update time with clock icon
  const now = new Date()
  const timeStr = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
  tooltip.appendMarkdown(`🕒 Last updated: **${timeStr}**\n\n`)

  return tooltip
}

/**
 * Create authentication required tooltip
 */
export function createAuthRequiredTooltip(): vscode.MarkdownString {
  const tooltip = new vscode.MarkdownString()
  tooltip.isTrusted = true
  tooltip.supportThemeIcons = true
  tooltip.supportHtml = true

  tooltip.appendMarkdown('<div align="center">\n\n')
  tooltip.appendMarkdown(`## 🔐 Authentication Required\n\n`)
  tooltip.appendMarkdown('</div>\n\n')

  tooltip.appendMarkdown(
    `> ⚠️ **You need to login to Claude Code to use this extension**\n\n`,
  )

  tooltip.appendMarkdown(`### 📝 How to Login\n\n`)
  tooltip.appendMarkdown(`1️⃣ Login to Claude Code\n\n`)
  tooltip.appendMarkdown(`2️⃣ Allow access to your Keychain\n\n`)
  tooltip.appendMarkdown(`3️⃣ Reload VS Code window\n\n`)

  tooltip.appendMarkdown(`---\n\n`)

  tooltip.appendMarkdown('<div align="center">\n\n')
  tooltip.appendMarkdown(
    `📚 [Documentation](https://docs.claude.com/en/docs/claude-code)\n\n`,
  )
  tooltip.appendMarkdown('</div>')

  return tooltip
}

/**
 * Create error loading authentication tooltip
 */
export function createAuthErrorTooltip(error: any): vscode.MarkdownString {
  const tooltip = new vscode.MarkdownString()
  tooltip.isTrusted = true
  tooltip.supportThemeIcons = true
  tooltip.supportHtml = true

  tooltip.appendMarkdown('<div align="center">\n\n')
  tooltip.appendMarkdown(`## ❌ Error Loading Authentication\n\n`)
  tooltip.appendMarkdown('</div>\n\n')

  tooltip.appendMarkdown(`> 🔴 **${error}**\n\n`)

  tooltip.appendMarkdown(`### 🔧 Troubleshooting Steps\n\n`)
  tooltip.appendMarkdown(
    `✓ Check if Claude Code credentials are in Keychain\n\n`,
  )
  tooltip.appendMarkdown(`✓ Try logging in to Claude Code again\n\n`)
  tooltip.appendMarkdown(`✓ Reload VS Code window\n\n`)

  tooltip.appendMarkdown(`---\n\n`)

  tooltip.appendMarkdown('<div align="center">\n\n')
  tooltip.appendMarkdown(
    `🔄 [Click to Retry](command:claude-usage.refresh)\n\n`,
  )
  tooltip.appendMarkdown('</div>')

  return tooltip
}

/**
 * Create updating tooltip
 */
export function createUpdatingTooltip(): vscode.MarkdownString {
  const tooltip = new vscode.MarkdownString()
  tooltip.isTrusted = true
  tooltip.supportThemeIcons = true
  tooltip.supportHtml = true

  tooltip.appendMarkdown('<div align="center">\n\n')
  tooltip.appendMarkdown(`## ⚡ Claude Stats Monitor\n\n`)
  tooltip.appendMarkdown(`### $(sync~spin) Updating...\n\n`)
  tooltip.appendMarkdown(`Fetching latest usage from Claude API...\n\n`)
  tooltip.appendMarkdown('</div>')

  return tooltip
}

/**
 * Create unable to fetch usage tooltip
 */
export function createFetchErrorTooltip(): vscode.MarkdownString {
  const tooltip = new vscode.MarkdownString()
  tooltip.isTrusted = true
  tooltip.supportThemeIcons = true
  tooltip.supportHtml = true

  tooltip.appendMarkdown('<div align="center">\n\n')
  tooltip.appendMarkdown(`## ⚠️ Unable to Fetch Usage\n\n`)
  tooltip.appendMarkdown('</div>\n\n')

  tooltip.appendMarkdown(
    `> 🟡 **Could not retrieve usage data from Claude API**\n\n`,
  )

  tooltip.appendMarkdown(`### 🔍 Possible Causes\n\n`)
  tooltip.appendMarkdown(`🌐 Network connectivity issues\n\n`)
  tooltip.appendMarkdown(`🔧 Claude service temporarily unavailable\n\n`)
  tooltip.appendMarkdown(`🔑 Authentication token expired\n\n`)

  tooltip.appendMarkdown(`---\n\n`)

  tooltip.appendMarkdown('<div align="center">\n\n')
  tooltip.appendMarkdown(
    `🔄 [Click to Retry](command:claude-usage.refresh)\n\n`,
  )
  tooltip.appendMarkdown('</div>')

  return tooltip
}

/**
 * Create update error tooltip
 */
export function createUpdateErrorTooltip(error: any): vscode.MarkdownString {
  const tooltip = new vscode.MarkdownString()
  tooltip.isTrusted = true
  tooltip.supportThemeIcons = true
  tooltip.supportHtml = true

  tooltip.appendMarkdown('<div align="center">\n\n')
  tooltip.appendMarkdown(`## ⚠️ Update Error\n\n`)
  tooltip.appendMarkdown('</div>\n\n')

  tooltip.appendMarkdown(`> 🟡 **${error}**\n\n`)

  tooltip.appendMarkdown(`---\n\n`)

  tooltip.appendMarkdown('<div align="center">\n\n')
  tooltip.appendMarkdown(
    `🔄 [Click to Retry](command:claude-usage.refresh)\n\n`,
  )
  tooltip.appendMarkdown('</div>')

  return tooltip
}
