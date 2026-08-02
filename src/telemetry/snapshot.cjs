'use strict'

const EMPTY_SNAPSHOT = Object.freeze({
  source: 'none',
  connected: false,
  running: false,
  rpm: 0,
  maxRpm: 0,
  idleRpm: 0,
  gear: '–',
  rawGear: null,
  revLightsPercent: null,
  revLightsBitValue: null,
  timestampMs: 0,
  receivedAt: 0,
  packetLength: 0,
  layout: 'unknown'
})

function isSnapshotFresh(snapshot, now, timeoutMs) {
  return Boolean(snapshot && snapshot.receivedAt > 0 && now - snapshot.receivedAt <= timeoutMs)
}

module.exports = {
  EMPTY_SNAPSHOT,
  isSnapshotFresh
}
