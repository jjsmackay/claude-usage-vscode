import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { TokenState } from '../types'

export class CredentialsAccess {
  private credentialsPath: string

  constructor() {
    this.credentialsPath = path.join(os.homedir(), '.claude', '.credentials.json')
  }

  async getClaudeToken(): Promise<TokenState> {
    let content: string
    try {
      content = fs.readFileSync(this.credentialsPath, 'utf-8')
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'ENOENT') {
        return {
          kind: 'missing',
          reason: `Credentials file not found: ${this.credentialsPath}`,
        }
      }
      return {
        kind: 'missing',
        reason: `Could not read ${this.credentialsPath}: ${String(error)}`,
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
      data = JSON.parse(content)
    } catch (error) {
      // Claude Code rewrites this file on token rotation; a read that lands
      // mid-write yields truncated JSON. Treat it as transient.
      return {
        kind: 'missing',
        reason: 'Credentials file is not valid JSON (possibly mid-rotation)',
      }
    }

    if (data.claudeAiOauth) {
      const { accessToken, expiresAt, subscriptionType } = data.claudeAiOauth

      if (!accessToken) {
        return { kind: 'missing', reason: 'No access token in credentials file' }
      }

      if (expiresAt && Date.now() > expiresAt) {
        return { kind: 'expired', expiresAt }
      }

      return { kind: 'ok', accessToken, subscriptionType, expiresAt }
    }

    if (data.accessToken) {
      return { kind: 'ok', accessToken: data.accessToken }
    }

    return {
      kind: 'missing',
      reason: 'claudeAiOauth not found in credentials file',
    }
  }
}
