'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { createCanvas } = require('@napi-rs/canvas')
const { DashboardRenderer, WIDTH, HEIGHT } = require('../src/render/dashboard.cjs')

test('renders a valid 2170 by 60 dashboard PNG', () => {
  const canvas = createCanvas(WIDTH, HEIGHT)
  const renderer = new DashboardRenderer(canvas)
  const now = Date.now()

  renderer.render({
    connected: true,
    running: true,
    rpm: 7420,
    maxRpm: 8000,
    idleRpm: 900,
    gear: '3',
    receivedAt: now
  }, now)

  const png = canvas.toBuffer('image/png')
  assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG')
  assert.ok(png.length > 1000)
})

test('rotates the complete dashboard by 180 degrees', () => {
  const now = Date.now()
  const telemetry = {
    connected: true,
    running: true,
    rpm: 7420,
    maxRpm: 8000,
    idleRpm: 900,
    gear: '3',
    receivedAt: now
  }
  const normalCanvas = createCanvas(WIDTH, HEIGHT)
  const rotatedCanvas = createCanvas(WIDTH, HEIGHT)
  new DashboardRenderer(normalCanvas).render(telemetry, now)
  new DashboardRenderer(rotatedCanvas, { rotate180: true }).render(telemetry, now)

  const normal = normalCanvas.getContext('2d').getImageData(0, 0, WIDTH, HEIGHT).data
  const rotated = rotatedCanvas.getContext('2d').getImageData(0, 0, WIDTH, HEIGHT).data

  let rotatedDifference = 0
  let unrotatedDifference = 0
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const normalOffset = (y * WIDTH + x) * 4
      const rotatedOffset = ((HEIGHT - 1 - y) * WIDTH + (WIDTH - 1 - x)) * 4
      for (let channel = 0; channel < 3; channel += 1) {
        rotatedDifference += Math.abs(rotated[rotatedOffset + channel] - normal[normalOffset + channel])
        unrotatedDifference += Math.abs(rotated[normalOffset + channel] - normal[normalOffset + channel])
      }
    }
  }

  // Canvas antialiasing is not bit-identical after a transform, but the flipped
  // image must be materially closer to the normal image rotated by 180 degrees.
  assert.ok(rotatedDifference < unrotatedDifference * 0.8)
})
