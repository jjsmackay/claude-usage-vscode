import * as vscode from 'vscode'
import * as fs from 'fs'
import { loadAuthData } from './auth/auth-manager'
import {
  createStatusBarItem,
  showAuthRequired,
  showAuthError,
  getStatusBarItem,
} from './ui/status-bar'
import { initializeMonitor, updateUsage } from './services/usage-monitor'
import { registerCommands } from './commands'
import { createMainTooltip } from './ui/tooltip-builder'
import { MOCK_AUTH, MOCK_USAGE } from './mock-data'

let updateInterval: NodeJS.Timeout | undefined

export function activate(context: vscode.ExtensionContext) {
  console.log('Claude Stats Monitor activated')

  // Create status bar item
  const statusBarItem = createStatusBarItem()
  context.subscriptions.push(statusBarItem)

  // Register all commands
  registerCommands(context)

  // Load auth and start monitoring
  loadAuthAndStartMonitoring()
}

async function loadAuthAndStartMonitoring() {
  try {
    const authData = await loadAuthData()

    if (authData) {
      console.log('✅ Auth loaded successfully')

      // Initialize the monitor with auth data
      initializeMonitor(authData)

      // Update immediately
      await updateUsage()

      // SCREENSHOT MOCK: open tooltip as markdown preview
      const tooltipMd = createMainTooltip(MOCK_USAGE, MOCK_AUTH).value
      const tmpPath = '/tmp/claude-tooltip-preview.md'
      fs.writeFileSync(tmpPath, tooltipMd)
      await vscode.commands.executeCommand(
        'markdown.showPreview',
        vscode.Uri.file(tmpPath),
      )

      // Start periodic updates (default 5 minutes)
      const config = vscode.workspace.getConfiguration('claudeUsage')
      const intervalSeconds = config.get<number>('updateInterval') || 300

      if (updateInterval) {
        clearInterval(updateInterval)
      }

      updateInterval = setInterval(async () => {
        await updateUsage()
      }, intervalSeconds * 1000)
    } else {
      showAuthRequired()
    }
  } catch (error) {
    console.error('Error loading auth:', error)
    showAuthError(error)
  }
}

export function deactivate() {
  if (updateInterval) {
    clearInterval(updateInterval)
  }
  const statusBarItem = getStatusBarItem()
  if (statusBarItem) {
    statusBarItem.dispose()
  }
}
