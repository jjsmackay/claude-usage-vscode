import axios from 'axios'
import { FetchOutcome } from './types'

const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage'
const REQUEST_TIMEOUT_MS = 15000

interface ApiErrorBody {
  error?: { message?: string; type?: string }
}

function messageFrom(data: unknown, fallback: string): string {
  const message = (data as ApiErrorBody | undefined)?.error?.message
  return typeof message === 'string' && message.length > 0 ? message : fallback
}

/**
 * Parse a Retry-After header, which may be either delta-seconds or an HTTP date.
 */
export function parseRetryAfter(
  header: unknown,
  now: number = Date.now(),
): number | null {
  if (typeof header !== 'string' || header.trim() === '') {
    return null
  }

  const seconds = Number(header.trim())
  if (Number.isFinite(seconds)) {
    return seconds > 0 ? Math.round(seconds * 1000) : 0
  }

  const asDate = Date.parse(header)
  if (Number.isFinite(asDate)) {
    return Math.max(0, asDate - now)
  }

  return null
}

/**
 * Fetch usage for a single access token.
 *
 * The token is a parameter rather than constructor state so every call uses
 * whatever Claude Code has on disk right now. Nothing is cached here — the
 * shared cache owns that, together with the timestamp the data was fetched at,
 * so stale data can never be presented as fresh.
 */
export async function fetchUsage(accessToken: string): Promise<FetchOutcome> {
  let response
  try {
    response = await axios.get(USAGE_URL, {
      timeout: REQUEST_TIMEOUT_MS,
      validateStatus: () => true,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'anthropic-beta':
          'oauth-2025-04-20,fine-grained-tool-streaming-2025-05-14',
      },
    })
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const code = error.code
      const message =
        code === 'ECONNABORTED' || code === 'ETIMEDOUT'
          ? `Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`
          : error.message
      return { kind: 'network-error', message, code }
    }
    return { kind: 'network-error', message: String(error) }
  }

  const { status, data, headers } = response

  if (status === 200) {
    return { kind: 'ok', usage: data }
  }

  if (status === 429) {
    return {
      kind: 'rate-limited',
      message: messageFrom(data, 'Rate limited by the Claude API'),
      retryAfterMs: parseRetryAfter(headers?.['retry-after']),
    }
  }

  if (status === 401 || status === 403) {
    return {
      kind: 'unauthorized',
      message: messageFrom(data, `Authentication failed (HTTP ${status})`),
      status,
    }
  }

  return {
    kind: 'http-error',
    message: messageFrom(data, `Unexpected response (HTTP ${status})`),
    status,
  }
}
