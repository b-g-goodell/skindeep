'use strict'
/*
  Two render effects of Advanced Visualization Studio (AVS), ported to
  Canvas2D for the visualization (decision 0015): the Superscope, running
  three examples of its built-in list, and the Dot Plane. Ported from the
  BSD-licensed AVS source as the vis_avs port keeps it,
  https://codeberg.org/exo-cortex/vis_avs at commit
  1cee1f3d4f783b830538c3e4d2082a2c59521dee: avs/vis_avs/e_superscope.h
  (the examples), e_superscope.cpp, e_dotplane.cpp, e_dotplane.h and
  matrix.cpp. The audio they read is the visualization's synthetic signal.

  LICENSE
  -------
Copyright 2005 Nullsoft, Inc.
All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice,
    this list of conditions and the following disclaimer.

  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation
    and/or other materials provided with the distribution.

  * Neither the name of Nullsoft nor the names of its contributors may be used to
    endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR
IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER
IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT
OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

window.VizCanvas = window.VizCanvas || {}

;(function (reg) {
  const PI = Math.PI

  // EEL's rand(x): an integer from 0 below x.
  function rand (x) {
    return Math.floor(Math.random() * Math.max(1, Math.floor(x)))
  }

  // The audio value AVS gives the Superscope at i in [0, 1]: the
  // waveform, linearly interpolated, in [-1, 1].
  function wave (samples, i) {
    const p = Math.max(0, Math.min(1, i)) * (samples.length - 1)
    const k = Math.min(samples.length - 2, Math.floor(p))
    return samples[k] + (samples[k + 1] - samples[k]) * (p - k)
  }

  // The spectrum the Dot Plane reads per column, 0 to 255: the
  // synthesiser's log-spaced bands stretched across the columns.
  function spectrum (bands, x, cols) {
    const p = x * (bands.length - 1) / (cols - 1)
    const k = Math.min(bands.length - 2, Math.floor(p))
    const b = bands[k] + (bands[k + 1] - bands[k]) * (p - k)
    return Math.min(255, Math.floor(255 * Math.log10(1 + 30 * b) / 1.2))
  }

  // ---- Superscope ------------------------------------------------------

  // Examples of the Superscope's built-in list, translated from EEL. Each
  // keeps its variables in s, as EEL keeps them across frames.
  const EXAMPLES = {
    // "Spiral"
    spiral: {
      init (s) { s.n = 800 },
      frame (s) { s.t = s.t - 0.05 },
      point (s) {
        const d = s.i + s.v * 0.2
        const r = s.t + s.i * PI * 4
        s.x = Math.cos(r) * d
        s.y = Math.sin(r) * d
      }
    },
    // "Rotating Bow Thing"
    bow: {
      init (s) { s.n = 80; s.t = 0.0 },
      frame (s) { s.t = s.t + 0.01 },
      point (s) {
        const r = s.i * PI * 2
        const d = Math.sin(r * 3) + s.v * 0.5
        s.x = Math.cos(s.t + r) * d
        s.y = Math.sin(s.t - r) * d
      }
    },
    // "Spiral Graph Fun"
    graph: {
      init (s) { s.n = 100; s.t = 0 },
      frame (s) { s.t = s.t + 0.01 },
      beat (s) { s.n = 80 + rand(120.0) },
      point (s) {
        const r = s.i * PI * 128 + s.t
        s.x = Math.cos(r / 64) * 0.7 + Math.sin(r) * 0.3
        s.y = Math.sin(r / 64) * 0.7 + Math.cos(r) * 0.3
      }
    }
  }

  // One Superscope of an effect list: its example and its colours, which
  // it fades through, 64 frames from one to the next.
  function scope (example, colors) {
    const ex = EXAMPLES[example]
    const s = { n: 100, t: 0, r: 0, i: 0, v: 0, x: 0, y: 0, w: 0, h: 0, b: 0 }
    let fresh = true
    let pos = 0
    return {
      frame (g, w, h, samples, beat) {
        pos = (pos + 1) % (colors.length * 64)
        const p = Math.floor(pos / 64)
        const f = pos & 63
        const c1 = colors[p]
        const c2 = colors[(p + 1) % colors.length]
        const rgb = [16, 8, 0].map(sh => Math.floor((((c1 >> sh) & 255) * (63 - f) + ((c2 >> sh) & 255) * f) / 64))
        s.w = w
        s.h = h
        s.b = beat ? 1 : 0
        if (fresh) {
          ex.init(s)
          fresh = false
        }
        if (ex.frame) ex.frame(s)
        if (beat && ex.beat) ex.beat(s)
        const n = Math.min(128 * 1024, Math.floor(s.n))
        if (n < 2) return
        g.strokeStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
        g.beginPath()
        for (let k = 0; k < n; k++) {
          s.i = k / (n - 1)
          s.v = wave(samples, s.i)
          ex.point(s)
          const x = (s.x + 1) * w * 0.5
          const y = (s.y + 1) * h * 0.5
          // A point the equations blew up is skipped, and the line restarts.
          if (!isFinite(x) || !isFinite(y)) {
            g.stroke()
            g.beginPath()
            continue
          }
          if (k) g.lineTo(x, y)
          else g.moveTo(x, y)
        }
        g.stroke()
      }
    }
  }

  // The effect list of the superscope mode: a fade, then three scopes.
  function superscope (canvas) {
    const g = canvas.getContext('2d')
    const list = [
      scope('graph', [0x1c2899, 0x5a2290, 0x125e5e]),
      scope('bow', [0xff7a1a, 0xff2a5a, 0xffd21a]),
      scope('spiral', [0xffffff, 0x9fe8ff, 0xffe08a])
    ]
    const STEP = 1 / 60
    let acc = 0
    let beats = -1
    g.fillStyle = '#000'
    g.fillRect(0, 0, canvas.width, canvas.height)
    return {
      draw (synth, dt) {
        const w = canvas.width
        const h = canvas.height
        acc = Math.min(acc + dt, 0.1)
        g.lineWidth = Math.max(1, Math.round(Math.min(w, h) / 360))
        g.lineJoin = 'round'
        while (acc >= STEP) {
          acc -= STEP
          const beat = beats >= 0 && synth.beats !== beats
          beats = synth.beats
          g.fillStyle = 'rgba(0, 0, 0, 0.14)'
          g.fillRect(0, 0, w, h)
          for (const sc of list) sc.frame(g, w, h, synth.samples, beat)
        }
      }
    }
  }

  // ---- Dot Plane -------------------------------------------------------

  const GRID = 64

  function rotate (m, axis, deg) {
    const d = deg * 3.141592653589 / 180
    m.fill(0)
    m[((axis - 1) << 2) + axis - 1] = m[15] = 1
    const m1 = axis % 3
    const m2 = (m1 + 1) % 3
    const c = Math.cos(d)
    const s = Math.sin(d)
    m[(m1 << 2) + m1] = c
    m[(m1 << 2) + m2] = s
    m[(m2 << 2) + m2] = c
    m[(m2 << 2) + m1] = -s
  }

  function translate (m, x, y, z) {
    m.fill(0)
    m[0] = m[5] = m[10] = m[15] = 1
    m[3] = x
    m[7] = y
    m[11] = z
  }

  function multiply (dest, src) {
    const t = Float32Array.from(dest)
    for (let i = 0; i < 16; i += 4) {
      for (let j = 0; j < 4; j++) dest[i + j] = src[i] * t[j] + src[i + 1] * t[4 + j] + src[i + 2] * t[8 + j] + src[i + 3] * t[12 + j]
    }
  }

  // The default colours of the Dot Plane, low to high, as 0xRRGGBB.
  const PLANE_COLORS = [0x1c6b18, 0xff0a23, 0x2a1d74, 0x9036d9, 0x6b88ff]

  function colorMap () {
    const map = new Uint32Array(64)
    for (let t = 0; t < 4; t++) {
      const c1 = PLANE_COLORS[t]
      const c2 = PLANE_COLORS[t + 1]
      const ch = (c, sh) => (c >> sh) & 255
      let r = ch(c1, 0) << 16
      let g = ch(c1, 8) << 16
      let b = ch(c1, 16) << 16
      const dr = Math.trunc(((ch(c2, 0) - ch(c1, 0)) << 16) / 16)
      const dg = Math.trunc(((ch(c2, 8) - ch(c1, 8)) << 16) / 16)
      const db = Math.trunc(((ch(c2, 16) - ch(c1, 16)) << 16) / 16)
      for (let x = 0; x < 16; x++) {
        map[t * 16 + x] = (r >> 16) | ((g >> 16) << 8) | ((b >> 16) << 16)
        r += dr
        g += dg
        b += db
      }
    }
    return map
  }

  function dotplane (canvas) {
    const g = canvas.getContext('2d')
    // AVS drew into a frame buffer one pixel per dot. Here the buffer is
    // half the window, scaled up without smoothing.
    const buf = document.createElement('canvas')
    const bg = buf.getContext('2d')
    let img = null
    let px = null
    const height = new Float32Array(GRID * GRID)
    const delta = new Float32Array(GRID * GRID)
    const color = new Uint32Array(GRID * GRID)
    const map = colorMap()
    const transform = new Float32Array(16)
    const t2 = new Float32Array(16)
    const line = new Float32Array(GRID)
    let rotation = 0
    // AVS's rotation speed runs from -50 to 50, 16 by default, in fifths
    // of a degree per frame. 6 turns the plane once in 10 s at 30 frames:
    // here a step of STEP, however many frames are drawn.
    const SPEED = 6
    const ANGLE = -20
    const STEP = 1 / 30
    let acc = STEP

    function frame (bands) {
      line.set(height.subarray(0, GRID))
      for (let y = 0, row = (GRID - 2) * GRID; y < GRID; y++, row -= GRID) {
        const next = row + GRID
        if (y === GRID - 1) {
          for (let x = 0; x < GRID; x++) {
            const a = spectrum(bands, x, GRID)
            height[next + x] = a
            color[next + x] = map[Math.min(a >> 2, 63)]
            delta[next + x] = (a - line[x]) / 90
          }
        } else {
          for (let x = 0; x < GRID; x++) {
            let hgt = height[row + x] + delta[row + x]
            if (hgt < 0) hgt = 0
            height[next + x] = hgt
            delta[next + x] = delta[row + x] - 0.15 * (hgt / 255)
            color[next + x] = color[row + x]
          }
        }
      }
    }

    function plot (w, h) {
      px.fill(0xff000000)
      rotate(transform, 2, rotation)
      rotate(t2, 1, ANGLE)
      multiply(transform, t2)
      translate(t2, 0, -20, 400)
      multiply(transform, t2)
      const m = transform
      const zoom = Math.min(w * 440 / 640, h * 440 / 480)
      for (let y = 0; y < GRID; y++) {
        const start = (rotation < 90 || rotation > 270) ? GRID - y - 1 : y
        let step = 350 / GRID
        let cy = -(GRID * 0.5) * step
        const cx = (start - GRID * 0.5) * step
        let at = start * GRID
        let dir = 1
        if (rotation < 180) {
          dir = -1
          step = -step
          cy = -cy + step
          at += GRID - 1
        }
        for (let x = 0; x < GRID; x++) {
          const vy = 64 - height[at]
          const ox = cy * m[0] + vy * m[1] + cx * m[2] + m[3]
          const oy = cy * m[4] + vy * m[5] + cx * m[6] + m[7]
          const oz = cy * m[8] + vy * m[9] + cx * m[10] + m[11]
          if (oz > 1) {
            const z = zoom / oz
            const sx = Math.trunc(ox * z) + (w >> 1)
            const sy = Math.trunc(oy * z) + (h >> 1)
            if (sy >= 0 && sy < h && sx >= 0 && sx < w) {
              const c = color[at]
              px[sy * w + sx] = 0xff000000 | ((c & 255) << 16) | (c & 0xff00) | ((c >> 16) & 255)
            }
          }
          cy += step
          at += dir
        }
      }
    }

    return {
      draw (synth, dt) {
        const w = Math.max(1, canvas.width >> 1)
        const h = Math.max(1, canvas.height >> 1)
        if (!img || img.width !== w || img.height !== h) {
          buf.width = w
          buf.height = h
          img = bg.createImageData(w, h)
          px = new Uint32Array(img.data.buffer)
        }
        acc = Math.min(acc + dt, 0.2)
        if (acc < STEP) return
        while (acc >= STEP) {
          acc -= STEP
          frame(synth.bands)
          rotation += SPEED / 5
          if (rotation >= 360) rotation -= 360
          if (rotation < 0) rotation += 360
        }
        plot(w, h)
        bg.putImageData(img, 0, 0)
        g.imageSmoothingEnabled = false
        g.drawImage(buf, 0, 0, canvas.width, canvas.height)
      },

      // For the tests: the plane's turn, in degrees.
      probe () {
        return { rotation }
      }
    }
  }

  reg.superscope = superscope
  reg.dotplane = dotplane
})(window.VizCanvas)
