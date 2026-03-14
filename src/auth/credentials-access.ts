import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

export class CredentialsAccess {
  private credentialsPath: string

  constructor() {
    this.credentialsPath = path.join(os.homedir(), '.claude', '.credentials.json')
  }

  async getClaudeToken(): Promise<{
    accessToken: string
    subscriptionType?: string
  } | null> {
    try {
      if (!fs.existsSync(this.credentialsPath)) {
        console.error('❌ Credentials file not found:', this.credentialsPath)
        return null
      }

      const content = fs.readFileSync(this.credentialsPath, 'utf-8')
      const data = JSON.parse(content)

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

        console.log('✅ Token retrieved from credentials file')
        return {
          accessToken: token,
          subscriptionType,
        }
      }

      console.error('⚠️ claudeAiOauth not found in credentials file')
      return data.accessToken ? { accessToken: data.accessToken } : null
    } catch (error) {
      console.error('❌ Error reading credentials file:', error)
      return null
    }
  }
}
