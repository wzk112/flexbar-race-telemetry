'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { normalizeConfig } = require('../src/config.cjs')
const { countSetBits, getShiftLightState, rpmRatio, segmentColor } = require('../src/render/shift-lights.cjs')

const config = normalizeConfig({})

function snapshot(rpm, maxRpm = 8000) {
  return { rpm, maxRpm }
}

test('keeps lights off below the start threshold', () => {
  const state = getShiftLightState(snapshot(4000), config, 0)
  assert.equal(state.activeCount, 0)
  assert.equal(state.flashing, false)
})

test('uses real RPM during the transmission in-progress state', () => {
  const state = getShiftLightState({ rpm: 4000, maxRpm: 8000, shiftInProgress: true }, config, 0)
  assert.equal(state.activeCount, 0)
  assert.equal(state.flashing, false)
})

test('fills symmetric light banks as RPM rises', () => {
  const low = getShiftLightState(snapshot(5600), config, 0)
  const high = getShiftLightState(snapshot(7200), config, 0)
  assert.ok(low.activeCount > 0)
  assert.ok(high.activeCount > low.activeCount)
})

test('flashes at the configured shift point', () => {
  const on = getShiftLightState(snapshot(7900), config, 0)
  const off = getShiftLightState(snapshot(7900), config, 100)
  assert.equal(on.flashing, true)
  assert.equal(on.flashOn, true)
  assert.equal(off.flashOn, false)
})

test('uses the F1 game rev-light bit field instead of estimating from max RPM', () => {
  const half = getShiftLightState({
    source: 'f1-25',
    rpm: 9000,
    maxRpm: 15000,
    revLightsPercent: 50,
    revLightsBitValue: 0x007f
  }, config, 0)
  const shift = getShiftLightState({
    source: 'f1-25',
    rpm: 12000,
    maxRpm: 15000,
    revLightsPercent: 96,
    revLightsBitValue: 0x7fff
  }, config, 0)
  const nativeBlinkOffFrame = getShiftLightState({
    source: 'f1-25',
    rpm: 12000,
    maxRpm: 15000,
    revLightsPercent: 100,
    revLightsBitValue: 0
  }, config, 0)

  assert.equal(half.gameControlled, true)
  assert.equal(half.activeCount, 7)
  assert.equal(half.flashing, false)
  assert.equal(shift.activeCount, 14)
  assert.equal(shift.flashing, true)
  assert.equal(nativeBlinkOffFrame.activeCount, 14)
  assert.equal(nativeBlinkOffFrame.flashing, true)
  assert.equal(countSetBits(0x7fff), 15)
})

test('falls back to F1 rev-light percentage when the native bit field stays empty', () => {
  const first = getShiftLightState({
    source: 'f1-25',
    rpm: 7000,
    maxRpm: 15000,
    revLightsPercent: 7,
    revLightsBitValue: 0
  }, config, 0)
  const low = getShiftLightState({
    source: 'f1-25',
    rpm: 9000,
    maxRpm: 15000,
    revLightsPercent: 70,
    revLightsBitValue: 0
  }, config, 0)
  const high = getShiftLightState({
    source: 'f1-25',
    rpm: 12000,
    maxRpm: 15000,
    revLightsPercent: 88,
    revLightsBitValue: 0
  }, config, 0)
  const almostFull = getShiftLightState({
    source: 'f1-25',
    rpm: 14000,
    maxRpm: 15000,
    revLightsPercent: 94,
    revLightsBitValue: 0x3fff
  }, config, 0)

  assert.equal(first.activeCount, 1)
  assert.ok(low.activeCount > 0)
  assert.ok(high.activeCount > low.activeCount)
  assert.equal(high.flashing, false)
  assert.equal(almostFull.activeCount, 13)
  assert.equal(almostFull.flashing, false)
})

test('computes and clamps RPM ratio', () => {
  assert.equal(rpmRatio(snapshot(4000)), 0.5)
  assert.equal(rpmRatio(snapshot(12000)), 1.25)
  assert.equal(rpmRatio(snapshot(1000, 0)), 0)
})

test('assigns green, yellow and red segment zones', () => {
  assert.equal(segmentColor(0, 14, config, false, true), config.colors.green)
  assert.equal(segmentColor(7, 14, config, false, true), config.colors.yellow)
  assert.equal(segmentColor(13, 14, config, false, true), config.colors.red)
})
