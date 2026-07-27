import { FetchFailure, UsageCacheRecord } from '../types'

const MAX_BACKOFF_MS = 15 * 60 * 1000

/**
 * How long every window should stay off the API after a failure.
 *
 * The delay is stored in the shared cache, so a rate limit backs off the account
 * as a whole rather than each window individually.
 */
export function backoffMs(
  failure: FetchFailure,
  consecutiveFailures: number,
): number {
  const attempt = Math.max(1, consecutiveFailures)
  const grow = (base: number, cap: number) =>
    Math.min(cap, base * Math.pow(2, attempt - 1))

  switch (failure.kind) {
    case 'rate-limited':
      // The server's own Retry-After wins when it sends one.
      return failure.retryAfterMs !== null
        ? Math.max(failure.retryAfterMs, 60000)
        : grow(60000, MAX_BACKOFF_MS)
    case 'unauthorized':
      return grow(60000, 5 * 60 * 1000)
    case 'http-error':
      return grow(60000, 10 * 60 * 1000)
    case 'network-error':
      return grow(30000, 5 * 60 * 1000)
  }
}

/**
 * When a backoff is currently in force, the moment it expires; null otherwise.
 *
 * A block is dropped as soon as the access token changes: the usage endpoint
 * counts rate limits per token, so a token Claude Code has since rotated starts
 * with a clean allowance. Without this, a window that got rate limited would
 * keep serving the penalty on a token that is no longer even in use.
 */
export function activeBlockUntil(
  record: UsageCacheRecord,
  currentFingerprint: string,
  now: number,
): number | null {
  const blockedOnSameToken =
    now < record.blockedUntil && record.tokenFingerprint === currentFingerprint

  return blockedOnSameToken ? record.blockedUntil : null
}

/**
 * Decide whether a tick may call the API.
 */
export function shouldFetch(
  record: UsageCacheRecord,
  currentFingerprint: string,
  now: number,
  pollIntervalMs: number,
  force: boolean,
): boolean {
  if (force) {
    return true
  }

  if (activeBlockUntil(record, currentFingerprint, now) !== null) {
    return false
  }

  return record.fetchedAt === null || now - record.fetchedAt >= pollIntervalMs
}

/**
 * Data older than this is flagged in the UI rather than shown as if it were
 * current. Scales with the poll interval but never waits longer than 3 minutes
 * before warning.
 */
export function staleAfterMs(pollIntervalMs: number): number {
  return Math.min(3 * 60 * 1000, Math.max(pollIntervalMs * 2, 90 * 1000))
}
