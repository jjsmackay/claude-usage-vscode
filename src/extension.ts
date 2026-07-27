import * as vscode from 'vscode'
import { createStatusBarItem, getStatusBarItem } from './ui/status-bar'
import { initCache, releaseFetchLock } from './services/usage-cache'
import { startMonitor, stopMonitor } from './services/usage-monitor'
import { registerCommands } from './commands'

export function activate(context: vscode.ExtensionContext) {
  const statusBarItem = createStatusBarItem()
  context.subscriptions.push(statusBarItem)

  // Global storage is per extension, not per window, so this directory is what
  // lets the windows share one cache and one API budget.
  initCache(context.globalStorageUri.fsPath)

  registerCommands(context)

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration('claudeUsage')) {
        return
      }
      // Re-read the interval and redraw with the new display mode without
      // requiring a window reload.
      startMonitor()
    }),
  )

  startMonitor()

  context.subscriptions.push({
    dispose: () => {
      stopMonitor()
      releaseFetchLock()
    },
  })
}

export function deactivate() {
  stopMonitor()
  releaseFetchLock()

  const statusBarItem = getStatusBarItem()
  if (statusBarItem) {
    statusBarItem.dispose()
  }
}
