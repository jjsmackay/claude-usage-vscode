import axios from 'axios'
import { AuthData, ClaudeUsage } from './types'

export class ClaudeAPIClient {
  private authData: AuthData
  private baseUrl = 'https://api.anthropic.com'
  private lastUsage: ClaudeUsage | null = null

  constructor(authData: AuthData) {
    this.authData = authData
  }

  async getUsage(): Promise<ClaudeUsage | null> {
    try {
      const url = `${this.baseUrl}/api/oauth/usage`

      const headers = {
        Authorization: `Bearer ${this.authData.accessToken}`,
        'Content-Type': 'application/json',
        'anthropic-beta':
          'oauth-2025-04-20,fine-grained-tool-streaming-2025-05-14',
      }

      const response = await axios.get(url, { headers })

      if (response.status === 200) {
        this.lastUsage = response.data
        console.log('✅ Claude Stats retrieved successfully')
        return this.lastUsage
      }

      console.error('⚠️ Unexpected status:', response.status)
      return this.lastUsage
    } catch (error) {
      console.error('❌ Error getting Claude Stats')
      if (axios.isAxiosError(error)) {
        console.error('Status:', error.response?.status)
        console.error('Error:', error.response?.data?.error?.message)
      }
      return this.lastUsage
    }
  }
}
