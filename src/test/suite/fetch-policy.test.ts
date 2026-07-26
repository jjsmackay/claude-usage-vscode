import * as assert from 'assert'
import {
  activeBlockUntil,
  backoffMs,
  shouldFetch,
  staleAfterMs,
} from '../../services/fetch-policy'
import { UsageCacheRecord } from '../../types'

const NOW = 1_700_000_000_000
const POLL = 60_000
const TOKEN = 'abc123def456'

function record(overrides: Partial<UsageCacheRecord> = {}): UsageCacheRecord {
  return {
    version: 1,
    usage: null,
    fetchedAt: null,
    lastError: null,
    consecutiveFailures: 0,
    blockedUntil: 0,
    tokenFingerprint: null,
    notifiedResets: {},
    ...overrides,
  }
}

suite('Fetch Policy Test Suite', () => {
  suite('shouldFetch', () => {
    test('fetches when nothing has ever been fetched', () => {
      assert.strictEqual(shouldFetch(record(), TOKEN, NOW, POLL, false), true)
    })

    test('skips while the cached data is still within the poll interval', () => {
      const r = record({ fetchedAt: NOW - 30_000 })
      assert.strictEqual(shouldFetch(r, TOKEN, NOW, POLL, false), false)
    })

    test('fetches once the poll interval has elapsed', () => {
      const r = record({ fetchedAt: NOW - POLL })
      assert.strictEqual(shouldFetch(r, TOKEN, NOW, POLL, false), true)
    })

    test('respects an active backoff on the same token', () => {
      const r = record({ blockedUntil: NOW + 120_000, tokenFingerprint: TOKEN })
      assert.strictEqual(shouldFetch(r, TOKEN, NOW, POLL, false), false)
    })

    test('drops the backoff when the token was rotated', () => {
      // The observed failure mode: a burned token stays rate limited forever
      // while Claude Code has already issued a fresh one.
      const r = record({ blockedUntil: NOW + 120_000, tokenFingerprint: 'old-token' })
      assert.strictEqual(shouldFetch(r, TOKEN, NOW, POLL, false), true)
    })

    test('fetches again once the backoff has expired', () => {
      const r = record({ blockedUntil: NOW - 1, tokenFingerprint: TOKEN })
      assert.strictEqual(shouldFetch(r, TOKEN, NOW, POLL, false), true)
    })

    test('force overrides both freshness and backoff', () => {
      const r = record({
        fetchedAt: NOW,
        blockedUntil: NOW + 600_000,
        tokenFingerprint: TOKEN,
      })
      assert.strictEqual(shouldFetch(r, TOKEN, NOW, POLL, true), true)
    })
  })

  suite('activeBlockUntil', () => {
    test('reports the deadline while a backoff is in force', () => {
      const r = record({ blockedUntil: NOW + 45_000, tokenFingerprint: TOKEN })
      assert.strictEqual(activeBlockUntil(r, TOKEN, NOW), NOW + 45_000)
    })

    test('is null once the deadline has passed', () => {
      const r = record({ blockedUntil: NOW, tokenFingerprint: TOKEN })
      assert.strictEqual(activeBlockUntil(r, TOKEN, NOW), null)
    })

    test('is null when there is no backoff at all', () => {
      assert.strictEqual(activeBlockUntil(record(), TOKEN, NOW), null)
    })

    test('is null when the token was rotated', () => {
      const r = record({ blockedUntil: NOW + 45_000, tokenFingerprint: 'old' })
      assert.strictEqual(activeBlockUntil(r, TOKEN, NOW), null)
    })
  })

  suite('backoffMs', () => {
    test('honours Retry-After from the server', () => {
      const delay = backoffMs(
        { kind: 'rate-limited', message: 'slow down', retryAfterMs: 300_000 },
        1,
      )
      assert.strictEqual(delay, 300_000)
    })

    test('never retries a rate limit sooner than a minute', () => {
      const delay = backoffMs(
        { kind: 'rate-limited', message: 'slow down', retryAfterMs: 1_000 },
        1,
      )
      assert.strictEqual(delay, 60_000)
    })

    test('doubles the rate limit wait on repeated failures', () => {
      const failure = {
        kind: 'rate-limited' as const,
        message: 'slow down',
        retryAfterMs: null,
      }
      assert.strictEqual(backoffMs(failure, 1), 60_000)
      assert.strictEqual(backoffMs(failure, 2), 120_000)
      assert.strictEqual(backoffMs(failure, 3), 240_000)
    })

    test('caps the rate limit wait at 15 minutes', () => {
      const failure = {
        kind: 'rate-limited' as const,
        message: 'slow down',
        retryAfterMs: null,
      }
      assert.strictEqual(backoffMs(failure, 20), 15 * 60 * 1000)
    })

    test('backs off network errors more gently than rate limits', () => {
      const network = backoffMs({ kind: 'network-error', message: 'ENOTFOUND' }, 1)
      const limited = backoffMs(
        { kind: 'rate-limited', message: 'slow down', retryAfterMs: null },
        1,
      )
      assert.ok(network < limited)
      assert.strictEqual(network, 30_000)
    })

    test('caps unauthorized retries at 5 minutes', () => {
      const delay = backoffMs(
        { kind: 'unauthorized', message: 'Invalid bearer token', status: 401 },
        50,
      )
      assert.strictEqual(delay, 5 * 60 * 1000)
    })
  })

  suite('staleAfterMs', () => {
    test('warns within 3 minutes even for long poll intervals', () => {
      assert.strictEqual(staleAfterMs(60 * 60 * 1000), 3 * 60 * 1000)
    })

    test('allows at least 90 seconds for short poll intervals', () => {
      assert.strictEqual(staleAfterMs(30_000), 90_000)
    })

    test('scales with the poll interval in between', () => {
      assert.strictEqual(staleAfterMs(60_000), 120_000)
    })
  })
})
