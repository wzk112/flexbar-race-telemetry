'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const {
  HEADER_SIZE,
  LAYOUTS,
  formatF1Gear,
  parseF1Header,
  parseF1StatusPacket,
  parseF1TelemetryPacket
} = require('../src/telemetry/f1-25-packet.cjs')

function packet(format, packetId, playerCarIndex) {
  const layout = LAYOUTS[format]
  const length = packetId === 6 ? layout.telemetryLength : layout.statusLength
  const buffer = Buffer.alloc(length)
  buffer.writeUInt16LE(format, 0)
  buffer.writeUInt8(format - 2000, 2)
  buffer.writeUInt8(1, 5)
  buffer.writeUInt8(packetId, 6)
  buffer.writeUInt32LE(123456, 19)
  buffer.writeUInt8(playerCarIndex, 27)
  buffer.writeUInt8(255, 28)
  return buffer
}

function statusPacket(format, playerCarIndex, maxRpm = 15000, idleRpm = 4000) {
  const buffer = packet(format, 7, playerCarIndex)
  const layout = LAYOUTS[format]
  const offset = HEADER_SIZE + playerCarIndex * layout.statusRecordSize
  buffer.writeUInt16LE(maxRpm, offset + 17)
  buffer.writeUInt16LE(idleRpm, offset + 19)
  buffer.writeUInt8(8, offset + 21)
  return buffer
}

function telemetryPacket(format, playerCarIndex, gear = 6) {
  const buffer = packet(format, 6, playerCarIndex)
  const layout = LAYOUTS[format]
  const offset = HEADER_SIZE + playerCarIndex * layout.telemetryRecordSize
  buffer.writeUInt8(0, offset + 14)
  buffer.writeInt8(gear, offset + 15)
  buffer.writeUInt16LE(12345, offset + 16)
  buffer.writeUInt8(94, offset + 19)
  buffer.writeUInt16LE(0x3fff, offset + 20)
  return buffer
}

test('parses F1 25 player telemetry and status using the header car index', () => {
  const status = parseF1StatusPacket(statusPacket(2025, 7))
  const snapshot = parseF1TelemetryPacket(telemetryPacket(2025, 7), { status, receivedAt: 1000 })

  assert.equal(snapshot.source, 'f1-25')
  assert.equal(snapshot.layout, 'f1-2025')
  assert.equal(snapshot.playerCarIndex, 7)
  assert.equal(snapshot.gear, '6')
  assert.equal(snapshot.rpm, 12345)
  assert.equal(snapshot.maxRpm, 15000)
  assert.equal(snapshot.revLightsPercent, 94)
  assert.equal(snapshot.revLightsBitValue, 0x3fff)
  assert.equal(snapshot.receivedAt, 1000)
})

test('parses the F1 25 2026 Season Pack layout', () => {
  const status = parseF1StatusPacket(statusPacket(2026, 23, 13500, 3500))
  const snapshot = parseF1TelemetryPacket(telemetryPacket(2026, 23, 0), { status })

  assert.equal(parseF1Header(telemetryPacket(2026, 23)).packetFormat, 2026)
  assert.equal(snapshot.layout, 'f1-2026')
  assert.equal(snapshot.playerCarIndex, 23)
  assert.equal(snapshot.gear, 'N')
  assert.equal(snapshot.maxRpm, 13500)
  assert.equal(snapshot.idleRpm, 3500)
})

test('formats F1 reverse, neutral and invalid gear values', () => {
  assert.equal(formatF1Gear(-1), 'R')
  assert.equal(formatF1Gear(0), 'N')
  assert.equal(formatF1Gear(8), '8')
  assert.equal(formatF1Gear(9), '–')
})

test('rejects unrelated and truncated packets', () => {
  assert.equal(parseF1Header(Buffer.alloc(10)), null)
  assert.equal(parseF1Header(packet(2025, 6, 22)), null)
  assert.equal(parseF1TelemetryPacket(packet(2025, 7, 0)), null)
})
