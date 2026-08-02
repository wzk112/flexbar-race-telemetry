'use strict'

const { clamp } = require('../config.cjs')

const DEFAULT_SEGMENT_COUNT = 14

function rpmRatio(snapshot) {
  if (!snapshot || !Number.isFinite(snapshot.rpm) || !Number.isFinite(snapshot.maxRpm) || snapshot.maxRpm <= 0) {
    return 0
  }
  return clamp(snapshot.rpm / snapshot.maxRpm, 0, 1.25)
}

function getShiftLightState(snapshot, config, now = Date.now(), segmentCount = DEFAULT_SEGMENT_COUNT) {
  const ratio = rpmRatio(snapshot)
  const start = config.lightsStartRatio
  const flash = config.flashRatio
  const hasGameLights = snapshot && snapshot.source === 'f1-25' && Number.isInteger(snapshot.revLightsBitValue)
  const gameLightCount = hasGameLights ? countSetBits(snapshot.revLightsBitValue & 0x7fff) : 0
  const gameLightRatio = gameLightCount / 15
  const hasGamePercent = snapshot && snapshot.source === 'f1-25' && Number.isFinite(snapshot.revLightsPercent)
  const gamePercentRatio = hasGamePercent ? clamp(snapshot.revLightsPercent / 100, 0, 1) : 0
  const progress = hasGameLights
    ? Math.max(gameLightRatio, gamePercentRatio)
    : clamp((ratio - start) / Math.max(0.01, flash - start), 0, 1)
  let activeCount = hasGameLights
    ? Math.round(progress * segmentCount)
    : ratio < start ? 0 : Math.max(1, Math.ceil(progress * segmentCount))
  const gameLightsFull = gameLightCount >= 15 || (hasGamePercent && snapshot.revLightsPercent >= 100)
  const flashing = hasGameLights ? gameLightsFull : ratio >= flash
  if (flashing) activeCount = segmentCount
  const flashOn = !flashing || Math.floor(now / 90) % 2 === 0

  return {
    ratio,
    gameControlled: hasGameLights,
    gameLightRatio,
    gamePercentRatio,
    activeCount,
    flashing,
    flashOn,
    segmentCount
  }
}

function countSetBits(value) {
  let bits = value >>> 0
  let count = 0
  while (bits) {
    bits &= bits - 1
    count += 1
  }
  return count
}

function segmentColor(index, segmentCount, config, flashing, flashOn) {
  if (flashing) return flashOn ? config.colors.flash : config.colors.text
  const position = index / Math.max(1, segmentCount - 1)
  if (position >= 0.78) return config.colors.red
  if (position >= 0.43) return config.colors.yellow
  return config.colors.green
}

module.exports = {
  DEFAULT_SEGMENT_COUNT,
  countSetBits,
  getShiftLightState,
  rpmRatio,
  segmentColor
}
