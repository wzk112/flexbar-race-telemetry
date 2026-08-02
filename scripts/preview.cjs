'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { createCanvas } = require('@napi-rs/canvas')
const { DashboardRenderer } = require('../src/render/dashboard.cjs')
const { DEFAULT_CONFIG } = require('../src/config.cjs')

const canvas = createCanvas(2170, 60)
const renderer = new DashboardRenderer(canvas, DEFAULT_CONFIG)
renderer.render({
  connected: true,
  running: true,
  rpm: 7420,
  maxRpm: 8000,
  idleRpm: 900,
  gear: '3',
  receivedAt: Date.now()
}, Date.now())

const output = path.resolve(__dirname, '..', 'work', 'dashboard-preview.png')
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, canvas.toBuffer('image/png'))
console.log(output)
