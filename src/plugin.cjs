'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { createCanvas } = require('@napi-rs/canvas')
const { plugin, logger } = require('@eniac/flexdesigner')
const { DISPLAY_MODES, normalizeConfig } = require('./config.cjs')
const { ForzaUdpSource } = require('./telemetry/forza-udp.cjs')
const { F125UdpSource } = require('./telemetry/f1-25-udp.cjs')
const { EMPTY_SNAPSHOT } = require('./telemetry/snapshot.cjs')
const { DashboardRenderer, WIDTH, HEIGHT } = require('./render/dashboard.cjs')

const DASHBOARD_CID = 'com.zikai.racetelemetry.dashboard'
const CENTER_TOUCH_WIDTH = 270
const CENTER_TOUCH_X = (WIDTH - CENTER_TOUCH_WIDTH) / 2

function readPluginConfig() {
  const configPath = path.resolve(__dirname, '..', 'config.json')
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'))
  } catch (error) {
    logger.warn(`Could not read config.json; using defaults: ${error.message}`)
    return {}
  }
}

class RaceTelemetryPlugin {
  constructor() {
    this.config = normalizeConfig(readPluginConfig())
    this.canvas = createCanvas(WIDTH, HEIGHT)
    this.renderer = new DashboardRenderer(this.canvas, this.config)
    this.targets = new Map()
    this.sources = []
    this.snapshot = EMPTY_SNAPSHOT
    this.renderTimer = null
    this.invalidPacketCount = 0
    this.inFlightTargets = new Set()
    this.drawErrorCount = 0
    this.lastTouchAt = new Map()
  }

  start() {
    this.registerEvents()
    this.startTelemetry()
    this.startRenderLoop()
    plugin.start()
    logger.info('Race Telemetry automatic UDP receivers started for Forza and F1 25')
  }

  registerEvents() {
    plugin.on('plugin.alive', payload => {
      const { serialNumber, keys = [] } = payload
      for (const key of keys) {
        if (key.cid !== DASHBOARD_CID) continue
        const targetId = `${serialNumber}:${key.uid}`
        this.targets.set(targetId, { serialNumber, key })
        if (key.data) this.applyConfig(key.data, false)
        this.renderTarget(serialNumber, key, Date.now())
      }
    })

    plugin.on('plugin.dead', payload => {
      const { serialNumber, keys = [] } = payload
      for (const key of keys) {
        this.targets.delete(`${serialNumber}:${key.uid}`)
      }
    })

    plugin.on('plugin.config.updated', payload => {
      this.applyConfig(payload && payload.config ? payload.config : {}, true)
    })

    plugin.on('plugin.data', payload => {
      const key = payload && payload.data && payload.data.key
      if (key && key.cid === DASHBOARD_CID && key.data) {
        for (const target of this.targets.values()) {
          if (target.key.uid === key.uid) target.key = key
        }
        this.applyConfig(key.data, true)
      }
    })

    plugin.on('device.touch', payload => {
      if (!payload || (payload.state !== 'up' && payload.state !== 'end')) return
      if (payload.x < CENTER_TOUCH_X || payload.x > CENTER_TOUCH_X + CENTER_TOUCH_WIDTH) return

      const now = Date.now()
      if (now - (this.lastTouchAt.get(payload.serialNumber) || 0) < 300) return
      this.lastTouchAt.set(payload.serialNumber, now)

      for (const target of this.targets.values()) {
        if (target.serialNumber !== payload.serialNumber) continue
        const current = normalizeConfig(target.key.data || {}).displayMode
        const next = DISPLAY_MODES[(DISPLAY_MODES.indexOf(current) + 1) % DISPLAY_MODES.length]
        target.key.data = { ...(target.key.data || {}), displayMode: next }
      }
      this.renderAll()
    })
  }

  applyConfig(nextConfig, restartIfNeeded) {
    const oldSource = this.config.source
    const oldHost = this.config.udpHost
    const oldPort = this.config.udpPort
    this.config = normalizeConfig({ ...this.config, ...nextConfig })
    this.renderer.updateConfig(this.config)

    if (restartIfNeeded && (oldSource !== this.config.source || oldHost !== this.config.udpHost || oldPort !== this.config.udpPort)) {
      logger.info(`Telemetry config changed: ${oldSource} ${oldHost}:${oldPort} -> ${this.config.source} ${this.config.udpHost}:${this.config.udpPort}`)
      this.startTelemetry()
    }
    if (restartIfNeeded) this.startRenderLoop()
  }

