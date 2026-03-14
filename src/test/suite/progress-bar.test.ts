import * as assert from 'assert'
import { createProgressBar } from '../../ui/progress-bar'

suite('Progress Bar Test Suite', () => {
  test('0% should show all empty blocks', () => {
    const bar = createProgressBar(0)
    assert.ok(bar.includes('0%'))
    assert.ok(!bar.includes('🟩'))
    assert.ok(!bar.includes('🟨'))
    assert.ok(!bar.includes('🟥'))
  })

  test('50% should show green blocks', () => {
    const bar = createProgressBar(50)
    assert.ok(bar.includes('50%'))
    assert.ok(bar.includes('🟩'))
    assert.ok(bar.includes('⬜'))
  })

  test('80% should show yellow/warning blocks', () => {
    const bar = createProgressBar(80)
    assert.ok(bar.includes('80%'))
    assert.ok(bar.includes('🟨'))
  })

  test('95% should show red/critical blocks', () => {
    const bar = createProgressBar(95)
    assert.ok(bar.includes('95%'))
    assert.ok(bar.includes('🟥'))
  })

  test('100% should show all red blocks', () => {
    const bar = createProgressBar(100)
    assert.ok(bar.includes('100%'))
    assert.ok(bar.includes('🟥'))
    assert.ok(!bar.includes('⬜'))
  })

  test('Should clamp values above 100', () => {
    const bar = createProgressBar(150)
    assert.ok(bar.includes('150%'))
    // Clamped to 100 for rendering, but original percent shown
    assert.ok(!bar.includes('⬜'))
  })

  test('Should clamp negative values to 0', () => {
    const bar = createProgressBar(-10)
    assert.ok(!bar.includes('🟩'))
  })
})
