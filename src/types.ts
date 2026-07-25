export interface AuthData {
  accessToken: string
  email: string
  displayName?: string
  subscriptionType?: string
}

export interface ClaudeConfig {
  oauthAccount?: {
    accountUuid: string
    emailAddress: string
    organizationUuid: string
    displayName: string
    organizationRole: string
    workspaceRole: string | null
    organizationName: string
  }
}

export interface UsageWindow {
  utilization: number
  resets_at: string | null
}

export interface ClaudeUsage {
  five_hour?: UsageWindow
  seven_day?: UsageWindow
  seven_day_oauth_apps?: UsageWindow
  seven_day_opus?: UsageWindow
}

/**
 * Outcome of a single usage API call. Every failure mode the endpoint can
 * produce is a distinct variant so the UI can name the actual problem instead
 * of guessing.
 */
export type FetchOutcome =
  | { kind: 'ok'; usage: ClaudeUsage }
  | { kind: 'rate-limited'; message: string; retryAfterMs: number | null }
  | { kind: 'unauthorized'; message: string; status: number }
  | { kind: 'http-error'; message: string; status: number }
  | { kind: 'network-error'; message: string; code?: string }

export type FetchFailure = Exclude<FetchOutcome, { kind: 'ok' }>
