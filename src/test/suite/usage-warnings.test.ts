import * as assert from 'assert'
import { decideWarnings } from '../../services/usage-warnings'
import { buildUsageRows, UsageRow } from '../../ui/usage-rows'

const CYCLE = '2026-07-29T22:00:00Z'
const THRESHOLD = 90

const row = (
  label: string,
  utilization: number,
  resetsAt: string | null = CYCLE,
): UsageRow => ({
  label,
  key: label.toLowerCase(),
  utilization,
  resetsAt,
  usedForWarnings: true,
})

suite('Usage Warnings Test Suite', () => {
  test('says nothing when every limit is under the threshold', () => {
    const d = decideWarnings([row('5h', 90), row('7d', 12)], {}, THRESHOLD)
    assert.deepStrictEqual(d.warnings, [])
    assert.deepStrictEqual(d.notifiedResets, {})
  })

  test('warns for a limit above the threshold', () => {
    const d = decideWarnings([row('5h', 93.4)], {}, THRESHOLD)
    assert.deepStrictEqual(d.warnings, ['5h limit is 93.4% used'])
    assert.deepStrictEqual(d.notifiedResets, { '5h': CYCLE })
  })

  test('warns for every displayed limit, not a fixed subset', () => {
    // The previous implementation only ever warned about 5h, 7d and Opus.
    const rows = [row('5h', 91), row('7d Sonnet', 95), row('7d Fable', 99)]
    const d = decideWarnings(rows, {}, THRESHOLD)
    assert.deepStrictEqual(
      d.warnings.map((w) => w.replace(/ limit is .*$/, '')),
      ['5h', '7d Sonnet', '7d Fable'],
    )
  })

  test('says nothing about usage the user does not drive', () => {
    // OAuth-app usage is shown, but there is nothing the user can do about it,
    // so it is left out here exactly as it is left out of the banner.
    const rows = buildUsageRows({
      five_hour: { utilization: 10, resets_at: CYCLE },
      seven_day_oauth_apps: { utilization: 99, resets_at: CYCLE },
    })
    const d = decideWarnings(rows, {}, THRESHOLD)
    assert.deepStrictEqual(d.warnings, [])
    assert.deepStrictEqual(d.notifiedResets, {})
  })

  test('stays silent about a limit already announced this cycle', () => {
    const d = decideWarnings([row('7d', 95)], { '7d': CYCLE }, THRESHOLD)
    assert.deepStrictEqual(d.warnings, [])
    // The marker is carried over, so it keeps quiet on later polls too.
    assert.deepStrictEqual(d.notifiedResets, { '7d': CYCLE })
  })

  test('warns again once the limit resets into a new cycle', () => {
    const d = decideWarnings(
      [row('7d', 95, '2026-08-05T22:00:00Z')],
      { '7d': CYCLE },
      THRESHOLD,
    )
    assert.deepStrictEqual(d.warnings, ['7d limit is 95.0% used'])
  })

  test('drops the marker once a limit falls back under the threshold', () => {
    const d = decideWarnings([row('5h', 40)], { '5h': CYCLE }, THRESHOLD)
    assert.deepStrictEqual(d.notifiedResets, {})
  })

  test('warns again after dropping back under and rising within one cycle', () => {
    const dropped = decideWarnings([row('5h', 40)], { '5h': CYCLE }, THRESHOLD)
    const risen = decideWarnings([row('5h', 96)], dropped.notifiedResets, THRESHOLD)
    assert.deepStrictEqual(risen.warnings, ['5h limit is 96.0% used'])
  })

  test('forgets a limit that is no longer reported', () => {
    const d = decideWarnings([row('5h', 10)], { Opus: CYCLE }, THRESHOLD)
    assert.deepStrictEqual(d.notifiedResets, {})
  })

  test('treats a missing reset time as its own cycle', () => {
    const d = decideWarnings([row('Fable', 95, null)], {}, THRESHOLD)
    assert.deepStrictEqual(d.notifiedResets, { Fable: 'unknown' })
    assert.deepStrictEqual(d.warnings, ['Fable limit is 95.0% used'])
  })

  test('never warns about a limit the tooltip hides', () => {
    // A scoped limit at 0% and inactive produces no row, so it cannot warn.
    const rows = buildUsageRows({
      five_hour: { utilization: 95, resets_at: CYCLE },
      limits: [
        {
          kind: 'weekly_scoped',
          percent: 0,
          resets_at: null,
          is_active: false,
          scope: { model: { id: null, display_name: 'Fable' } },
        },
      ],
    })
    const d = decideWarnings(rows, {}, THRESHOLD)
    assert.deepStrictEqual(d.warnings, ['5h limit is 95.0% used'])
  })
})
