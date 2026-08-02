'use strict'

const dgram = require('node:dgram')
const { EventEmitter } = require('node:events')
const {
  PACKET_ID_CAR_STATUS,
  PACKET_ID_CAR_TELEMETRY,
  parseF1Header,
  parseF1StatusPacket,
  parseF1TelemetryPacket
} = require('./f1-25-packet.cjs')

class F125UdpSource extends EventEmitter {
  constructor(options = {}) {
    super()
    this.host = options.host || '0.0.0.0'
    this.port = options.port ?? 20777
    this.socket = null
    this.status = null
    this.lastSnapshot = null
  }

  start() {
    if (this.socket) return

    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    this.socket = socket

    socket.on('message', (buffer, remote) => {
      const header = parseF1Header(buffer)
      if (!header) {
        this.emit('invalidPacket', { length: buffer.length, remote })
        return
      }

      if (header.packetId === PACKET_ID_CAR_STATUS) {
        const status = parseF1StatusPacket(buffer)
        if (status) this.status = status
        else this.emit('invalidPacket', { length: buffer.length, remote })
        return
      }

      if (header.packetId !== PACKET_ID_CAR_TELEMETRY) return

      const snapshot = parseF1TelemetryPacket(buffer, {
        status: this.status,
        receivedAt: Date.now()
      })
      if (!snapshot) {
        this.emit('invalidPacket', { length: buffer.length, remote })
        return
      }

      this.lastSnapshot = snapshot
      this.emit('telemetry', snapshot)
    })

    socket.on('error', error => this.emit('error', error))
    socket.on('listening', () => this.emit('listening', socket.address()))
    socket.bind(this.port, this.host)
  }

  stop() {
    const socket = this.socket
    this.socket = null
    this.status = null
    this.lastSnapshot = null
    if (socket) socket.close()
  }
}

module.exports = {
  F125UdpSource
}
