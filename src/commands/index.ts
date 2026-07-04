import * as vscode from 'vscode'
import { updateUsage } from '../services/usage-monitor'
import { toggleCollapsed } from '../ui/status-bar'

/**
 * Register all extension commands
 */
export function registerCommands(context: vscode.ExtensionContext) {
  // No-op command just to show pointer cursor (used by auth/error states)
  const noopCommand = vscode.commands.registerCommand(
    'claude-usage.noop',
    () => {
      // No-op command just to show pointer cursor
    },
  )

  // Toggle the status bar between collapsed (icon only) and expanded views
  const toggleCommand = vscode.commands.registerCommand(
    'claude-usage.toggle',
    () => {
      return toggleCollapsed()
    },
  )

  // Refresh command
  const refreshCommand = vscode.commands.registerCommand(
    'claude-usage.refresh',
    async () => {
      await updateUsage()
    },
  )

  // Login command
  const loginCommand = vscode.commands.registerCommand(
    'claude-usage.login',
    async () => {
      const selection = await vscode.window.showInformationMessage(
        'You need to authenticate with Claude Code to use this extension.',
        'Help',
      )

      if (selection === 'Help') {
        vscode.env.openExternal(
          vscode.Uri.parse('https://docs.claude.com/en/docs/claude-code'),
        )
      }
    },
  )

  // Register all commands
  context.subscriptions.push(noopCommand)
  context.subscriptions.push(toggleCommand)
  context.subscriptions.push(refreshCommand)
  context.subscriptions.push(loginCommand)
}