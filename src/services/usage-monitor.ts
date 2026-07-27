import * as vscode from 'vscode'
import { fetchUsage } from '../claude-client'
import { AuthState, loadAuthState } from '../auth/auth-manager'
import {
  AuthProblem,
  CachedError,
  ClaudeUsage,
  FetchFailure,
  UsageCacheRecord,
} from '../types'
import {
  acquireFetchLock,
  fingerprint,
  readCache,
  releaseFetchLock,
  writeCache,
} from './usage-cache'
import { activeBlockUntil, backoffMs, shouldFetch } from './fetch-policy'
import { buildUsageRows } from '../ui/usage-rows'
import { decideWarnings } from './usage-warnings'
import { render } from '../ui/status-bar'

/** How often each window re-reads the shared cache and re-renders. */
export const TICK_MS = 15000

/** Floor on the configured poll interval, to stop a low value self-inflicting 429s. */
const MIN_INTERVAL_MS = 30000

const WARN_THRESHOLD = 90

let tickTimer: NodeJS.Timeout | undefined
let wakeTimer: NodeJS.Timeout | undefined
let fetching = false

/**
 * Small margin added when waking for an expired backoff, so the deadline is
 * comfortably in the past by the time the tick re-reads the clock.
 */
const WAKE_MARGIN_MS = 500

/**
 * Retry the moment the backoff actually expires.
 *
 * The tooltip counts the backoff down, so with only a 15s tick it would sit at
 * "0s" for up to another full tick before anything happened. A one-shot timer
 * closes that gap; longer waits need nothing, as a regular tick lands first.
 */
function scheduleWake(blockedUntil: number): void {
  const delay = blockedUntil - Date.now() + WAKE_MARGIN_MS
  if (delay >= TICK_MS) {
    return
  }

  if (wakeTimer) {
    clearTimeout(wakeTimer)
  }
  wakeTimer = setTimeout(() => {
    wakeTimer = undefined
    safeTick()
  }, Math.max(0, delay))
}

function intervalMs(): number {
  const configured =
    vscode.workspace
      .getConfiguration('claudeUsage')
      .get<number>('updateInterval') || 300
  return Math.max(MIN_INTERVAL_MS, configured * 1000)
}

function authProblemOf(state: AuthState): AuthProblem | null {
  return state.kind === 'ok' ? null : state
}

function toCachedError(failure: FetchFailure, at: number): CachedError {
  return {
    kind: failure.kind,
    message: failure.message,
    status: 'status' in failure ? failure.status : undefined,
    at,
  }
}

function draw(record: UsageCacheRecord, authState: AuthState): void {
  render({
    record,
    auth: authState.kind === 'ok' ? authState.auth : null,
    authProblem: authProblemOf(authState),
    intervalMs: intervalMs(),
    fetching,
  })
}

/**
 * One monitor step: render what is known, then fetch only if this window is the
 * one that should, and only if the data is actually due.
 */
async function tick(force = false): Promise<void> {
  const authState = await loadAuthState()
  let record = readCache()

  draw(record, authState)

  if (authState.kind !== 'ok') {
    // No usable token — nothing to send. The next tick re-reads the credentials,
    // so a token Claude Code refreshes in the meantime is picked up on its own.
    return
  }

  const token = authState.auth.accessToken
  const currentFingerprint = fingerprint(token)

  if (!shouldFetch(record, currentFingerprint, Date.now(), intervalMs(), force)) {
    const blockedUntil = activeBlockUntil(record, currentFingerprint, Date.now())
    if (blockedUntil !== null) {
      scheduleWake(blockedUntil)
    }
    return
  }

  if (!acquireFetchLock()) {
    // Another window is already fetching; its result lands in the shared cache
    // and this window renders it on the next tick.
    return
  }

  try {
    // Re-read under the lock: the winner of a previous round may have just
    // written a fresh result.
    record = readCache()
    if (!force && !shouldFetch(record, currentFingerprint, Date.now(), intervalMs(), false)) {
      return
    }

    fetching = true
    draw(record, authState)

    const outcome = await fetchUsage(token)
    const now = Date.now()

    if (outcome.kind === 'ok') {
      record = {
        ...record,
        usage: outcome.usage,
        fetchedAt: now,
        lastError: null,
        consecutiveFailures: 0,
        blockedUntil: 0,
        tokenFingerprint: currentFingerprint,
      }
      record = applyNotifications(record, outcome.usage)
    } else {
      const consecutiveFailures =
        record.tokenFingerprint === currentFingerprint
          ? record.consecutiveFailures + 1
          : 1
      record = {
        ...record,
        lastError: toCachedError(outcome, now),
        consecutiveFailures,
        blockedUntil: now + backoffMs(outcome, consecutiveFailures),
        tokenFingerprint: currentFingerprint,
      }
      console.error(
        `Claude usage fetch failed (${outcome.kind}): ${outcome.message}; ` +
          `next attempt in ${Math.round((record.blockedUntil - now) / 1000)}s`,
      )
    }

    writeCache(record)
  } finally {
    fetching = false
    releaseFetchLock()
    draw(record, authState)
  }
}

/**
 * Raise at most one warning per limit per reset cycle, recording it in the
 * shared cache so the other windows stay quiet.
 *
 * Driven by the same rows the tooltip renders, so every limit on display can
 * warn and a limit the account does not have stays silent — the two views
 * cannot disagree about which limits exist.
 */
function applyNotifications(
  record: UsageCacheRecord,
  usage: ClaudeUsage,
): UsageCacheRecord {
  const enabled = vscode.workspace
    .getConfiguration('claudeUsage')
    .get<boolean>('showNotifications')

  const { notifiedResets, warnings } = decideWarnings(
    buildUsageRows(usage),
    record.notifiedResets,
    WARN_THRESHOLD,
  )

  if (enabled && warnings.length > 0) {
    vscode.window.showWarningMessage(
      `Claude usage warning: ${warnings.join(', ')}`,
    )
  }

  return { ...record, notifiedResets }
}

/** Never let one bad tick take the timer down with it. */
function safeTick(force = false): void {
  tick(force).catch((error) => {
    console.error('Claude usage monitor tick failed:', error)
  })
}

export function startMonitor(): void {
  stopMonitor()
  // Small stagger so windows opened together do not all race for the lock at
  // the exact same millisecond.
  const jitter = Math.floor(Math.random() * 2000)
  setTimeout(() => {
    safeTick()
    tickTimer = setInterval(() => safeTick(), TICK_MS)
  }, jitter)
}

export function stopMonitor(): void {
  if (tickTimer) {
    clearInterval(tickTimer)
    tickTimer = undefined
  }
  if (wakeTimer) {
    clearTimeout(wakeTimer)
    wakeTimer = undefined
  }
}

/**
 * Force an immediate fetch, ignoring both the poll interval and any active
 * backoff. Backs the Refresh action in the tooltip.
 */
export async function refreshNow(): Promise<void> {
  await tick(true)
}
