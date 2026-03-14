import { exec } from 'child_process'
import { promisify } from 'util'
import { userInfo } from 'os'

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
        console.error('❌ Credential not found in Keychain')
        return null
      }
      throw error
    }
  }

  async getClaudeToken(): Promise<{
    accessToken: string
    subscriptionType?: string
  } | null> {
    try {
      const password = await this.getPassword()
      if (!password) {
        console.error('❌ No password found in Keychain')
        return null
      }

      try {
        const data = JSON.parse(password)

        if (data.claudeAiOauth) {
          const token = data.claudeAiOauth.accessToken
          const expiresAt = data.claudeAiOauth.expiresAt
          const subscriptionType = data.claudeAiOauth.subscriptionType

          if (expiresAt && Date.now() > expiresAt) {
            console.error(
              '❌ Token expired at',
              new Date(expiresAt).toISOString(),
            )
            return null
          }

          console.log('✅ Token retrieved from Keychain')
          return {
            accessToken: token,
            subscriptionType,
          }
        }

        console.error('⚠️ claudeAiOauth not found in JSON')
        return data.accessToken ? { accessToken: data.accessToken } : null
      } catch (parseError) {
        // Simple string token
        return { accessToken: password }
      }
    } catch (error) {
      console.error('❌ Error accessing Keychain:', error)
      return null
    }
  }
}
