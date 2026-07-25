export interface AuthData {
  accessToken: string
  email: string
  displayName?: string
  subscriptionType?: string
  expiresAt?: number
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
 * Result of reading the OAuth token from the platform credential store.
 *
 * An expired token is reported as its own state rather than as a missing one:
 * Claude Code rotates the token in place, so "expired right now" is a
 * recoverable condition that must not put the extension into a terminal state.
 */
export type AuthProblem =
  | { kind: 'expired'; expiresAt: number }
  | { kind: 'missing'; reason: string }

export type TokenState =
  | {
      kind: 'ok'
      accessToken: string
      subscriptionType?: string
      expiresAt?: number
    }
  | AuthProblem

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

export interface CachedError {
  kind: FetchFailure['kind']
  message: string
  status?: number
  at: number
}

/**
 * Shared across every VSCode window. Each window runs its own extension host
 * with its own timers, so this file on disk is the only place they can agree on
 * what the usage is, when it was last fetched, and when the API may be called
 * again.
 */
export interface UsageCacheRecord {
  version: number
  usage: ClaudeUsage | null
  /** Epoch ms of the last *successful* fetch, by any window. */
  fetchedAt: number | null
  lastError: CachedError | null
  consecutiveFailures: number
  /** Epoch ms before which no window may call the API. */
  blockedUntil: number
  /**
   * Fingerprint of the access token used for the last attempt. Rate limiting is
   * enforced per token, so a rotated token means the block no longer applies.
   */
  tokenFingerprint: string | null
  /**
   * Window key -> the `resets_at` it was last warned about. Shared so that five
   * windows do not raise five identical notifications, and so a limit is only
   * announced once per reset cycle.
   */
  notifiedResets: Record<string, string>
}
