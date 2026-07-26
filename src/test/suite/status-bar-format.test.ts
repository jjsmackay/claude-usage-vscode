import * as assert from 'assert'
import {
  buildFormatTokens,
  formatStatusBar,
} from '../../ui/status-bar-format'
import { ClaudeUsage } from '../../types'

const win = (utilization: number) => ({ utilization, resets_at: null })

/** An account with the two limits everybody has. */
const BASIC: ClaudeUsage = { five_hour: win(7), seven_day: win(3) }

/** An account that also has an Opus limit and a per-model weekly limit. */
const RICH: ClaudeUsage = {
  five_hour: win(7),
  seven_day: win(3),
  seven_day_opus: win(82),
  seven_day_oauth_apps: win(99),
  limits: [
    {
      kind: 'weekly_scoped',
      percent: 12,
      resets_at: null,
      is_active: true,
      scope: { model: { id: null, display_name: 'Fable' } },
    },
  ],
}

const render = (template: string, usage: ClaudeUsage = BASIC) =>
  formatStatusBar(template, buildFormatTokens(usage))

suite('Status Bar Format Test Suite', () => {
  suite('placeholders', () => {
    test('renders the default template', () => {
      assert.strictEqual(render('✼ {5h}% · {7d}%'), '✼ 7% · 3%')
    })

    test('rounds to a whole number', () => {
      assert.strictEqual(render('{5h}', { five_hour: win(7.4) }), '7')
      assert.strictEqual(render('{5h}', { five_hour: win(7.5) }), '8')
    })

    test('supports the named windows', () => {
      assert.strictEqual(render('{opus}/{apps}', RICH), '82/99')
    })

    test('supports a per-model limit by name, case-insensitively', () => {
      assert.strictEqual(render('{FaBlE}', RICH), '12')
    })

    test('max is the highest limit that can warn, ignoring oauth apps', () => {
      // Apps is at 99 but cannot warn, so Opus at 82 wins.
      assert.strictEqual(render('{max}', RICH), '82')
    })

    test('keeps surrounding text, including product icons', () => {
      assert.strictEqual(render('$(pulse) {5h}% used'), '$(pulse) 7% used')
    })

    test('leaves a misspelt name visible', () => {
      assert.strictEqual(render('{5h}% {sonet}'), '7% {sonet}')
    })

    test('ignores whitespace inside a placeholder', () => {
      assert.strictEqual(render('{ 5h }'), '7')
    })
  })

  suite('optional sections', () => {
    test('keeps a section when the limit exists', () => {
      assert.strictEqual(render('✼ {5h}%[ · {opus}%]', RICH), '✼ 7% · 82%')
    })

    test('drops the section, separator and all, when the limit is missing', () => {
      assert.strictEqual(render('✼ {5h}%[ · {opus}%]', BASIC), '✼ 7%')
    })

    test('handles several sections independently', () => {
      assert.strictEqual(
        render('✼ {5h}%[ · {opus}%][ · {fable}%]', RICH),
        '✼ 7% · 82% · 12%',
      )
      assert.strictEqual(render('✼ {5h}%[ · {opus}%][ · {fable}%]', BASIC), '✼ 7%')
    })

    test('drops a section when any one of its limits is missing', () => {
      assert.strictEqual(render('{5h}[ {opus} {fable}]', RICH), '7 82 12')
      assert.strictEqual(
        render('{5h}[ {opus} {sonnet}]', RICH),
        '7',
        'sonnet is absent, so the whole section goes',
      )
    })

    test('supports nesting', () => {
      assert.strictEqual(render('{5h}[ A{opus}[ B{sonnet}]]', RICH), '7 A82')
      assert.strictEqual(render('{5h}[ A{opus}[ B{fable}]]', RICH), '7 A82 B12')
    })

    test('drops the section for a known model name the account lacks', () => {
      assert.strictEqual(render('{5h}[ · {fable}%]', BASIC), '7')
      assert.strictEqual(render('{5h}[ · {fable}%]', RICH), '7 · 12%')
    })

    test('a misspelt name stays visible, inside brackets as well as outside', () => {
      // A typo must never look like an absent limit, or the section it sits in
      // would vanish and the mistake would go unnoticed.
      assert.strictEqual(render('{5h} {oops}', BASIC), '7 {oops}')
      assert.strictEqual(render('{5h}[ {oops}]', BASIC), '7 {oops}')
      assert.strictEqual(render('{5h}[ · {fabel}%]', RICH), '7 · {fabel}%')
    })
  })

  suite('known model names', () => {
    test('every hard-coded model name drops its section when absent', () => {
      for (const model of ['haiku', 'sonnet', 'opus', 'fable', 'mythos']) {
        assert.strictEqual(
          render(`{5h}[ ${model}={${model}}]`, BASIC),
          '7',
          `${model} should be recognised as a model name`,
        )
      }
    })

    test('renders a model limit that is present', () => {
      assert.strictEqual(render('[{fable}]', RICH), '12')
    })
  })

  suite('reserved characters and malformed input', () => {
    test('an unterminated placeholder is left as text', () => {
      assert.strictEqual(render('{5h}% {7d'), '7% {7d')
    })

    test('an unmatched closing bracket is left as text', () => {
      assert.strictEqual(render('{5h}]'), '7]')
    })

    test('an unclosed section shows its bracket instead of acting as a section', () => {
      // Guessing where it ended would hide the mistake, and dropping it would
      // hide it twice over.
      assert.strictEqual(render('{5h}[ · {7d}'), '7[ · 3')
      assert.strictEqual(render('{5h}[ · {opus}%', BASIC), '7[ · %')
    })

    test('an unclosed nested section shows only the unclosed bracket', () => {
      assert.strictEqual(render('{5h}[ a[ b{7d}]', BASIC), '7[ a b3')
    })

    test('a bracket inside a placeholder does not close a section', () => {
      assert.strictEqual(render('[{5h}{a]b}]', BASIC), '7{a]b}')
    })

    test('an empty template renders empty, for the caller to fall back on', () => {
      assert.strictEqual(render(''), '')
    })

    test('a template of only a missing section renders empty', () => {
      assert.strictEqual(render('[{opus}%]', BASIC), '')
    })
  })

  suite('buildFormatTokens', () => {
    test('exposes exactly the limits the account has, plus max', () => {
      assert.deepStrictEqual(
        [...buildFormatTokens(BASIC).keys()].sort(),
        ['5h', '7d', 'max'],
      )
    })

    test('exposes a per-model limit under its lower-case name', () => {
      assert.ok(buildFormatTokens(RICH).has('fable'))
    })

    test('exposes nothing but max for an empty payload', () => {
      assert.deepStrictEqual([...buildFormatTokens({}).keys()], ['max'])
    })
  })
})
