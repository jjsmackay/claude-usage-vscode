# Claude Usage

Monitor your Claude Code usage and rate limits directly in VS Code.

## Features

- 📊 Real-time usage monitoring in the status bar
- 🔄 Automatic periodic updates (configurable interval)
- 🎯 Visual progress indicators for token usage
- ⏱️ Time remaining until rate limit reset
- 🔔 Optional notifications when usage is high

## Installation

1. Clone this repository
2. Run `npm install`
3. Run `npm run compile`
4. Press `F5` to open a new VS Code window with the extension loaded

## Configuration

Configure the extension in your VS Code settings:

- `claudeUsage.updateInterval`: Update interval in seconds (default: 300 = 5 minutes)
- `claudeUsage.showNotifications`: Show notifications when usage is high (default: false)

## Commands

- `Claude Usage: Refresh` - Manually refresh usage data
- `Claude Usage: Login` - Login to Claude Code

## Usage

After installation and authentication, the extension will automatically display your Claude Usage in the status bar, showing:

- Current token usage
- Percentage of rate limit used
- Time until rate limit reset

Click the status bar item to see detailed information.

## Requirements

- VS Code 1.74.0 or higher
- Active Claude Code subscription

## Development

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch

# Run linter
npm run lint

# Package extension
npm run vscode:package
```

## License

MIT

## Author

Jonathan Mackay ([@jjsmackay](https://github.com/jjsmackay))

## Repository

[https://github.com/jjsmackay/claude-usage-vscode-extension](https://github.com/jjsmackay/claude-usage-vscode-extension)
