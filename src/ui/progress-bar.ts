const FILLED = '￭' // U+FFED HALFWIDTH BLACK SQUARE
const EMPTY = '･' // U+FF65 HALFWIDTH KATAKANA MIDDLE DOT

/**
 * Create a progress bar using halfwidth Unicode forms.
 * All characters are from the same Unicode block so they render at consistent
 * height and width. Returns the full bracketed bar, e.g. ［ ￭￭￭･･････ ］
 */
export function createProgressBar(percent: number): string {
  const length = 10
  const clamped = Math.max(0, Math.min(100, percent))
  const filled = Math.round((clamped / 100) * length)
  const bar = FILLED.repeat(filled) + EMPTY.repeat(length - filled)
  return `［ ${bar} ］`
}
