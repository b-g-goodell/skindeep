'use strict'
/* global Synth, VizModes, VizCanvas, VizPresets, butterchurn */
// The visualization page (decision 0015), fed only by window.vizFeed
// numeric frames. Each frame names the mode to show by its index in
// modes.js: the main process owns the mode, and sees the clicks and the
// space bar that cycle it, so the page sends nothing.

;(function () {
  const synth = new Synth.Synth()
  const milkCanvas = document.getElementById('milk')
  const flatCanvas = document.getElementById('flat')
  const label = document.getElementById('mode')
  let milk = null
  let note = ''
  let shown = -1
  let flat = null

  function size () {
    for (const c of [milkCanvas, flatCanvas]) {
      c.width = window.innerWidth
      c.height = window.innerHeight
    }
    if (milk) milk.setRendererSize(window.innerWidth, window.innerHeight)
  }

  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    if (!gl) throw new Error('no WebGL2')
    // An OfflineAudioContext gives butterchurn its analysers without
    // opening any audio device. Levels come from render({audioLevels}).
    const ctx = new OfflineAudioContext(2, 44100, 44100)
    const bc = butterchurn.default || butterchurn
    milk = bc.createVisualizer(ctx, milkCanvas, { width: window.innerWidth, height: window.innerHeight, pixelRatio: 1 })
  } catch (e) {
    note = 'needs WebGL2, showing scope: ' + e.message
  }

  // Show mode m. A butterchurn preset blends from the one before; from a
  // Canvas2D mode it starts at once, since its canvas holds no frame. A
  // milk mode without WebGL2 shows the scope.
  function show (m) {
    if (!(m >= 0 && m < VizModes.length) || m === shown) return
    const prev = shown >= 0 ? VizModes[shown] : null
    const mode = VizModes[m]
    shown = m
    const gl = mode.kind === 'milk' && milk
    if (gl) {
      milk.loadPreset(VizPresets[mode.id], prev && prev.kind === 'milk' ? 1.5 : 0)
      flat = null
    } else {
      const g = flatCanvas.getContext('2d')
      g.fillStyle = '#000'
      g.fillRect(0, 0, flatCanvas.width, flatCanvas.height)
      flat = VizCanvas[mode.kind === 'milk' ? 'scope' : mode.id](flatCanvas)
    }
    milkCanvas.hidden = !gl
    flatCanvas.hidden = !!gl
    label.textContent = mode.label + (mode.kind === 'milk' && note ? '  (' + note + ')' : '')
  }

  window.addEventListener('resize', size)
  window.vizFeed.onFrame(f => {
    synth.input(f)
    show(f.m)
  })

  let prev = performance.now()
  function loop (now) {
    const dt = Math.min(0.1, (now - prev) / 1000)
    prev = now
    synth.step(dt)
    if (shown >= 0) {
      if (flat) {
        flat.draw(synth, dt)
      } else {
        const b = synth.bytes()
        milk.render({ audioLevels: { timeByteArray: b, timeByteArrayL: b, timeByteArrayR: b } })
      }
    }
    requestAnimationFrame(loop)
  }

  size()
  window.vizState = () => ({ modes: VizModes.map(m => m.id), mode: shown >= 0 ? VizModes[shown].id : null, webgl: !!milk })
  requestAnimationFrame(loop)
})()
