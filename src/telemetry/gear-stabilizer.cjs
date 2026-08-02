'use strict'

const { formatForzaGear } = require('./forza-packet.cjs')

class GearStabilizer {
  constructor(confirmPackets = 2) {
    this.confirmPackets = Math.max(1, Math.round(confirmPackets))
    this.reset()
  }

  reset() {
    this.stableRawGear = null
    this.candidateRawGear = null
    this.candidateCount = 0
  }

  update(snapshot) {
    if (!snapshot || !Number.isInteger(snapshot.rawGear)) return snapshot

    const observedRawGear = snapshot.rawGear
    if (this.stableRawGear === null) {
      this.stableRawGear = observedRawGear
    } else if (observedRawGear === this.stableRawGear) {
      this.candidateRawGear = null
      this.candidateCount = 0
    } else if (Math.abs(observedRawGear - this.stableRawGear) === 1) {
      // Normal sequential shifts should feel immediate. Only implausible jumps
      // need confirmation, which still hides the observed one-frame gear spike.
      this.stableRawGear = observedRawGear
      this.candidateRawGear = null
      this.candidateCount = 0
    } else {
      if (observedRawGear === this.candidateRawGear) {
        this.candidateCount += 1
      } else {
        this.candidateRawGear = observedRawGear
        this.candidateCount = 1
      }

      if (this.candidateCount >= this.confirmPackets) {
        this.stableRawGear = observedRawGear
        this.candidateRawGear = null
        this.candidateCount = 0
      }
    }

    return {
      ...snapshot,
      observedRawGear,
      rawGear: this.stableRawGear,
      gear: formatForzaGear(this.stableRawGear)
    }
  }
}

module.exports = {
  GearStabilizer
}
