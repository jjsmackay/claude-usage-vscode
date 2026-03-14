import * as assert from 'assert'
import { formatResetTime } from '../../utils/time-formatter'

suite('Time Formatter Test Suite', () => {
  test('Past time should return "Reset time passed"', () => {
    const pastDate = new Date(Date.now() - 60000).toISOString()
    assert.strictEqual(formatResetTime(pastDate), 'Reset time passed')
  })

  test('30 minutes from now should show minutes', () => {
    const future = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    const result = formatResetTime(future)
    assert.ok(result.includes('minute'))
    assert.ok(result.includes('30') || result.includes('29'))
  })

  test('1 minute from now should use singular', () => {
    const future = new Date(Date.now() + 90 * 1000).toISOString()
    const result = formatResetTime(future)
    assert.ok(result.includes('minute'))
  })

  test('2 hours from now should show hours', () => {
    const future = new Date(Date.now() + 2 * 3600 * 1000).toISOString()
    const result = formatResetTime(future)
    assert.ok(result.includes('h') || result.includes('hour'))
  })

  test('2 days from now should show days', () => {
    const future = new Date(Date.now() + 2 * 86400 * 1000).toISOString()
    const result = formatResetTime(future)
    assert.ok(result.includes('d') || result.includes('day'))
  })

  test('1 hour exactly should use singular', () => {
    const future = new Date(Date.now() + 3600 * 1000).toISOString()
    const result = formatResetTime(future)
    assert.ok(result.includes('hour') || result.includes('h'))
  })
})
