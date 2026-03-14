import * as assert from 'assert'
import { createProgressBar } from '../../ui/progress-bar'

suite('Progress Bar Test Suite', () => {
  test('0% should show all empty blocks', () => {
    const bar = createProgressBar(0)
    assert.strictEqual(bar.length, 14) // ［ + space + 10 chars + space + ］
    assert.ok(!bar.includes('￭'))
    assert.ok(bar.includes('･'))
  })

  test('50% should show half filled blocks', () => {
    const bar = createProgressBar(50)
    assert.strictEqual(bar.length, 14)
    assert.strictEqual((bar.match(/￭/g) || []).length, 5)
    assert.ok(bar.includes('･'))
  })

  test('80% should show 8 filled blocks', () => {
    const bar = createProgressBar(80)
    assert.strictEqual(bar.length, 14)
    assert.strictEqual((bar.match(/￭/g) || []).length, 8)
  })

  test('95% should show all filled blocks', () => {
    const bar = createProgressBar(95)
    assert.strictEqual(bar.length, 14)
    assert.ok(!bar.includes('･'))
  })

  test('100% should show all filled blocks', () => {
    const bar = createProgressBar(100)
    assert.strictEqual(bar.length, 14)
    assert.ok(!bar.includes('･'))
  })

  test('Should clamp values above 100', () => {
    const bar = createProgressBar(150)
    assert.strictEqual(bar.length, 14)
    assert.ok(!bar.includes('･'))
  })

  test('Should clamp negative values to 0', () => {
    const bar = createProgressBar(-10)
    assert.strictEqual(bar.length, 14)
    assert.ok(!bar.includes('￭'))
  })
})
