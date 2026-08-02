'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { normalizeConfig } = require('../src/config.cjs')

test('keeps Direct Draw differential updates disabled by default', () => {
  assert.equal(normalizeConfig({}).diffUpdate, false)
  assert.equal(normalizeConfig({ diffUpdate: true }).diffUpdate, true)
})

test('normalizes the per-key 180 degree rotation switch', () => {
  assert.equal(normalizeConfig({}).rotate180, false)
  assert.equal(normalizeConfig({ rotate180: true }).rotate180, true)
  assert.equal(normalizeConfig({ rotate180: 'true' }).rotate180, false)
})

test('normalizes center display modes', () => {
  assert.equal(normalizeConfig({}).displayMode, 'gear-rpm')
  assert.equal(normalizeConfig({ displayMode: 'gear' }).displayMode, 'gear')
  assert.equal(normalizeConfig({ displayMode: 'rpm' }).displayMode, 'rpm')
  assert.equal(normalizeConfig({ displayMode: 'invalid' }).displayMode, 'gear-rpm')
})

test('normalizes telemetry sources', () => {
  assert.equal(normalizeConfig({}).source, 'forza-horizon')
  assert.equal(normalizeConfig({ source: 'forza-motorsport' }).source, 'forza-motorsport')
  assert.equal(normalizeConfig({ source: 'f1-25' }).source, 'f1-25')
  assert.equal(normalizeConfig({ source: 'unknown' }).source, 'forza-horizon')
})

test('migrates the old hidden flash threshold to the earlier default', () => {
  assert.equal(normalizeConfig({}).flashRatio, 0.94)
  assert.equal(normalizeConfig({ flashRatio: 0.97 }).flashRatio, 0.94)
})

test('migrates the old cyan flash color to purple', () => {
  assert.equal(normalizeConfig({}).colors.flash, '#a855f7')
  assert.equal(normalizeConfig({ colors: { flash: '#38bdf8' } }).colors.flash, '#a855f7')
})

test('normalizes unsafe configuration values', () => {
  const config = normalizeConfig({
    udpPort: 99999,
    renderFps: 120,
    lightsStartRatio: 0.8,
    redlineRatio: 0.7,
    flashRatio: 0.6,
    telemetryTimeoutMs: 20
  })

  assert.equal(config.udpPort, 65535)
  assert.equal(config.renderFps, 45)
  assert.equal(config.lightsStartRatio, 0.8)
  assert.ok(config.redlineRatio > config.lightsStartRatio)
  assert.ok(config.flashRatio > config.redlineRatio)
  assert.equal(config.telemetryTimeoutMs, 250)
})
