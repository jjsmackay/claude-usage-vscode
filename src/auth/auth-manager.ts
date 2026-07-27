import { AuthData, AuthProblem, ClaudeConfig, TokenState } from '../types'
import { MacOSKeychainAccess } from './keychain-access'
import { CredentialsAccess } from './credentials-access'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

export type AuthState = { kind: 'ok'; auth: AuthData } | AuthProblem

interface AccountInfo {
  email: string
  displayName?: string
}

const FALLBACK_ACCOUNT: AccountInfo = { email: 'Claude Code User' }

async function getTokenState(): Promise<TokenState> {
  if (process.platform === 'darwin') {
    return new MacOSKeychainAccess().getClaudeToken()
  }
  return new CredentialsAccess().getClaudeToken()
}

let accountCache: { mtimeMs: number; info: AccountInfo } | undefined

/**
 * Read display name and email from ~/.claude.json.
 *
 * That file holds the full Claude Code state and can be tens of kilobytes, so
 * it is only re-parsed when its mtime changes — the auth state is re-read on
 * every poll and must stay cheap.
 */
function loadAccountInfo(): AccountInfo {
  const claudeConfigPath = path.join(os.homedir(), '.claude.json')

  try {
    const { mtimeMs } = fs.statSync(claudeConfigPath)

    if (accountCache && accountCache.mtimeMs === mtimeMs) {
      return accountCache.info
    }

    const config: ClaudeConfig = JSON.parse(
      fs.readFileSync(claudeConfigPath, 'utf-8'),
    )

    const info: AccountInfo = config.oauthAccount
      ? {
          email: config.oauthAccount.emailAddress,
          displayName: config.oauthAccount.displayName,
        }
      : FALLBACK_ACCOUNT

    accountCache = { mtimeMs, info }
    return info
  } catch (error) {
    // Missing or unreadable ~/.claude.json only costs us the display name.
    return accountCache?.info ?? FALLBACK_ACCOUNT
  }
}

/**
 * Read the current auth state from disk.
 *
 * Called before every API request rather than once at activation: Claude Code
 * rotates the access token roughly every 8 hours, and a window that cached the
 * token at startup would keep using a dead one for the rest of its life.
 */
export async function loadAuthState(): Promise<AuthState> {
  const token = await getTokenState()

  if (token.kind !== 'ok') {
    return token
  }

  const account = loadAccountInfo()

  return {
    kind: 'ok',
    auth: {
      accessToken: token.accessToken,
      email: account.email,
      displayName: account.displayName,
      subscriptionType: token.subscriptionType,
      expiresAt: token.expiresAt,
    },
  }
}
