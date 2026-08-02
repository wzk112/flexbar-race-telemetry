'use strict'

const dgram = require('node:dgram')
const { EventEmitter } = require('node:events')
const { parseForzaPacket } = require('./forza-packet.cjs')
const { GearStabilizer } = require('./gear-stabilizer.cjs')

class ForzaUdpSource extends EventEmitter {
  constructor(options = {}) {
    super()
    this.host = options.host || '0.0.0.0'
    this.port = options.port ?? 9999
    this.layout = options.layout || 'horizon'
    this.socket = null
    this.lastSnapshot = null
    this.lastObservedRawGear = null
    this.gearStabilizer = new GearStabilizer(options.gearConfirmPackets ?? 2)
  }

  start() {
    if (this.socket) return

    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    this.socket = socket

    socket.on('message', (buffer, remote) => {
      const parsed = parseForzaPacket(buffer, {
        layout: this.layout,
        receivedAt: Date.now()
      })
      if (!parsed) {
        this.emit('invalidPacket', { length: buffer.length, remote })
        return
      }
      this.lastObservedRawGear = parsed.rawGear
      const snapshot = parsed.shiftInProgress ? parsed : this.gearStabilizer.update(parsed)
      this.lastSnapshot = snapshot
      this.emit('telemetry', snapshot)
    })

    socket.on('error', error => {
      this.emit('error', error)
    })

    socket.on('listening', () => {
      this.emit('listening', socket.address())
    })

    socket.bind(this.port, this.host)
  }

  stop() {
    const socket = this.socket
    this.socket = null
    this.lastObservedRawGear = null
    this.gearStabilizer.reset()
    if (socket) socket.close()
  }
}

module.exports = {
  ForzaUdpSource
}
