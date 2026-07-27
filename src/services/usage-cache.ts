import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { UsageCacheRecord } from '../types'

const CACHE_VERSION = 1
const CACHE_FILE = 'usage-cache.json'
const LOCK_FILE = 'usage-fetch.lock'

/**
 * A lock older than this is assumed to belong to a window that was killed
 * mid-fetch. Must comfortably exceed the API request timeout.
 */
const LOCK_STALE_MS = 60000

let cacheDir: string | undefined
let holdsLock = false

export const EMPTY_RECORD: UsageCacheRecord = {
  version: CACHE_VERSION,
  usage: null,
  fetchedAt: null,
  lastError: null,
  consecutiveFailures: 0,
  blockedUntil: 0,
  tokenFingerprint: null,
  notifiedResets: {},
}

/**
 * Point the cache at the extension's global storage directory. That path is per
 * extension, not per window, which is what makes the record shared.
 */
export function initCache(directory: string): void {
  cacheDir = directory
  try {
    fs.mkdirSync(directory, { recursive: true })
  } catch (error) {
    console.error('Could not create cache directory:', error)
  }
}

function cachePath(): string {
  if (!cacheDir) {
    throw new Error('Usage cache used before initCache()')
  }
  return path.join(cacheDir, CACHE_FILE)
}

function lockPath(): string {
  if (!cacheDir) {
    throw new Error('Usage cache used before initCache()')
  }
  return path.join(cacheDir, LOCK_FILE)
}

/**
 * Short, non-reversible identifier for an access token. Lets us notice that
 * Claude Code rotated the token without ever writing token material to disk.
 */
export function fingerprint(accessToken: string): string {
  return crypto
    .createHash('sha256')
    .update(accessToken)
    .digest('hex')
    .slice(0, 12)
}

export function readCache(): UsageCacheRecord {
  let raw: string
  try {
    raw = fs.readFileSync(cachePath(), 'utf-8')
  } catch (error) {
    return { ...EMPTY_RECORD }
  }

  try {
    const parsed = JSON.parse(raw) as UsageCacheRecord
    if (parsed.version !== CACHE_VERSION) {
      return { ...EMPTY_RECORD }
    }
    return { ...EMPTY_RECORD, ...parsed }
  } catch (error) {
    return { ...EMPTY_RECORD }
  }
}

export function writeCache(record: UsageCacheRecord): void {
  const target = cachePath()
  const temp = `${target}.${process.pid}.tmp`
  const payload = JSON.stringify({ ...record, version: CACHE_VERSION }, null, 2)

  try {
    fs.writeFileSync(temp, payload, 'utf-8')
    // Rename is atomic, so a window reading concurrently never sees a partial
    // record. On Windows this replaces the destination.
    fs.renameSync(temp, target)
  } catch (error) {
    try {
      fs.unlinkSync(temp)
    } catch {
      // Nothing to clean up.
    }
    try {
      fs.writeFileSync(target, payload, 'utf-8')
    } catch (fallbackError) {
      console.error('Could not write usage cache:', fallbackError)
    }
  }
}

function removeStaleLock(): void {
  try {
    const { mtimeMs } = fs.statSync(lockPath())
    if (Date.now() - mtimeMs > LOCK_STALE_MS) {
      fs.unlinkSync(lockPath())
    }
  } catch {
    // No lock, or another window removed it first.
  }
}

/**
 * Try to become the single window that talks to the API this round.
 *
 * Uses an exclusive create, which is atomic on every supported platform, so at
 * most one window across all extension hosts wins.
 */
export function acquireFetchLock(): boolean {
  removeStaleLock()

  try {
    const fd = fs.openSync(lockPath(), 'wx')
    fs.writeSync(fd, `${process.pid} ${new Date().toISOString()}`)
    fs.closeSync(fd)
    holdsLock = true
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      return false
    }
    console.error('Could not acquire fetch lock:', error)
    return false
  }
}

/** Releasing is a no-op unless this window is the holder, so one window
 * shutting down cannot free another window's lock. */
export function releaseFetchLock(): void {
  if (!holdsLock) {
    return
  }
  holdsLock = false
  try {
    fs.unlinkSync(lockPath())
  } catch {
    // Already gone.
  }
}
