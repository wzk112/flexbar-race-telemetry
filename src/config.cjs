'use strict'

const DISPLAY_MODES = Object.freeze(['gear-rpm', 'gear', 'rpm'])
const TELEMETRY_SOURCES = Object.freeze(['forza-horizon', 'forza-motorsport', 'f1-25'])
const SOURCE_DEFAULT_PORTS = Object.freeze({
  'forza-horizon': 9999,
  'forza-motorsport': 9999,
  'f1-25': 20777
})

const DEFAULT_CONFIG = Object.freeze({
  source: 'forza-horizon',
  udpHost: '0.0.0.0',
  udpPort: 9999,
  renderFps: 30,
  lightsStartRatio: 0.65,
  redlineRatio: 0.9,
  flashRatio: 0.94,
  telemetryTimeoutMs: 1200,
  diffUpdate: false,
  rotate180: false,
  displayMode: 'gear-rpm',
  colors: {
    background: '#020408',
    inactive: '#101820',
    green: '#22e878',
    yellow: '#ffd43b',
    red: '#ff304f',
    flash: '#a855f7',
    text: '#f8fafc',
    secondaryText: '#9fb3c8'
  }
})

function finiteNumber(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function normalizeConfig(config = {}) {
  const source = TELEMETRY_SOURCES.includes(config.source) ? config.source : DEFAULT_CONFIG.source
  const mergedColors = { ...DEFAULT_CONFIG.colors, ...(config.colors || {}) }
  if (String(mergedColors.flash).toLowerCase() === '#38bdf8') {
    mergedColors.flash = DEFAULT_CONFIG.colors.flash
  }
  const start = clamp(finiteNumber(config.lightsStartRatio, DEFAULT_CONFIG.lightsStartRatio), 0.2, 0.95)
  const redline = clamp(finiteNumber(config.redlineRatio, DEFAULT_CONFIG.redlineRatio), start + 0.01, 0.99)
  const configuredFlash = finiteNumber(config.flashRatio, DEFAULT_CONFIG.flashRatio)
  // Migrate keys created by versions <= 0.1.3, whose hidden default was 0.97.
  const requestedFlash = configuredFlash === 0.97 ? DEFAULT_CONFIG.flashRatio : configuredFlash
  const flash = clamp(requestedFlash, redline + 0.01, 1.2)

  return {
    ...DEFAULT_CONFIG,
    ...config,
    source,
    colors: mergedColors,
    udpHost: typeof config.udpHost === 'string' ? config.udpHost : DEFAULT_CONFIG.udpHost,
    udpPort: Math.round(clamp(finiteNumber(config.udpPort, DEFAULT_CONFIG.udpPort), 1, 65535)),
    renderFps: Math.round(clamp(finiteNumber(config.renderFps, DEFAULT_CONFIG.renderFps), 5, 45)),
    lightsStartRatio: start,
    redlineRatio: redline,
    flashRatio: flash,
    telemetryTimeoutMs: Math.round(clamp(finiteNumber(config.telemetryTimeoutMs, DEFAULT_CONFIG.telemetryTimeoutMs), 250, 10000)),
    diffUpdate: config.diffUpdate === true,
    rotate180: config.rotate180 === true,
    displayMode: DISPLAY_MODES.includes(config.displayMode) ? config.displayMode : DEFAULT_CONFIG.displayMode
  }
}

module.exports = {
  DEFAULT_CONFIG,
  DISPLAY_MODES,
  TELEMETRY_SOURCES,
  SOURCE_DEFAULT_PORTS,
  clamp,
  normalizeConfig
}
