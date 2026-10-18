'use strict'
// Scope mode: a Canvas2D oscilloscope with spectrum bars and event rings.

window.VizCanvas = window.VizCanvas || {}

;(function (reg) {
  const CLASS_HUE = [200, 120, 40, 0, 280, 320]
  const KIND_HUE = { 1: 160, 3: 60, 4: 190, 5: 300, 6: 0 }
  const FADE = 0.22

  function create (canvas) {
    const g = canvas.getContext('2d')
    return {
      // dt: the seconds since the frame before. The afterglow fades by
      // FADE each 1/60 s.
      draw (synth, dt = 1 / 60) {
        const w = canvas.width
        const h = canvas.height
        const L = synth.level
        g.fillStyle = `rgba(0, 0, 0, ${1 - Math.pow(1 - FADE, 60 * dt)})`
        g.fillRect(0, 0, w, h)

        // Spectrum along the bottom.
        const bands = synth.bands
        const bw = w / bands.length
        for (let b = 0; b < bands.length; b++) {
          const m = Math.min(1, Math.log10(1 + 30 * bands[b]) / 1.2)
          const bh = m * h * 0.38
          g.fillStyle = `hsla(${140 - b * 2.6 + 60 * L.treble}, 90%, ${35 + 30 * m}%, 0.85)`
          g.fillRect(b * bw + 1, h - bh, bw - 2, bh)
        }

        // Event rings, coloured by tool class or event kind.
        for (const f of synth.flashes) {
          const age = synth.t - f.t
          const hue = f.kind === 2 ? CLASS_HUE[f.cls] ?? 200 : KIND_HUE[f.kind] || 160
          const cx = w * (f.kind === 2 ? 0.15 + 0.14 * f.cls : 0.5)
          const cy = h * 0.42
          g.strokeStyle = `hsla(${hue}, 95%, 60%, ${Math.max(0, 1 - age / 1.5)})`
          g.lineWidth = 3
          g.beginPath()
          g.arc(cx, cy, 10 + age * w * 0.25, 0, Math.PI * 2)
          g.stroke()
        }

        // The waveform.
        const s = synth.samples
        g.strokeStyle = `hsl(${150 - 110 * L.treble + 40 * L.busy}, 100%, ${55 + 15 * L.bass}%)`
        g.lineWidth = 2
        g.shadowColor = g.strokeStyle
        g.shadowBlur = 12
        g.beginPath()
        for (let i = 0; i < s.length; i++) {
          const x = i / (s.length - 1) * w
          const y = h * 0.42 - s[i] * h * 0.32
          if (i) g.lineTo(x, y)
          else g.moveTo(x, y)
        }
        g.stroke()
        g.shadowBlur = 0
      }
    }
  }

  reg.scope = create
})(window.VizCanvas)
