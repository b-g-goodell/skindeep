'use strict'
// The classic analyzer (decision 0015), drawn by the project from the
// look of the spectrum analyzer in the main window of the classic
// desktop MP3 player: 19 thick bars on a black panel of square pixels
// with a dotted grid, bars that rise at once and sink slowly, and a peak
// cap over each bar that holds, then falls faster and faster.
// analyzer: a pixel's colour is its height on the panel, green at the
// foot to red at the top. fire: the colour runs down from each bar's top.

window.VizCanvas = window.VizCanvas || {}

;(function (reg) {
  // The original panel: 76 px across, each bar 3 px and a 1 px gap.
  const COLS = 76
  const BARS = 19
  // Top to foot: red, orange, amber, yellow-green, green, deep green.
  const STOPS = [[238, 56, 24], [230, 112, 10], [224, 170, 28], [158, 212, 38], [52, 196, 24], [24, 132, 10]]
  const PEAK = 'rgb(176, 180, 186)'
  const GRID = 'rgb(34, 38, 46)'

  // t from 0, the top colour, to 1, the foot colour.
  function shade (t) {
    const x = Math.max(0, Math.min(1, t)) * (STOPS.length - 1)
    const i = Math.min(STOPS.length - 2, Math.floor(x))
    const f = x - i
    const c = STOPS[i].map((v, k) => Math.round(v + (STOPS[i + 1][k] - v) * f))
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
  }

  function create (canvas, fire) {
    const g = canvas.getContext('2d')
    const bars = new Float32Array(BARS)
    const peaks = new Float32Array(BARS)
    const fall = new Float32Array(BARS)
    const hold = new Float32Array(BARS)
    let colours = []

    function level (synth, b) {
      const n = synth.bands.length
      const lo = Math.floor(b * n / BARS)
      const hi = Math.max(lo + 1, Math.floor((b + 1) * n / BARS))
      let m = 0
      for (let k = lo; k < hi; k++) m = Math.max(m, synth.bands[k])
      return Math.min(1, Math.log10(1 + 30 * m) / 1.2)
    }

    return {
      draw (synth, dt) {
        const w = canvas.width
        const h = canvas.height
        // Square pixels: as many rows as the window's shape allows, at
        // least the original 16.
        const rows = Math.max(16, Math.round(COLS * h / w))
        const px = Math.min(w / COLS, h / rows)
        const ox = Math.floor((w - px * COLS) / 2)
        const oy = Math.floor((h - px * rows) / 2)
        const gap = px >= 4 ? 1 : 0
        if (colours.length !== rows) colours = Array.from({ length: rows }, (_, r) => shade(r / (rows - 1)))

        for (let b = 0; b < BARS; b++) {
          const v = level(synth, b)
          bars[b] = v >= bars[b] ? v : Math.max(v, bars[b] - dt * 1.4)
          if (bars[b] >= peaks[b]) {
            peaks[b] = bars[b]
            fall[b] = 0
            hold[b] = 0.4
          } else if (hold[b] > 0) {
            hold[b] -= dt
          } else {
            fall[b] += dt * 2.2
            peaks[b] = Math.max(bars[b], peaks[b] - fall[b] * dt)
          }
        }

        g.fillStyle = '#000'
        g.fillRect(0, 0, w, h)
        const dot = Math.max(1, Math.round(px * 0.3))
        g.fillStyle = GRID
        for (let r = 1; r < rows; r += 2) {
          for (let c = 1; c < COLS; c += 2) g.fillRect(ox + c * px, oy + r * px, dot, dot)
        }

        for (let b = 0; b < BARS; b++) {
          const x0 = ox + b * 4 * px
          const n = Math.round(bars[b] * rows)
          for (let k = 0; k < n; k++) {
            // k counts up from the foot; colours[0] is the top row.
            const row = rows - 1 - k
            g.fillStyle = fire ? colours[Math.min(rows - 1, n - 1 - k)] : colours[row]
            for (let c = 0; c < 3; c++) g.fillRect(x0 + c * px, oy + row * px, px - gap, px - gap)
          }
          const p = Math.round(peaks[b] * rows)
          if (p > 0) {
            g.fillStyle = PEAK
            const row = rows - p
            for (let c = 0; c < 3; c++) g.fillRect(x0 + c * px, oy + row * px, px - gap, px - gap)
          }
        }
      }
    }
  }

  reg.analyzer = canvas => create(canvas, false)
  reg.fire = canvas => create(canvas, true)
})(window.VizCanvas)
