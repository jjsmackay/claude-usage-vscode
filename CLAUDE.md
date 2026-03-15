# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run vscode:package # Package to .vsix for local install
npm run compile        # Compile TypeScript to ./out/
npm run watch          # Watch mode for development
npm run lint           # ESLint on src/**/*.ts
npm run test           # VSCode integration tests (requires Electron host)
npm run test:unit      # Mocha unit tests only (faster, no VSCode host needed)
```

To run a single unit test file:
```bash
npm run compile && mocha out/test/suite/progress-bar.test.js --ui tdd --color
npm run compile && mocha out/test/suite/time-formatter.test.js --ui tdd --color
```

To debug the extension: open in VSCode and press F5 (uses `.vscode/launch.json`).

## Architecture

**Claude Status Bar** — VSCode extension that polls `https://api.anthropic.com/api/oauth/usage` and renders Claude Code usage limits (current session and weekly) in the status bar.

### Layered structure

```
extension.ts          Entry point — lifecycle, polling interval, init
├── types.ts                     Shared interfaces: AuthData, ClaudeConfig, UsageWindow, ClaudeUsage
├── auth/
│   ├── auth-manager.ts          Platform dispatch + ~/.claude.json user info
│   ├── keychain-access.ts       macOS: reads "Claude Code-credentials" from Keychain
│   └── credentials-access.ts    Linux: reads ~/.claude/.credentials.json
├── claude-client.ts             axios wrapper for /api/oauth/usage; caches last response on error
├── services/
│   └── usage-monitor.ts         Orchestrates fetch → UI update → warning notifications
├── ui/
│   ├── status-bar.ts            VSCode status bar item (right-aligned, priority 100)
│   ├── tooltip-builder.ts       Named tooltip exports per state (main, auth-required, auth-error, updating, fetch-error, update-error)
│   └── progress-bar.ts          Halfwidth Unicode bar: ［ ￭￭￭･･････ ］ (U+FFED filled, U+FF65 empty), fixed 10-char width
├── utils/
│   └── time-formatter.ts        ISO timestamp → "2h 15m" countdown strings
└── commands/index.ts            refresh, login, noop commands
```

### Data flow

1. `activate()` → `loadAuthAndStartMonitoring()` → reads auth token + `~/.claude.json`
2. `updateUsage()` calls `claude-client.getUsage()` (Bearer token, beta headers)
3. Usage windows (5-hour, 7-day, 7-day Opus, 7-day OAuth) rendered via `status-bar.ts` + `tooltip-builder.ts`
4. Polling repeats on `updateInterval` (default 5 min, user-configurable)

### Extension configuration (`package.json` contributes)

- `claudeUsage.updateInterval` — polling interval in **seconds** (default: 300 = 5 min)
- `claudeUsage.showNotifications` — warn when any window exceeds 90%
- `claudeUsage.statusBarDisplay` — what to show in status bar: `"both"` (default), `"session"`, `"weekly"`, `"highest"`

## Gotchas

- **API error caching**: `ClaudeAPIClient.getUsage()` returns the last successful response on error (not null) — status bar stays populated during transient failures
- **Auth platform dispatch**: macOS reads credentials from Keychain (`security find-generic-password`); Linux reads from `~/.claude/.credentials.json`
- **`updateInterval` is in seconds** in config (default 300 = 5 min); `extension.ts` multiplies by 1000 for milliseconds
