'use strict'
// Zoom mode (decision 0015): a camera that keeps pulling back, each
// scene turning out to be a detail of a larger one, R times its size: an
// atom is the heart of a snowflake, the snowflake the glint in an eye's
// pupil, the eye the eyespot of a peacock's fan, the fan a spot on a
// butterfly's wing, the butterfly a nebula in a galaxy, and the galaxy
// the nucleus of an atom, where the loop closes. Each scene has its
// surprise as it is revealed: the electrons light up, the snowflake
// grows, the eye blinks, the fan opens, the wings shimmer, a star goes
// supernova. The camera's depth z runs over [0, K) and every frame
// depends only on z, so the loop is seamless. The bass and the busy
// level speed the pull, a prompt surges it, an idle spell all but stops
// it, and each event leaves a ring on the scene in view, which recedes
// with it.

;(function (root) {
  const R = 4
  const TAU = Math.PI * 2
  const CLASS_HUE = [200, 120, 40, 0, 280, 320]

  function smooth (x) {
    const t = Math.max(0, Math.min(1, x))
    return t * t * (3 - 2 * t)
  }

  // A bump from 0 up to 1 and back over [a, b].
  function bump (x, a, b) {
    return x <= a || x >= b ? 0 : Math.sin(Math.PI * (x - a) / (b - a))
  }

  // A soft disc of colour rgb, opaque to 0.6, clear at 1.
  function backdrop (g, rgb) {
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, 1)
    grad.addColorStop(0, `rgba(${rgb}, 1)`)
    grad.addColorStop(0.6, `rgba(${rgb}, 1)`)
    grad.addColorStop(1, `rgba(${rgb}, 0)`)
    g.fillStyle = grad
    g.fillRect(-1, -1, 2, 2)
  }

  function glow (g, x, y, r, rgb, a) {
    const grad = g.createRadialGradient(x, y, 0, x, y, r)
    grad.addColorStop(0, `rgba(${rgb}, ${a})`)
    grad.addColorStop(1, `rgba(${rgb}, 0)`)
    g.fillStyle = grad
    g.fillRect(x - r, y - r, 2 * r, 2 * r)
  }

  // A fixed scatter of stars for the galaxy: two logarithmic arms.
  const STARS = (function () {
    let seed = 7
    const rnd = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    const out = []
    for (let k = 0; k < 520; k++) {
      const arm = k % 2
      const r = 0.06 + 0.9 * Math.pow(rnd(), 0.8)
      const th = arm * Math.PI + Math.log(r) / 0.32 + (rnd() - 0.5) * 0.9 * (1 - r * 0.4)
      out.push({ x: r * Math.cos(th), y: r * Math.sin(th) * 0.92, s: 0.004 + 0.008 * rnd(), c: r < 0.25 ? 0 : rnd() < 0.75 ? 1 : 2, ph: rnd() * TAU })
    }
    return out
  })()
  const STAR_RGB = ['255, 225, 170', '170, 200, 255', '255, 170, 200']

  // The scenes, innermost first. Each draws in a disc of radius 1 and
  // holds the scene before it at anchor, shrunk by R. under() draws
  // beneath that inner scene, over() above it. s: { t, u, p, hue }, the
  // time, the surprise's progress from 0 to 1 as the scene is revealed,
  // an event's pulse from 1 down to 0, and its hue.
  const SCENES = [
    {
      name: 'atom',
      anchor: [0, 0],
      under (g, s) {
        backdrop(g, '4, 6, 22')
        glow(g, 0, 0, 0.32, '255, 200, 140', 0.55)
      },
      over (g, s) {
        for (let i = 0; i < 3; i++) {
          g.save()
          g.rotate(i * Math.PI / 3)
          g.strokeStyle = `rgba(120, 200, 255, ${0.25 + 0.4 * s.u})`
          g.lineWidth = 0.012
          g.beginPath()
          g.ellipse(0, 0, 0.85, 0.28, 0, 0, TAU * (0.15 + 0.85 * s.u))
          g.stroke()
          const a = s.t * (1.4 + 0.3 * i) + i * 2
          const x = 0.85 * Math.cos(a)
          const y = 0.28 * Math.sin(a)
          const hot = s.p > 0 ? `hsla(${s.hue}, 100%, 70%, ` : 'rgba(150, 230, 255, '
          glow(g, x, y, 0.09 + 0.08 * s.p, '150, 230, 255', 0.5 + 0.5 * s.p)
          g.fillStyle = hot + '1)'
          g.beginPath()
          g.arc(x, y, 0.03, 0, TAU)
          g.fill()
          // A photon leaves an electron on an event.
          if (s.p > 0) {
            g.strokeStyle = hot + s.p + ')'
            g.lineWidth = 0.01
            g.beginPath()
            const len = 0.6 * (1 - s.p)
            for (let k = 0; k <= 30; k++) {
              const d = k / 30 * len
              const px = x + d * Math.cos(a)
              const py = y + d * Math.sin(a) + 0.025 * Math.sin(k * 1.3 - s.t * 20)
              if (k) g.lineTo(px, py)
              else g.moveTo(px, py)
            }
            g.stroke()
          }
          g.restore()
        }
      }
    },
    {
      name: 'snowflake',
      anchor: [0, 0],
      under (g, s) {
        backdrop(g, '6, 18, 48')
        const grow = 0.35 + 0.65 * smooth(s.u)
        g.strokeStyle = 'rgba(225, 245, 255, 0.95)'
        g.lineCap = 'round'
        for (let i = 0; i < 6; i++) {
          g.save()
          g.rotate(i * Math.PI / 3)
          g.lineWidth = 0.03
          g.beginPath()
          g.moveTo(0.2, 0)
          g.lineTo(0.2 + 0.72 * grow, 0)
          for (const at of [0.32, 0.47, 0.62, 0.77]) {
            if (at > 0.2 + 0.72 * grow) continue
            const len = Math.min(0.24 * (1.05 - at), 0.2 + 0.72 * grow - at)
            for (const sgn of [-1, 1]) {
              g.moveTo(at, 0)
              g.lineTo(at + len * 0.5, sgn * len * 0.866)
            }
          }
          g.stroke()
          g.restore()
        }
        g.lineWidth = 0.02
        g.beginPath()
        for (let i = 0; i <= 6; i++) {
          const a = i * Math.PI / 3
          if (i) g.lineTo(0.2 * Math.cos(a), 0.2 * Math.sin(a))
          else g.moveTo(0.2, 0)
        }
        g.stroke()
        // Tips glint on an event.
        if (s.p > 0) {
          g.fillStyle = `hsla(${s.hue}, 100%, 75%, ${s.p})`
          for (let i = 0; i < 6; i++) {
            const a = i * Math.PI / 3
            const r = 0.2 + 0.72 * grow
            g.fillRect(r * Math.cos(a) - 0.04 * s.p, r * Math.sin(a) - 0.005, 0.08 * s.p, 0.01)
            g.fillRect(r * Math.cos(a) - 0.005, r * Math.sin(a) - 0.04 * s.p, 0.01, 0.08 * s.p)
          }
        }
      }
    },
    {
      name: 'eye',
      anchor: [0, 0],
      under (g, s) {
        backdrop(g, '40, 22, 18')
        g.save()
        g.beginPath()
        this.lids(g, 1)
        g.clip()
        g.fillStyle = '#efe9e0'
        g.fillRect(-1, -1, 2, 2)
        const iris = g.createRadialGradient(0, 0, 0.22, 0, 0, 0.44)
        iris.addColorStop(0, s.p > 0 ? `hsl(${s.hue}, 70%, 45%)` : '#3f7f5a')
        iris.addColorStop(0.7, '#5a8a3a')
        iris.addColorStop(1, '#1c2a16')
        g.fillStyle = iris
        g.beginPath()
        g.arc(0, 0, 0.44, 0, TAU)
        g.fill()
        g.strokeStyle = 'rgba(230, 210, 120, 0.35)'
        g.lineWidth = 0.008
        g.beginPath()
        for (let k = 0; k < 48; k++) {
          const a = k / 48 * TAU
          g.moveTo(0.25 * Math.cos(a), 0.25 * Math.sin(a))
          g.lineTo(0.42 * Math.cos(a + 0.05), 0.42 * Math.sin(a + 0.05))
        }
        g.stroke()
        g.fillStyle = '#05060a'
        g.beginPath()
        g.arc(0, 0, 0.245, 0, TAU)
        g.fill()
        g.restore()
      },
      over (g, s) {
        // The lids: closed for a blink as the eye is revealed, and on an
        // event.
        const shut = Math.max(bump(s.u, 0.55, 0.85), bump(1 - s.p, 0, 0.5))
        if (shut > 0.01) {
          g.save()
          g.beginPath()
          g.rect(-1, -1, 2, 2)
          this.lids(g, 1 - shut)
          g.clip('evenodd')
          g.beginPath()
          this.lids(g, 1)
          g.fillStyle = '#8a5a44'
          g.fill()
          g.restore()
        }
        g.strokeStyle = '#2a1410'
        g.lineWidth = 0.025
        g.beginPath()
        this.lids(g, 1 - shut)
        g.stroke()
      },
      // The almond of the eye, open from 0 to 1, added to the path.
      lids (g, open) {
        const h = 0.62 * Math.max(0.02, open)
        g.moveTo(-0.95, 0)
        g.quadraticCurveTo(0, -1.3 * h, 0.95, 0)
        g.quadraticCurveTo(0, 1.3 * h, -0.95, 0)
        g.closePath()
      }
    },
    {
      name: 'peacock',
      anchor: [0, -0.05],
      under (g, s) {
        backdrop(g, '4, 26, 24')
        const spread = 0.12 + 0.88 * smooth(s.u)
        const n = 21
        for (let k = 0; k < n; k++) {
          const a = (k - (n - 1) / 2) / ((n - 1) / 2) * 1.35 * spread
          const len = 0.95 - 0.12 * Math.abs(a)
          g.save()
          g.translate(0, 0.9)
          g.rotate(a)
          g.strokeStyle = 'rgba(160, 190, 120, 0.6)'
          g.lineWidth = 0.008
          g.beginPath()
          g.moveTo(0, 0)
          g.lineTo(0, -len - 0.1)
          g.stroke()
          g.fillStyle = 'rgba(40, 120, 70, 0.55)'
          g.beginPath()
          g.ellipse(0, -len * 0.82, 0.075, len * 0.32, 0, 0, TAU)
          g.fill()
          if (k !== (n - 1) / 2) this.spot(g, 0, -len, 1, s)
          if (k % 2 === 0) this.spot(g, 0, -len * 0.6, 0.6, s)
          g.restore()
        }
      },
      // An eyespot at (x, y), scaled by k.
      spot (g, x, y, k, s) {
        const rings = [[0.11, 0.14, '#b08a2a'], [0.085, 0.11, '#2f9a5a'], [0.06, 0.08, s.p > 0 ? `hsl(${s.hue}, 80%, 50%)` : '#2a5ad0'], [0.035, 0.05, '#0a1640']]
        for (const [rx, ry, c] of rings) {
          g.fillStyle = c
          g.beginPath()
          g.ellipse(x, y, rx * k, ry * k, 0, 0, TAU)
          g.fill()
        }
      }
    },
    {
      name: 'butterfly',
      anchor: [-0.45, -0.3],
      under (g, s) {
        backdrop(g, '24, 14, 34')
        const shine = bump(s.u, 0.4, 1) + s.p
        for (const side of [-1, 1]) {
          g.save()
          g.scale(side, 1)
          // The fore wing, then the hind wing.
          g.fillStyle = `rgb(${150 + 60 * shine}, ${40 + 30 * shine}, 30)`
          g.beginPath()
          g.moveTo(-0.04, -0.12)
          g.bezierCurveTo(-0.3, -0.85, -0.9, -0.85, -0.95, -0.5)
          g.bezierCurveTo(-0.95, -0.1, -0.5, 0.05, -0.04, 0.02)
          g.fill()
          g.fillStyle = '#5a2418'
          g.beginPath()
          g.moveTo(-0.04, 0.02)
          g.bezierCurveTo(-0.6, 0.0, -0.75, 0.55, -0.45, 0.72)
          g.bezierCurveTo(-0.25, 0.8, -0.08, 0.5, -0.03, 0.15)
          g.fill()
          g.strokeStyle = 'rgba(20, 8, 6, 0.8)'
          g.lineWidth = 0.02
          g.beginPath()
          g.moveTo(-0.04, -0.12)
          g.bezierCurveTo(-0.3, -0.85, -0.9, -0.85, -0.95, -0.5)
          g.stroke()
          g.fillStyle = 'rgba(240, 230, 220, 0.8)'
          for (const [x, y] of [[-0.82, -0.62], [-0.88, -0.48], [-0.7, -0.7]]) g.fillRect(x, y, 0.03, 0.03)
          g.restore()
        }
        // The right wing's eyespot, the fan's twin in rings.
        for (const [r, c] of [[0.24, '#2a1a10'], [0.2, '#c08a3a'], [0.15, '#2f8a6a'], [0.09, '#3050c0'], [0.05, '#081028']]) {
          g.fillStyle = c
          g.beginPath()
          g.arc(0.45, -0.3, r, 0, TAU)
          g.fill()
        }
        g.fillStyle = '#1a0e0a'
        g.beginPath()
        g.ellipse(0, 0.05, 0.045, 0.42, 0, 0, TAU)
        g.fill()
        g.strokeStyle = '#1a0e0a'
        g.lineWidth = 0.015
        const wave = 0.05 * Math.sin(s.t * 3)
        g.beginPath()
        g.moveTo(-0.01, -0.35)
        g.quadraticCurveTo(-0.1, -0.6, -0.2 + wave, -0.75)
        g.moveTo(0.01, -0.35)
        g.quadraticCurveTo(0.1, -0.6, 0.2 - wave, -0.75)
        g.stroke()
      }
    },
    {
      name: 'galaxy',
      anchor: [0.42, 0.22],
      under (g, s) {
        backdrop(g, '1, 1, 6')
        glow(g, 0, 0, 0.45, '255, 220, 170', 0.7)
        glow(g, 0.42, 0.22, 0.3, '255, 120, 170', 0.35)
        for (let c = 0; c < 3; c++) {
          g.fillStyle = `rgba(${STAR_RGB[c]}, 0.9)`
          for (const st of STARS) {
            if (st.c !== c) continue
            const tw = 0.7 + 0.3 * Math.sin(s.t * 2 + st.ph)
            const z = st.s * tw
            g.fillRect(st.x - z / 2, st.y - z / 2, z, z)
          }
        }
        // A supernova as the galaxy is revealed, and on an event.
        const nova = Math.max(bump(s.u, 0.5, 1), s.p)
        if (nova > 0.01) {
          const [x, y] = [-0.38, -0.3]
          glow(g, x, y, 0.25 * nova, s.p > 0 ? '255, 255, 255' : '255, 240, 200', nova)
          g.fillStyle = `rgba(255, 255, 255, ${nova})`
          g.fillRect(x - 0.3 * nova, y - 0.004, 0.6 * nova, 0.008)
          g.fillRect(x - 0.004, y - 0.3 * nova, 0.008, 0.6 * nova)
        }
      }
    }
  ]
  const K = SCENES.length

  function create (canvas) {
    // Drawn on a canvas of the CPU, then blitted to the pane: under
    // swiftshader the pane's canvas rasterizes paths and gradients in
    // software GL, several times slower.
    const out = canvas.getContext('2d')
    const layer = document.createElement('canvas')
    const g = layer.getContext('2d', { willReadFrequently: true })
    const mark = {}
    let z = 0
    let surge = 0
    let pulse = 0
    let hue = 200
    let marks = []

    return {
      draw (synth, dt) {
        const w = canvas.width
        const h = canvas.height
        if (w < 4 || h < 4) return
        if (layer.width !== w || layer.height !== h) {
          layer.width = w
          layer.height = h
        }
        const L = synth.level
        const t = synth.t
        const n = Math.floor(z)
        const f = z - n
        for (const e of synth.since(mark)) {
          if (e.kind === 3) surge = 1
          hue = e.kind === 2 ? CLASS_HUE[e.cls] ?? 200 : e.kind === 3 ? 50 : e.kind === 5 ? 300 : 180
          pulse = 1
          // A ring on the scene in view.
          marks.push({ level: n, x: (Math.random() - 0.5) * 0.8, y: (Math.random() - 0.5) * 0.8, hue, t })
        }
        marks = marks.filter(m => t - m.t < 6)
        surge *= Math.exp(-dt / 2)
        pulse = Math.max(0, pulse - dt / 1.2)
        z += dt * (0.05 + 0.12 * Math.min(1, L.bass) + 0.1 * L.busy + 0.35 * surge) * (1 - 0.92 * L.idle)
        z %= K

        g.setTransform(1, 0, 0, 1, 0, 0)
        g.fillStyle = '#000'
        g.fillRect(0, 0, w, h)
        // Each level's scale and offset on the pane: n + 1 is the
        // reference, the camera easing from n's anchor in it to its
        // centre as f runs from 0 to 1.
        const base = 0.5 * Math.min(w, h) * 0.95
        const anchor = k => SCENES[((k % K) + K) % K].anchor
        const e = smooth(f)
        const S1 = base * Math.pow(R, 1 - f)
        const c = anchor(n + 1)
        const at = { [n + 1]: [S1, w / 2 - S1 * c[0] * (1 - e), h / 2 - S1 * c[1] * (1 - e)] }
        at[n + 2] = [S1 * R, at[n + 1][1] - S1 * R * anchor(n + 2)[0], at[n + 1][2] - S1 * R * anchor(n + 2)[1]]
        at[n] = [S1 / R, at[n + 1][1] + S1 * c[0], at[n + 1][2] + S1 * c[1]]
        const a0 = anchor(n)
        at[n - 1] = [S1 / R / R, at[n][1] + at[n][0] * a0[0], at[n][2] + at[n][0] * a0[1]]
        const alpha = { [n - 1]: 1 - f, [n]: 1, [n + 1]: 1, [n + 2]: f }
        const role = k => k - n
        const levels = [n + 2, n + 1, n, n - 1].filter(k => alpha[k] > 0.01 && at[k][0] > 2)
        const state = k => ({ t, u: role(k) <= 0 ? 1 : role(k) === 1 ? f : 0, p: role(k) === 0 ? pulse : 0, hue })
        const put = k => {
          const [S, x, y] = at[k]
          g.setTransform(S, 0, 0, S, x, y)
          g.globalAlpha = alpha[k]
        }
        for (const k of levels) {
          put(k)
          SCENES[((k % K) + K) % K].under(g, state(k))
        }
        for (const k of levels.slice().reverse()) {
          const sc = SCENES[((k % K) + K) % K]
          put(k)
          if (sc.over) sc.over(g, state(k))
          for (const m of marks) {
            if (((m.level - k) % K + K) % K !== 0) continue
            const age = (t - m.t) / 6
            g.strokeStyle = `hsla(${m.hue}, 100%, 65%, ${1 - age})`
            g.lineWidth = 0.012
            g.beginPath()
            g.arc(m.x, m.y, 0.04 + 0.3 * age, 0, TAU)
            g.stroke()
          }
        }
        g.globalAlpha = 1
        g.setTransform(1, 0, 0, 1, 0, 0)
        out.drawImage(layer, 0, 0)
      }
    }
  }

  if (typeof module === 'object' && module.exports) module.exports = { SCENES, R }
  else (root.VizCanvas = root.VizCanvas || {}).zoom = create
})(this)
