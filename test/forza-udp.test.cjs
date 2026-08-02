'use strict'

const dgram = require('node:dgram')
const test = require('node:test')
const assert = require('node:assert/strict')
const { ForzaUdpSource } = require('../src/telemetry/forza-udp.cjs')

function makeHorizonPacket() {
  const packet = Buffer.alloc(324)
  packet.writeInt32LE(1, 0)
  packet.writeUInt32LE(42, 4)
  packet.writeFloatLE(8000, 8)
  packet.writeFloatLE(900, 12)
  packet.writeFloatLE(6000, 16)
  packet.writeUInt8(5, 319)
  return packet
}

test('receives and parses a Horizon UDP packet', async () => {
  const source = new ForzaUdpSource({ host: '127.0.0.1', port: 0, layout: 'horizon' })
  const sender = dgram.createSocket('udp4')

  try {
    const address = await new Promise((resolve, reject) => {
      source.once('listening', resolve)
      source.once('error', reject)
      source.start()
    })

    const telemetry = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for telemetry')), 1000)
      source.once('telemetry', snapshot => {
        clearTimeout(timeout)
        resolve(snapshot)
      })
    })

    sender.send(makeHorizonPacket(), address.port, '127.0.0.1')
    const snapshot = await telemetry
    assert.equal(snapshot.gear, '5')
    assert.equal(snapshot.rpm, 6000)
  } finally {
    source.stop()
    sender.close()
  }
})
