import * as assert from 'assert'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  acquireFetchLock,
  fingerprint,
  initCache,
  readCache,
  releaseFetchLock,
  writeCache,
} from '../../services/usage-cache'

let dir: string

suite('Usage Cache Test Suite', () => {
  setup(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-usage-cache-'))
    initCache(dir)
  })

  teardown(() => {
    releaseFetchLock()
    fs.rmSync(dir, { recursive: true, force: true })
  })

  test('returns an empty record when no cache file exists', () => {
    const record = readCache()
    assert.strictEqual(record.usage, null)
    assert.strictEqual(record.fetchedAt, null)
    assert.strictEqual(record.blockedUntil, 0)
  })

  test('round-trips a record through the shared file', () => {
    writeCache({
      version: 1,
      usage: { five_hour: { utilization: 42, resets_at: null } },
      fetchedAt: 1234,
      lastError: null,
      consecutiveFailures: 0,
      blockedUntil: 0,
      tokenFingerprint: 'abc',
      notifiedResets: {},
    })

    const record = readCache()
    assert.strictEqual(record.usage?.five_hour?.utilization, 42)
    assert.strictEqual(record.fetchedAt, 1234)
    assert.strictEqual(record.tokenFingerprint, 'abc')
  })

  test('falls back to an empty record on corrupt JSON', () => {
    fs.writeFileSync(path.join(dir, 'usage-cache.json'), '{ truncated', 'utf-8')
    assert.strictEqual(readCache().fetchedAt, null)
  })

  test('never writes token material to disk', () => {
    const token = 'sk-ant-oat01-super-secret-value'
    writeCache({
      version: 1,
      usage: null,
      fetchedAt: null,
      lastError: null,
      consecutiveFailures: 0,
      blockedUntil: 0,
      tokenFingerprint: fingerprint(token),
      notifiedResets: {},
    })

    const raw = fs.readFileSync(path.join(dir, 'usage-cache.json'), 'utf-8')
    assert.ok(!raw.includes(token))
    assert.ok(raw.includes(fingerprint(token)))
  })

  test('fingerprints differ per token and are stable', () => {
    assert.strictEqual(fingerprint('token-a'), fingerprint('token-a'))
    assert.notStrictEqual(fingerprint('token-a'), fingerprint('token-b'))
  })

  test('only one holder can take the fetch lock', () => {
    assert.strictEqual(acquireFetchLock(), true)
    // A second window in this process would fail the exclusive create.
    assert.strictEqual(fs.existsSync(path.join(dir, 'usage-fetch.lock')), true)

    releaseFetchLock()
    assert.strictEqual(fs.existsSync(path.join(dir, 'usage-fetch.lock')), false)
  })

  test('a foreign lock blocks acquisition', () => {
    fs.writeFileSync(path.join(dir, 'usage-fetch.lock'), 'other window', 'utf-8')
    assert.strictEqual(acquireFetchLock(), false)
  })

  test('a stale lock is broken so a crashed window cannot wedge polling', () => {
    const lock = path.join(dir, 'usage-fetch.lock')
    fs.writeFileSync(lock, 'dead window', 'utf-8')
    const twoMinutesAgo = new Date(Date.now() - 120_000)
    fs.utimesSync(lock, twoMinutesAgo, twoMinutesAgo)

    assert.strictEqual(acquireFetchLock(), true)
  })

  test('releasing is a no-op when this window is not the holder', () => {
    const lock = path.join(dir, 'usage-fetch.lock')
    fs.writeFileSync(lock, 'other window', 'utf-8')

    releaseFetchLock()

    assert.strictEqual(fs.existsSync(lock), true)
  })
})
