'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const dgram = require('node:dgram')
const { F125UdpSource } = require('../src/telemetry/f1-25-udp.cjs')
const { HEADER_SIZE, LAYOUTS } = require('../src/telemetry/f1-25-packet.cjs')

function makePacket(packetId) {
  const layout = LAYOUTS[2025]
  const buffer = Buffer.alloc(packetId === 6 ? layout.telemetryLength : layout.statusLength)
  buffer.writeUInt16LE(2025, 0)
  buffer.writeUInt8(25, 2)
  buffer.writeUInt8(1, 5)
  buffer.writeUInt8(packetId, 6)
  buffer.writeUInt8(3, 27)
  const recordSize = packetId === 6 ? layout.telemetryRecordSize : layout.statusRecordSize
  const offset = HEADER_SIZE + 3 * recordSize
  if (packetId === 7) {
    buffer.writeUInt16LE(15000, offset + 17)
    buffer.writeUInt16LE(4000, offset + 19)
    buffer.writeUInt8(8, offset + 21)
  } else {
    buffer.writeInt8(5, offset + 15)
    buffer.writeUInt16LE(11000, offset + 16)
    buffer.writeUInt8(75, offset + 19)
    buffer.writeUInt16LE(0x03ff, offset + 20)
  }
  return buffer
}

test('receives and combines F1 status and telemetry UDP packets', async () => {
  const source = new F125UdpSource({ host: '127.0.0.1', port: 0 })
  const sender = dgram.createSocket('udp4')

  try {
    const address = await new Promise((resolve, reject) => {
      source.once('listening', resolve)
      source.once('error', reject)
      source.start()
    })

    const telemetry = new Promise((resolve, reject) => {
      source.once('telemetry', resolve)
      source.once('error', reject)
    })

    sender.send(makePacket(7), address.port, '127.0.0.1')
    sender.send(makePacket(6), address.port, '127.0.0.1')
    const snapshot = await telemetry

    assert.equal(snapshot.gear, '5')
    assert.equal(snapshot.rpm, 11000)
    assert.equal(snapshot.maxRpm, 15000)
    assert.equal(snapshot.playerCarIndex, 3)
  } finally {
    sender.close()
    source.stop()
  }
})
