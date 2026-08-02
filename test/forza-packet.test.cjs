'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const {
  detectLayout,
  formatForzaGear,
  SHIFT_IN_PROGRESS_GEAR,
  parseForzaPacket
} = require('../src/telemetry/forza-packet.cjs')

function makePacket(length, gearOffset, rawGear) {
  const packet = Buffer.alloc(length)
  packet.writeInt32LE(1, 0)
  packet.writeUInt32LE(123456, 4)
  packet.writeFloatLE(8000, 8)
  packet.writeFloatLE(900, 12)
  packet.writeFloatLE(7420, 16)
  packet.writeUInt8(200, gearOffset - 2)
  packet.writeUInt8(rawGear, gearOffset)
  return packet
}

test('detects and parses Horizon Dash packets', () => {
  const packet = makePacket(324, 319, 4)
  const snapshot = parseForzaPacket(packet, { layout: 'horizon', receivedAt: 1000 })

  assert.equal(detectLayout(packet).name, 'horizon')
  assert.equal(snapshot.layout, 'horizon')
  assert.equal(snapshot.source, 'forza-horizon')
  assert.equal(snapshot.gear, '4')
  assert.equal(snapshot.rpm, 7420)
  assert.equal(snapshot.maxRpm, 8000)
  assert.equal(snapshot.clutch, 200)
  assert.equal(snapshot.receivedAt, 1000)
})

test('detects and parses Motorsport Dash packets', () => {
  const packet = makePacket(311, 307, 2)
  const snapshot = parseForzaPacket(packet, { layout: 'motorsport' })

  assert.equal(snapshot.layout, 'motorsport')
  assert.equal(snapshot.gear, '2')
})

test('formats reverse and numbered Horizon gears without an offset', () => {
  assert.equal(formatForzaGear(0), 'R')
  assert.equal(formatForzaGear(1), '1')
  assert.equal(formatForzaGear(2), '2')
  assert.equal(formatForzaGear(8), '8')
  assert.equal(formatForzaGear(null), '–')
})

test('recognizes the FH5 downshift-in-progress gear code', () => {
  const packet = makePacket(324, 319, SHIFT_IN_PROGRESS_GEAR)
  const snapshot = parseForzaPacket(packet, { layout: 'horizon' })
  assert.equal(snapshot.rawGear, 11)
  assert.equal(snapshot.gear, 'N')
  assert.equal(snapshot.shiftInProgress, true)
})

test('rejects short or implausible packets', () => {
  assert.equal(parseForzaPacket(Buffer.alloc(100)), null)

  const invalid = makePacket(324, 319, 3)
  invalid.writeFloatLE(90000, 16)
  assert.equal(parseForzaPacket(invalid), null)
})
