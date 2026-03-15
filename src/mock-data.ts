import { AuthData, ClaudeUsage } from './types'

export const MOCK_AUTH: AuthData = {
  accessToken: 'mock',
  email: 'spam@mail.org',
  displayName: 'Token Enjoyer',
  subscriptionType: 'max',
}

const now = Date.now()
export const MOCK_USAGE: ClaudeUsage = {
  five_hour: { utilization: 67, resets_at: new Date(now + 1.7 * 3_600_000).toISOString() },
  seven_day: { utilization: 34, resets_at: new Date(now + 3.3 * 86_400_000).toISOString() },
  seven_day_opus: { utilization: 82, resets_at: new Date(now + 3.3 * 86_400_000).toISOString() },
  seven_day_oauth_apps: { utilization: 12, resets_at: new Date(now + 5.9 * 86_400_000).toISOString() },
}
