import * as assert from 'assert'
import {
  buildUsageRows,
  formatExtraUsage,
  highestWarningUtilization,
} from '../../ui/usage-rows'
import { ClaudeUsage } from '../../types'

const win = (utilization: number, resets_at: string | null = null) => ({
  utilization,
  resets_at,
})

suite('Usage Rows Test Suite', () => {
  suite('buildUsageRows', () => {
    test('returns nothing for an empty payload', () => {
      assert.deepStrictEqual(buildUsageRows({}), [])
    })

    test('skips windows the account does not have', () => {
      // The API sends null rather than omitting the field.
      const usage: ClaudeUsage = {
        five_hour: win(4),
        seven_day: win(2),
        seven_day_opus: null,
        seven_day_sonnet: null,
      }
      assert.deepStrictEqual(
        buildUsageRows(usage).map((r) => r.label),
        ['5h', '7d'],
      )
    })

    test('includes the windows that were previously ignored', () => {
      const usage: ClaudeUsage = {
        five_hour: win(1),
        seven_day: win(2),
        seven_day_opus: win(3),
        seven_day_sonnet: win(4),
        seven_day_cowork: win(5),
        seven_day_oauth_apps: win(6),
      }
      assert.deepStrictEqual(
        buildUsageRows(usage).map((r) => `${r.label}=${r.utilization}`),
        ['5h=1', '7d=2', '7d Opus=3', '7d Sonnet=4', '7d Cowork=5', '7d Apps=6'],
      )
    })

    test('adds the per-model weekly limit from limits[]', () => {
      const usage: ClaudeUsage = {
        five_hour: win(5),
        limits: [
          {
            kind: 'weekly_scoped',
            percent: 7,
            resets_at: null,
            scope: { model: { id: null, display_name: 'Fable' } },
          },
        ],
      }
      const rows = buildUsageRows(usage)
      assert.deepStrictEqual(rows.map((r) => r.label), ['5h', '7d Fable'])
      assert.strictEqual(rows[1].utilization, 7)
      assert.strictEqual(rows[1].resetsAt, null)
    })

    test('hides a scoped limit reported at 0% and inactive', () => {
      // What the API actually sends for a model the account has no separate
      // allowance for; Claude Code shows no such row either.
      const usage: ClaudeUsage = {
        five_hour: win(6),
        seven_day: win(3),
        limits: [
          {
            kind: 'weekly_scoped',
            percent: 0,
            resets_at: null,
            is_active: false,
            scope: { model: { id: null, display_name: 'Fable' } },
          },
        ],
      }
      assert.deepStrictEqual(
        buildUsageRows(usage).map((r) => r.label),
        ['5h', '7d'],
      )
    })

    test('shows a scoped limit at 0% when it is marked active', () => {
      const usage: ClaudeUsage = {
        limits: [
          {
            kind: 'weekly_scoped',
            percent: 0,
            resets_at: null,
            is_active: true,
            scope: { model: { id: null, display_name: 'Fable' } },
          },
        ],
      }
      assert.deepStrictEqual(
        buildUsageRows(usage).map((r) => r.label),
        ['7d Fable'],
      )
    })

    test('shows a scoped limit in use even when not marked active', () => {
      const usage: ClaudeUsage = {
        limits: [
          {
            kind: 'weekly_scoped',
            percent: 12,
            resets_at: null,
            is_active: false,
            scope: { model: { id: null, display_name: 'Sonnet' } },
          },
        ],
      }
      assert.deepStrictEqual(
        buildUsageRows(usage).map((r) => r.label),
        ['7d Sonnet'],
      )
    })

    test('does not duplicate session and weekly_all from limits[]', () => {
      // Those two entries repeat five_hour and seven_day, which are already rows.
      const usage: ClaudeUsage = {
        five_hour: win(5, '2026-07-27T01:00:00Z'),
        seven_day: win(2, '2026-07-30T00:00:00Z'),
        limits: [
          { kind: 'session', percent: 5, resets_at: '2026-07-27T01:00:00Z', scope: null },
          { kind: 'weekly_all', percent: 2, resets_at: '2026-07-30T00:00:00Z', scope: null },
        ],
      }
      assert.deepStrictEqual(
        buildUsageRows(usage).map((r) => r.label),
        ['5h', '7d'],
      )
    })

    test('ignores scoped limits with no model name', () => {
      const usage: ClaudeUsage = {
        limits: [
          { kind: 'weekly_scoped', percent: 3, resets_at: null, scope: null },
          { kind: 'weekly_scoped', percent: 4, resets_at: null, scope: { surface: 'x' } },
        ],
      }
      assert.deepStrictEqual(buildUsageRows(usage), [])
    })

    test('does not add a scoped model that already has its own window', () => {
      const usage: ClaudeUsage = {
        seven_day_opus: win(80),
        limits: [
          {
            kind: 'weekly_scoped',
            percent: 80,
            resets_at: null,
            scope: { model: { id: null, display_name: 'opus' } },
          },
        ],
      }
      assert.deepStrictEqual(
        buildUsageRows(usage).map((r) => r.label),
        ['7d Opus'],
      )
    })

    test('handles the real API payload shape', () => {
      // Trimmed copy of an actual /api/oauth/usage response.
      const usage: ClaudeUsage = {
        five_hour: win(5, '2026-07-26T01:40:00.352507+00:00'),
        seven_day: win(1, '2026-07-29T22:00:00.352530+00:00'),
        seven_day_oauth_apps: null,
        seven_day_opus: null,
        seven_day_sonnet: null,
        seven_day_cowork: null,
        limits: [
          { kind: 'session', group: 'session', percent: 5, severity: 'normal', resets_at: '2026-07-26T01:40:00.352507+00:00', scope: null, is_active: true },
          { kind: 'weekly_all', group: 'weekly', percent: 1, severity: 'normal', resets_at: '2026-07-29T22:00:00.352530+00:00', scope: null, is_active: false },
          { kind: 'weekly_scoped', group: 'weekly', percent: 0, severity: 'normal', resets_at: null, scope: { model: { id: null, display_name: 'Fable' }, surface: null }, is_active: false },
        ],
        extra_usage: {
          is_enabled: false,
          utilization: null,
          used_credits: null,
          monthly_limit: null,
          currency: null,
        },
      }
      // Fable is reported at 0% and inactive, so it stays out — which is what
      // Claude Code's own panel shows for this account.
      assert.deepStrictEqual(
        buildUsageRows(usage).map((r) => r.label),
        ['5h', '7d'],
      )
    })
  })

  suite('highestWarningUtilization', () => {
    test('is zero with no rows', () => {
      assert.strictEqual(highestWarningUtilization([]), 0)
    })

    test('takes the maximum across the user\'s own limits', () => {
      const rows = buildUsageRows({
        five_hour: win(30),
        seven_day: win(91),
        seven_day_sonnet: win(45),
      })
      assert.strictEqual(highestWarningUtilization(rows), 91)
    })

    test('excludes oauth-app usage, which the user cannot hit', () => {
      const rows = buildUsageRows({
        five_hour: win(10),
        seven_day_oauth_apps: win(99),
      })
      assert.strictEqual(highestWarningUtilization(rows), 10)
    })

    test('counts a per-model scoped limit', () => {
      const rows = buildUsageRows({
        five_hour: win(10),
        limits: [
          {
            kind: 'weekly_scoped',
            percent: 95,
            resets_at: null,
            scope: { model: { id: null, display_name: 'Fable' } },
          },
        ],
      })
      assert.strictEqual(highestWarningUtilization(rows), 95)
    })
  })

  suite('formatExtraUsage', () => {
    test('is null when the account has no credits', () => {
      assert.strictEqual(formatExtraUsage({}), null)
    })

    test('is null when credits exist but are disabled', () => {
      assert.strictEqual(
        formatExtraUsage({
          extra_usage: {
            is_enabled: false,
            utilization: 40,
            used_credits: 4,
            monthly_limit: 10,
            currency: 'USD',
          },
        }),
        null,
      )
    })

    test('summarises enabled credits', () => {
      assert.strictEqual(
        formatExtraUsage({
          extra_usage: {
            is_enabled: true,
            utilization: 35.4,
            used_credits: 3.54,
            monthly_limit: 10,
            currency: 'USD',
          },
        }),
        '35% used · 3.54 of 10 USD',
      )
    })

    test('falls back when enabled but unquantified', () => {
      assert.strictEqual(
        formatExtraUsage({
          extra_usage: {
            is_enabled: true,
            utilization: null,
            used_credits: null,
            monthly_limit: null,
            currency: null,
          },
        }),
        'enabled',
      )
    })
  })
})