  startTelemetry() {
    for (const source of this.sources) source.stop()
    this.sources = []

    const forzaPort = this.config.source.startsWith('forza-') ? this.config.udpPort : 9999
    const f1Port = this.config.source === 'f1-25' ? this.config.udpPort : 20777
    const sourceEntries = [
      {
        name: this.config.source === 'forza-motorsport' ? 'forza-motorsport' : 'forza-horizon',
        source: new ForzaUdpSource({
          host: this.config.udpHost,
          port: forzaPort,
          layout: this.config.source === 'forza-motorsport' ? 'motorsport' : 'horizon'
        })
      },
      {
        name: 'f1-25',
        source: new F125UdpSource({ host: this.config.udpHost, port: f1Port })
      }
    ]

    // Avoid trying to bind two protocol parsers to the same custom port. The
    // selected source wins; the automatic secondary receiver uses its standard port.
    if (forzaPort === f1Port) {
      if (this.config.source === 'f1-25') sourceEntries[0].source.port = 9999
      else sourceEntries[1].source.port = 20777
    }

    this.snapshot = EMPTY_SNAPSHOT

    for (const entry of sourceEntries) {
      const { name, source } = entry
      source.on('telemetry', snapshot => {
        this.snapshot = snapshot
      })

      source.on('listening', address => {
        logger.info(`${name} UDP receiver ready on ${address.address}:${address.port}`)
      })

      source.on('invalidPacket', packet => {
        this.invalidPacketCount += 1
        if (this.invalidPacketCount === 1 || this.invalidPacketCount % 300 === 0) {
          logger.warn(`${name}: ignored unsupported UDP packet (${packet.length} bytes)`)
        }
      })

      source.on('error', error => {
        logger.error(`${name} UDP error: ${error.message}`)
      })

      this.sources.push(source)
      source.start()
    }
  }

  startRenderLoop() {
    if (this.renderTimer) clearInterval(this.renderTimer)
    const intervalMs = Math.round(1000 / this.config.renderFps)
    this.renderTimer = setInterval(() => this.renderAll(), intervalMs)
  }

  renderAll() {
    if (this.targets.size === 0) return
    const now = Date.now()
    for (const { serialNumber, key } of this.targets.values()) {
      this.renderTarget(serialNumber, key, now)
    }
  }

  renderTarget(serialNumber, key, now) {
    const targetConfig = normalizeConfig({ ...this.config, ...(key.data || {}) })
    this.renderer.updateConfig(targetConfig)
    this.renderer.render(this.snapshot, now)
    this.sendFrame(serialNumber, key, this.canvas.toDataURL('image/png'), targetConfig.diffUpdate)
  }

  sendFrame(serialNumber, key, image, diffUpdate = this.config.diffUpdate) {
    const targetId = `${serialNumber}:${key.uid}`
    if (this.inFlightTargets.has(targetId)) return

    try {
      const request = plugin.directDraw(serialNumber, key, image, diffUpdate, 0)
      if (request && typeof request.then === 'function') {
        this.inFlightTargets.add(targetId)
        request
          .catch(error => this.reportDrawError(error))
          .finally(() => this.inFlightTargets.delete(targetId))
      }
    } catch (error) {
      this.reportDrawError(error)
    }
  }

  reportDrawError(error) {
    this.drawErrorCount += 1
    if (this.drawErrorCount === 1 || this.drawErrorCount % 100 === 0) {
      logger.error(`Direct Draw failed: ${error.message}`)
    }
  }

  stop() {
    if (this.renderTimer) clearInterval(this.renderTimer)
    for (const source of this.sources) source.stop()
    this.renderTimer = null
    this.sources = []
  }
}

const raceTelemetryPlugin = new RaceTelemetryPlugin()
raceTelemetryPlugin.start()

process.once('SIGTERM', () => raceTelemetryPlugin.stop())
process.once('SIGINT', () => raceTelemetryPlugin.stop())

module.exports = {
  RaceTelemetryPlugin
}
