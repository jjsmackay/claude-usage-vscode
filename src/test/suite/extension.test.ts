import * as assert from 'assert'
import * as vscode from 'vscode'

suite('Extension Test Suite', () => {
  test('Extension should be present', () => {
    assert.ok(
      vscode.extensions.getExtension('MartinOrtiz.claude-usage'),
      'Extension not found'
    )
  })

  test('Extension should register commands', async () => {
    const commands = await vscode.commands.getCommands(true)
    assert.ok(commands.includes('claude-usage.refresh'))
    assert.ok(commands.includes('claude-usage.login'))
    assert.ok(commands.includes('claude-usage.noop'))
  })
})
