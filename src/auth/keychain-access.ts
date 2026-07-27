import { exec } from 'child_process'
import { promisify } from 'util'
import { userInfo } from 'os'
import { TokenState } from '../types'

const execPromise = promisify(exec)

export class MacOSKeychainAccess {
  private serviceName = 'Claude Code-credentials'
  private accountName: string

  constructor(accountName: string = userInfo().username) {
    this.accountName = accountName
  }

  async getPassword(
    service: string = this.serviceName,
    account: string = this.accountName,
  ): Promise<string | null> {
    try {
      const command = `security find-generic-password -s "${service}" -a "${account}" -w`
      const { stdout, stderr } = await execPromise(command)

      if (stderr) {
        console.warn('⚠️ Keychain warning:', stderr)
      }

      return stdout.trim()
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('could not be found')
      ) {
        return null
      }
      throw error
    }
  }

  async getClaudeToken(): Promise<TokenState> {
    let password: string | null
    try {
      password = await this.getPassword()
    } catch (error) {
      return { kind: 'missing', reason: `Keychain error: ${String(error)}` }
    }

    if (!password) {
      return {
        kind: 'missing',
        reason: `"${this.serviceName}" not found in Keychain`,
      }
    }

    let data: {
      claudeAiOauth?: {
        accessToken?: string
        expiresAt?: number
        subscriptionType?: string
      }
      accessToken?: string
    }
    try {
      data = JSON.parse(password)
    } catch (parseError) {
      // Simple string token
      return { kind: 'ok', accessToken: password }
    }

    if (data.claudeAiOauth) {
      const { accessToken, expiresAt, subscriptionType } = data.claudeAiOauth

      if (!accessToken) {
        return { kind: 'missing', reason: 'No access token in Keychain entry' }
      }

      if (expiresAt && Date.now() > expiresAt) {
        return { kind: 'expired', expiresAt }
      }

      return { kind: 'ok', accessToken, subscriptionType, expiresAt }
    }

    if (data.accessToken) {
      return { kind: 'ok', accessToken: data.accessToken }
    }

    return { kind: 'missing', reason: 'claudeAiOauth not found in Keychain entry' }
  }
}
