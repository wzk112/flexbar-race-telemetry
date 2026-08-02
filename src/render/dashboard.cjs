'use strict'

const { normalizeConfig } = require('../config.cjs')
const { isSnapshotFresh } = require('../telemetry/snapshot.cjs')
const {
  DEFAULT_SEGMENT_COUNT,
  getShiftLightState,
  segmentColor
} = require('./shift-lights.cjs')

const WIDTH = 2170
const HEIGHT = 60
const CENTER_WIDTH = 270
const CENTER_X = (WIDTH - CENTER_WIDTH) / 2

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

function drawSegment(ctx, x, y, width, height, color, active) {
  roundedRect(ctx, x, y, width, height, 5)
  ctx.fillStyle = color
  ctx.globalAlpha = active ? 1 : 0.62
  if (active) {
    ctx.shadowColor = color
    ctx.shadowBlur = 12
  }
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.globalAlpha = 1
}

class DashboardRenderer {
  constructor(canvas, config = {}) {
    if (!canvas || typeof canvas.getContext !== 'function') {
      throw new TypeError('DashboardRenderer requires a Canvas-compatible object')
    }
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.updateConfig(config)
  }

  updateConfig(config) {
    this.config = normalizeConfig(config)
  }

  render(snapshot, now = Date.now()) {
    const ctx = this.ctx
    const config = this.config
    const fresh = isSnapshotFresh(snapshot, now, config.telemetryTimeoutMs)
    const running = fresh && snapshot.running

    ctx.clearRect(0, 0, WIDTH, HEIGHT)
    ctx.save()
    try {
      if (config.rotate180) {
        ctx.translate(WIDTH, HEIGHT)
        ctx.rotate(Math.PI)
      }

      ctx.fillStyle = config.colors.background
      ctx.fillRect(0, 0, WIDTH, HEIGHT)

      if (running) {
        this.drawLights(snapshot, now)
        this.drawCenter(snapshot.gear, Math.round(snapshot.rpm), true)
      } else if (fresh) {
        this.drawInactiveLights()
        this.drawCenter('–', 'STANDBY', false)
      } else {
        this.drawInactiveLights()
        this.drawCenter('–', 'NO DATA · UDP ' + config.udpPort, false)
      }
    } finally {
      ctx.restore()
    }

    return this.canvas
  }

  drawInactiveLights() {
    this.drawLightBanks({ activeCount: 0, flashing: false, flashOn: false, segmentCount: DEFAULT_SEGMENT_COUNT })
  }

  drawLights(snapshot, now) {
    this.drawLightBanks(getShiftLightState(snapshot, this.config, now))
  }

  drawLightBanks(state) {
    const ctx = this.ctx
    const config = this.config
    const count = state.segmentCount
    const sidePadding = 34
    const centerGap = 22
    const bankInnerEdge = CENTER_X - centerGap
    const bankWidth = bankInnerEdge - sidePadding
    const gap = 9
    const segmentWidth = (bankWidth - gap * (count - 1)) / count
    const y = 9
    const height = 42

    for (let index = 0; index < count; index += 1) {
      const active = index < state.activeCount
      const activeColor = segmentColor(index, count, config, state.flashing, state.flashOn)
      const color = active ? activeColor : config.colors.inactive
      const leftX = bankInnerEdge - segmentWidth - index * (segmentWidth + gap)
      const rightX = CENTER_X + CENTER_WIDTH + centerGap + index * (segmentWidth + gap)
      drawSegment(ctx, leftX, y, segmentWidth, height, color, active)
      drawSegment(ctx, rightX, y, segmentWidth, height, color, active)
    }
  }

  drawCenter(gear, rpmText, active) {
    const ctx = this.ctx
    const config = this.config

    const gradient = ctx.createLinearGradient(CENTER_X, 0, CENTER_X + CENTER_WIDTH, HEIGHT)
    gradient.addColorStop(0, '#0a111b')
    gradient.addColorStop(0.5, '#111d2b')
    gradient.addColorStop(1, '#0a111b')
    roundedRect(ctx, CENTER_X, 2, CENTER_WIDTH, HEIGHT - 4, 10)
    ctx.fillStyle = gradient
    ctx.fill()
    ctx.strokeStyle = active ? '#334b62' : '#1d2b39'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = active ? config.colors.text : config.colors.secondaryText
    const mode = active ? config.displayMode : 'gear-rpm'

    if (mode === 'gear') {
      ctx.font = '900 48px Arial'
      ctx.fillText(String(gear), WIDTH / 2, 47)
      return
    }

    if (mode === 'rpm') {
      ctx.font = '900 34px Arial'
      const rpm = typeof rpmText === 'number' ? rpmText.toLocaleString('en-US') : String(rpmText)
      ctx.fillText(rpm, WIDTH / 2, 43)
      ctx.fillStyle = config.colors.secondaryText
      ctx.font = '700 11px Arial'
      ctx.fillText('RPM', WIDTH / 2, 56)
      return
    }

    ctx.font = '900 40px Arial'
    ctx.fillText(String(gear), WIDTH / 2, 40)
    ctx.fillStyle = config.colors.secondaryText
    ctx.font = '700 11px Arial'
    const label = typeof rpmText === 'number' ? `${rpmText.toLocaleString('en-US')} RPM` : String(rpmText)
    ctx.fillText(label, WIDTH / 2, 55)
  }
}

module.exports = {
  CENTER_WIDTH,
  DashboardRenderer,
  HEIGHT,
  WIDTH
}
