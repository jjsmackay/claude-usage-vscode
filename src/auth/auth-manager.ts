import { AuthData, ClaudeConfig } from '../types'
import { MacOSKeychainAccess } from './keychain-access'
import { CredentialsAccess } from './credentials-access'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

async function getTokenData(): Promise<{
  accessToken: string
  subscriptionType?: string
} | null> {
  if (process.platform === 'darwin') {
    const keychain = new MacOSKeychainAccess()
    return keychain.getClaudeToken()
  } else {
    const credFile = new CredentialsAccess()
    return credFile.getClaudeToken()
  }
}

export async function loadAuthData(): Promise<AuthData | null> {
  try {
    const tokenData = await getTokenData()

    if (!tokenData) {
      return null
    }

    // Load user info from ~/.claude.json
    let email = 'Claude Code User'
    let displayName: string | undefined

    try {
      const claudeConfigPath = path.join(os.homedir(), '.claude.json')
      if (fs.existsSync(claudeConfigPath)) {
        const configContent = fs.readFileSync(claudeConfigPath, 'utf-8')
        const config: ClaudeConfig = JSON.parse(configContent)

        if (config.oauthAccount) {
          email = config.oauthAccount.emailAddress
          displayName = config.oauthAccount.displayName
          console.log('✅ User info loaded:', displayName || email)
        }
      }
    } catch (configError) {
      console.warn('⚠️ Could not load ~/.claude.json:', configError)
    }

    return {
      accessToken: tokenData.accessToken,
      email,
      displayName,
      subscriptionType: tokenData.subscriptionType,
    }
  } catch (error) {
    console.error('Error loading auth data:', error)
    return null
  }
}