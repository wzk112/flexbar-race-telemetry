'use strict'

// Forza Dash packet offsets. Horizon inserts 12 bytes after the 232-byte Sled
// portion, so fields after that point move by 12 bytes compared with Motorsport.
const LAYOUTS = Object.freeze({
  horizon: Object.freeze({
    name: 'horizon',
    minimumLength: 323,
    gearOffset: 319,
    clutchOffset: 317
  }),
  motorsport: Object.freeze({
    name: 'motorsport',
    minimumLength: 311,
    gearOffset: 307,
    clutchOffset: 305
  }),
  sled: Object.freeze({
    name: 'sled',
    minimumLength: 232,
    gearOffset: null,
    clutchOffset: null
  })
})

// FH5 emits 11 briefly while a downshift is mechanically in progress. It is
// an intermediate transmission state, not an eleventh forward gear.
const SHIFT_IN_PROGRESS_GEAR = 11

function detectLayout(buffer, preferred = 'auto') {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('Forza packet must be a Buffer')
  }

  if (preferred === 'horizon' && buffer.length >= LAYOUTS.horizon.minimumLength) {
    return LAYOUTS.horizon
  }
  if (preferred === 'motorsport' && buffer.length >= LAYOUTS.motorsport.minimumLength) {
    return LAYOUTS.motorsport
  }
  if (buffer.length >= LAYOUTS.horizon.minimumLength) return LAYOUTS.horizon
  if (buffer.length >= LAYOUTS.motorsport.minimumLength) return LAYOUTS.motorsport
  if (buffer.length >= LAYOUTS.sled.minimumLength) return LAYOUTS.sled
  return null
}

function formatForzaGear(rawGear) {
  if (!Number.isInteger(rawGear)) return '–'
  if (rawGear === 0) return 'R'
  if (rawGear === SHIFT_IN_PROGRESS_GEAR) return 'N'
  return String(rawGear)
}

function validRpm(value) {
  return Number.isFinite(value) && value >= 0 && value <= 30000
}

function parseForzaPacket(buffer, options = {}) {
  const layout = detectLayout(buffer, options.layout || 'auto')
  if (!layout) return null

  const isRaceOn = buffer.readInt32LE(0)
  const timestampMs = buffer.readUInt32LE(4)
  const maxRpm = buffer.readFloatLE(8)
  const idleRpm = buffer.readFloatLE(12)
  const rpm = buffer.readFloatLE(16)

  if ((isRaceOn !== 0 && isRaceOn !== 1) || !validRpm(rpm) || !validRpm(maxRpm) || !validRpm(idleRpm)) {
    return null
  }

  const rawGear = layout.gearOffset === null ? null : buffer.readUInt8(layout.gearOffset)
  const clutch = layout.clutchOffset === null ? null : buffer.readUInt8(layout.clutchOffset)
  if (rawGear !== null && rawGear > 20) return null

  return {
    source: layout.name === 'horizon' ? 'forza-horizon' : 'forza-motorsport',
    connected: true,
    running: isRaceOn === 1,
    rpm,
    maxRpm,
    idleRpm,
    gear: formatForzaGear(rawGear),
    rawGear,
    shiftInProgress: rawGear === SHIFT_IN_PROGRESS_GEAR,
    clutch,
    timestampMs,
    receivedAt: options.receivedAt || Date.now(),
    packetLength: buffer.length,
    layout: layout.name
  }
}

module.exports = {
  LAYOUTS,
  SHIFT_IN_PROGRESS_GEAR,
  detectLayout,
  formatForzaGear,
  parseForzaPacket
}
