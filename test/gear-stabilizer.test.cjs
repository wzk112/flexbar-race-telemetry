'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { GearStabilizer } = require('../src/telemetry/gear-stabilizer.cjs')

function snapshot(rawGear) {
  return { rawGear, gear: String(rawGear), rpm: 6000 }
}

test('rejects a one-packet gear spike but applies sequential shifts immediately', () => {
  const stabilizer = new GearStabilizer(2)

  assert.equal(stabilizer.update(snapshot(4)).gear, '4')

  const spike = stabilizer.update(snapshot(11))
  assert.equal(spike.gear, '4')
  assert.equal(spike.rawGear, 4)
  assert.equal(spike.observedRawGear, 11)
  assert.equal(stabilizer.update(snapshot(4)).gear, '4')
  assert.equal(stabilizer.update(snapshot(5)).gear, '5')
})

test('confirms a multi-gear jump on the next matching packet', () => {
  const stabilizer = new GearStabilizer(2)
  assert.equal(stabilizer.update(snapshot(6)).gear, '6')
  assert.equal(stabilizer.update(snapshot(3)).gear, '6')
  assert.equal(stabilizer.update(snapshot(3)).gear, '3')
})

test('reset accepts the next gear immediately', () => {
  const stabilizer = new GearStabilizer(2)
  stabilizer.update(snapshot(3))
  stabilizer.reset()
  assert.equal(stabilizer.update(snapshot(7)).gear, '7')
})
