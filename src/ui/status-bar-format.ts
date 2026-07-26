import { ClaudeUsage } from '../types'
import { buildUsageRows, highestWarningUtilization } from './usage-rows'

/** Windows the API reports under a field name of their own. */
const WINDOW_NAMES = ['5h', '7d', 'opus', 'sonnet', 'cowork', 'apps']

/**
 * Model names a weekly limit can be scoped to.
 *
 * Hard-coded on purpose: a name that is merely absent has to be told apart from
 * a name that is misspelt, and the API only reports the models an account
 * actually has a limit for, so presence alone cannot make that distinction.
 * Extending this is one line. A model missing from here still renders while its
 * limit exists — it is only reported as a typo once the limit does not.
 */
const MODEL_NAMES = ['haiku', 'sonnet', 'opus', 'fable', 'mythos']

/**
 * Names that mean something whether or not the account has that limit, so an
 * absent one leaves its optional section out instead of being mistaken for a
 * typo. Anything outside this set is written out verbatim wherever it appears,
 * brackets included, so a misspelling is always visible.
 */
const KNOWN_NAMES = new Set([...WINDOW_NAMES, ...MODEL_NAMES, 'max'])

/**
 * Utilization by placeholder name, built from the same rows the tooltip renders
 * so the two can never disagree about which limits exist.
 */
export function buildFormatTokens(usage: ClaudeUsage): Map<string, number> {
  const rows = buildUsageRows(usage)
  const tokens = new Map<string, number>()

  for (const row of rows) {
    tokens.set(row.key, row.utilization)
  }
  tokens.set('max', highestWarningUtilization(rows))

  return tokens
}

/**
 * Render a status bar template.
 *
 * `{name}` becomes the utilization as a whole number. `[...]` marks a section
 * that is dropped entirely when a limit named inside it is absent, so the
 * separator disappears along with the value it belonged to. The four bracket
 * characters are reserved and cannot be part of the output text.
 */
export function formatStatusBar(
  template: string,
  tokens: Map<string, number>,
): string {
  return renderRange(template, 0, tokens, false).text
}

interface Rendered {
  text: string
  /** Index just past the section that was consumed. */
  next: number
  /** A placeholder inside this section named a limit the account lacks. */
  missing: boolean
}

function renderRange(
  s: string,
  start: number,
  tokens: Map<string, number>,
  inGroup: boolean,
): Rendered {
  let text = ''
  let missing = false
  let i = start

  while (i < s.length) {
    const c = s[i]

    if (c === ']' && inGroup) {
      return { text, next: i + 1, missing }
    }

    if (c === '[') {
      const group = renderRange(s, i + 1, tokens, true)
      if (!group.missing) {
        text += group.text
      }
      i = group.next
      continue
    }

    if (c === ']') {
      // Nothing open to close, so it is just text.
      text += c
      i += 1
      continue
    }

    if (c === '{') {
      const end = s.indexOf('}', i)
      if (end === -1) {
        // Unterminated placeholder: the rest is text.
        text += s.slice(i)
        i = s.length
        continue
      }

      const name = s.slice(i + 1, end).trim().toLowerCase()
      i = end + 1

      const value = tokens.get(name)
      if (value !== undefined) {
        text += String(Math.round(value))
      } else if (KNOWN_NAMES.has(name)) {
        missing = true
      } else {
        // Not a name we recognise, so surface it rather than swallow it. This
        // holds inside a section too: a typo must never look like an absent
        // limit, or it would silently remove the section it sits in.
        text += `{${name}}`
      }
      continue
    }

    text += c
    i += 1
  }

  return { text, next: i, missing }
}
