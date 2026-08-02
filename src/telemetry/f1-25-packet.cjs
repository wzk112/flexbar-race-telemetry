'use strict'

// EA SPORTS F1 25 and the F1 25: 2026 Season Pack both use a 29-byte
// header. The fields used here retain the same offsets across both modes.
const HEADER_SIZE = 29
const PACKET_ID_CAR_TELEMETRY = 6
const PACKET_ID_CAR_STATUS = 7

const LAYOUTS = Object.freeze({
  2025: Object.freeze({
    packetFormat: 2025,
    carCount: 22,
    telemetryLength: 1352,
    telemetryRecordSize: 60,
    statusLength: 1239,
    statusRecordSize: 55
  }),
  2026: Object.freeze({
    packetFormat: 2026,
    carCount: 24,
    telemetryLength: 1448,
    telemetryRecordSize: 59,
    statusLength: 1445,
    statusRecordSize: 59
  })
})

function parseF1Header(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < HEADER_SIZE) return null

  const packetFormat = buffer.readUInt16LE(0)
  const layout = LAYOUTS[packetFormat]
  if (!layout) return null

  const playerCarIndex = buffer.readUInt8(27)
  if (playerCarIndex >= layout.carCount) return null

  return {
    packetFormat,
    gameYear: buffer.readUInt8(2),
    packetVersion: buffer.readUInt8(5),
    packetId: buffer.readUInt8(6),
    frameIdentifier: buffer.readUInt32LE(19),
    playerCarIndex,
    layout
  }
}

function formatF1Gear(rawGear) {
  if (rawGear === -1) return 'R'
  if (rawGear === 0) return 'N'
  if (Number.isInteger(rawGear) && rawGear >= 1 && rawGear <= 8) return String(rawGear)
  return '–'
}

function parseF1StatusPacket(buffer) {
  const header = parseF1Header(buffer)
  if (!header || header.packetId !== PACKET_ID_CAR_STATUS || buffer.length < header.layout.statusLength) {
    return null
  }

  const offset = HEADER_SIZE + header.playerCarIndex * header.layout.statusRecordSize
  const maxRpm = buffer.readUInt16LE(offset + 17)
  const idleRpm = buffer.readUInt16LE(offset + 19)
  const maxGears = buffer.readUInt8(offset + 21)
  if (maxRpm < 1000 || maxRpm > 30000 || idleRpm > maxRpm || maxGears > 12) return null

  return {
    packetFormat: header.packetFormat,
    playerCarIndex: header.playerCarIndex,
    maxRpm,
    idleRpm,
    maxGears
  }
}

function parseF1TelemetryPacket(buffer, options = {}) {
  const header = parseF1Header(buffer)
  if (!header || header.packetId !== PACKET_ID_CAR_TELEMETRY || buffer.length < header.layout.telemetryLength) {
    return null
  }

  const offset = HEADER_SIZE + header.playerCarIndex * header.layout.telemetryRecordSize
  const rawGear = buffer.readInt8(offset + 15)
  const rpm = buffer.readUInt16LE(offset + 16)
  const revLightsPercent = buffer.readUInt8(offset + 19)
  const revLightsBitValue = buffer.readUInt16LE(offset + 20) & 0x7fff
  if (rawGear < -1 || rawGear > 8 || rpm > 30000 || revLightsPercent > 100) return null

  const status = options.status || {}
  const statusMatches = status.packetFormat === header.packetFormat && status.playerCarIndex === header.playerCarIndex
  const maxRpm = statusMatches && status.maxRpm > 0 ? status.maxRpm : 15000
  const idleRpm = statusMatches ? status.idleRpm : 0

  return {
    source: 'f1-25',
    connected: true,
    running: true,
    rpm,
    maxRpm,
    idleRpm,
    gear: formatF1Gear(rawGear),
    rawGear,
    shiftInProgress: false,
    clutch: buffer.readUInt8(offset + 14),
    revLightsPercent,
    revLightsBitValue,
    timestampMs: header.frameIdentifier,
    receivedAt: options.receivedAt || Date.now(),
    packetLength: buffer.length,
    layout: `f1-${header.packetFormat}`,
    playerCarIndex: header.playerCarIndex
  }
}

module.exports = {
  HEADER_SIZE,
  LAYOUTS,
  PACKET_ID_CAR_STATUS,
  PACKET_ID_CAR_TELEMETRY,
  formatF1Gear,
  parseF1Header,
  parseF1StatusPacket,
  parseF1TelemetryPacket
}
