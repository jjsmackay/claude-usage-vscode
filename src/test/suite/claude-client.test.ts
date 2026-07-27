import * as assert from 'assert'
import { parseRetryAfter } from '../../claude-client'

const NOW = 1_700_000_000_000

suite('Retry-After Parsing Test Suite', () => {
  test('parses delta-seconds', () => {
    assert.strictEqual(parseRetryAfter('120', NOW), 120_000)
  })

  test('tolerates surrounding whitespace', () => {
    assert.strictEqual(parseRetryAfter('  45 ', NOW), 45_000)
  })

  test('parses an HTTP date into a delay', () => {
    const header = new Date(NOW + 90_000).toUTCString()
    assert.strictEqual(parseRetryAfter(header, NOW), 90_000)
  })

  test('clamps a past HTTP date to zero', () => {
    const header = new Date(NOW - 90_000).toUTCString()
    assert.strictEqual(parseRetryAfter(header, NOW), 0)
  })

  test('returns null when the header is absent', () => {
    assert.strictEqual(parseRetryAfter(undefined, NOW), null)
  })

  test('returns null for an unparseable header', () => {
    assert.strictEqual(parseRetryAfter('soon', NOW), null)
  })
})
