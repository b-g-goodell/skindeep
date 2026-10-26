'use strict'
// Gravity 3D mode (decision 0015): the Gravity mode's bodies in three
// dimensions, with black holes, seen through a perspective camera that
// turns about the heaviest hole, held at the pane's centre (anchor).
// G = 1 and c = C, so a hole of mass M has its Schwarzschild radius
// r_s = 2 M / C^2. A hole pulls by the
// Paczynski-Wiita potential -M / (r - r_+), r_+ its horizon, which puts
// the last stable circular orbit at 3 r_+, 3 r_s at rest, and a
// spinning (Kerr) hole,
// of spin a = chi M / C^2, drags what moves near it by the Lense-Thirring
// acceleration v x B, B = (2 M a / (C r^3)) (j - 3 (j . n) n), j its axis
// and n the direction from it. What crosses a horizon is swallowed, its
// mass and angular momentum the hole's. Other pairs attract as in the
// Gravity mode, softened. Nothing of a hole is painted: every pixel of
// the frame is a ray traced backward from the camera (trace.js), bent
// at each hole by the exact Schwarzschild deflection and captured within
// sqrt(27) / 2 r_s, through the scene drawn flat on slices of depth, the
// bodies, the dust and the flares, and the trails drawn where that rule
// shows them (trace.js curve), to the waves' ground and the distant
// stars. The shadow, the photon ring, arcs, Einstein
// rings, inner images and one hole seen through another all follow from
// that one rule. A spinning hole's shadow takes the edge of a Kerr
// hole's, shifted and flattened, and the session's activity spins the
// holes up (spin). What emits, the dust, the bodies and
// their trails, is drawn shifted by its Doppler factor relative to the
// view's centre, which carries the camera, and by the holes'
// gravitational shift, in hue (shift) and by its cube in brightness.
// The distant stars, the flares and the waves are not (emit). The
// bodies radiate gravitational waves (waves.js) at c, which carry
// energy away: every pair feels the 2.5PN radiation reaction, so a
// tight pair inspirals at Peters' rate, its waves chirping, until it
// merges. The seed's companion is such a pair,
// a star and a small hole. The signal and the pointer: see react and
// pointer.

;(function (root) {
  const CLASS_HUE = [200, 120, 40, 0, 280, 320]
  const SOFT = 9
  const H = 0.25
  const MAX_BODIES = 28
  const MAX_DUST = 700
  const VIEW = 240
  // The speed of light: a hole of mass 900 has r_s 13.6, on screen.
  const C = 11.5
  const C2 = C * C
  // Spin at most this fraction of the extreme M / C^2, the horizon at
  // least 0.66 r_s.
  const CHI_MAX = 0.95
  // The session spins its holes (decision 0015, issue #173): a hole's
  // own spin chi0, which the seed (0.35), a subagent's hole (0.15 to
  // 0.45) and a swallowing set, is its spin at idle, and the session's
  // activity, eased over TAU s (spinStep), spins it up toward CHI_MAX
  // (spin). The horizon, the last stable orbit, the Lense-Thirring drag
  // and the shadow all read the spin so set, chi, and nothing
  // exaggerates it.
  const TAU = 3
  const HOLE_MAX = 1500
  // A dust grain's mass, and the disc's viscosity: between the last
  // stable orbit, 3 r_+, and DISC r_s of a hole a grain's velocity
  // relaxes at rate VISC toward a circular orbit's, a little slower, so
  // the disc's grains settle on circles and spiral in, and plunge from
  // the last stable orbit.
  const DUST_M = 0.004
  const VISC = 0.01
  const SLOW = 0.995
  const DISC = 10
  // The capture radius over r_s: a ray of smaller impact parameter falls in.
  const RING = Math.sqrt(27) / 2
  const W = typeof module === 'object' && module.exports ? require('./waves') : root.VizWaves
  const T3 = typeof module === 'object' && module.exports ? require('./trace') : root.VizTrace
  // The camera's first height, on which the sky's bright stars lie.
  const PITCH = 0.36
  // The trace: at most PANE pixels a pane, or WINDOW = 3 PANE pixels a
  // window when a pane fills more of it, PANE the setting Gravity 3D
  // sharpness (env.trace) or this default, its lens map's nodes STEP
  // pixels apart, SUB slices behind the nearest hole, and the sky's cube
  // faces at most CUBE pixels square.
  const PANE = 30000
  const STEP = 6
  const SUB = 8
  const CUBE = 1024
  // The seed's companion: a star of PAIR_STAR and a hole of PAIR_HOLE at
  // PAIR_SEP, PAIR_R from the hole.
  const PAIR_STAR = 50
  const PAIR_HOLE = 30
  const PAIR_SEP = 16
  const PAIR_R = 175

  // The Doppler shift (decision 0015, 2026-10-18): speeds at most BETA
  // C, and the dust's shift in steps of QLN in ln g.
  const BETA = 0.99
  const QLN = 0.02

  // The colour rule's spectrum: the CSS hue of each spectral colour from
  // LAM_BLUE to LAM_RED nm, every DLAM, mixed with white into sRGB, by
  // the multi-lobe fit of the CIE 1931 colour matching functions (Wyman,
  // Sloan and Shirley 2013, JCGT 2(2), eq. 4). Its hue falls as lambda
  // grows over this range, past 0 near 611 nm, so it is kept unwrapped,
  // from HUE_BLUE down to HUE_RED, below 0.
  const LAM_BLUE = 440
  const LAM_RED = 640
  const DLAM = 0.25
  const SPEC = (() => {
    const lobe = (x, m, t1, t2) => {
      const t = x < m ? t1 : t2
      return Math.exp(-0.5 * t * t * (x - m) * (x - m))
    }
    const enc = c => c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
    const n = Math.round((LAM_RED - LAM_BLUE) / DLAM)
    const out = new Float64Array(n + 1)
    for (let i = 0; i <= n; i++) {
      const l = LAM_BLUE + i * DLAM
      const X = 1.056 * lobe(l, 599.8, 0.0264, 0.0323) + 0.362 * lobe(l, 442.0, 0.0624, 0.0374) - 0.065 * lobe(l, 501.1, 0.0490, 0.0382)
      const Y = 0.821 * lobe(l, 568.8, 0.0213, 0.0247) + 0.286 * lobe(l, 530.9, 0.0613, 0.0322)
      const Z = 1.217 * lobe(l, 437.0, 0.0845, 0.0278) + 0.681 * lobe(l, 459.0, 0.0385, 0.0725)
      // Linear sRGB (IEC 61966-2-1), white added until none is negative,
      // which keeps the dominant wavelength, then encoded.
      let r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z
      let g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z
      let b = 0.0557 * X - 0.2040 * Y + 1.0570 * Z
      const w = Math.min(r, g, b, 0)
      const top = Math.max(r, g, b) - w
      r = enc((r - w) / top)
      g = enc((g - w) / top)
      b = enc((b - w) / top)
      const mx = Math.max(r, g, b)
      const d = mx - Math.min(r, g, b)
      const h = 60 * (mx === r ? (g - b) / d : mx === g ? (b - r) / d + 2 : (r - g) / d + 4)
      out[i] = h > 300 ? h - 360 : h
    }
    return out
  })()
  const HUE_BLUE = SPEC[0]
  const HUE_RED = SPEC[SPEC.length - 1]

  // The hue of light of wavelength l nm, unwrapped, l in the range.
  function spectral (l) {
    const x = (l - LAM_BLUE) / DLAM
    const i = Math.min(SPEC.length - 2, Math.max(0, Math.floor(x)))
    return SPEC[i] + (SPEC[i + 1] - SPEC[i]) * (x - i)
  }

  // The nominal wavelength of unwrapped hue u, from HUE_RED to HUE_BLUE:
  // the spectral colour of that hue.
  function wavelength (u) {
    let lo = 0
    let hi = SPEC.length - 1
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1
      if (SPEC[m] > u) lo = m
      else hi = m
    }
    return LAM_BLUE + DLAM * (lo + (SPEC[lo] - u) / (SPEC[lo] - SPEC[hi]))
  }

  const rs = m => 2 * m / C2
  // Math.hypot is several times slower.
  const len = (x, y, z = 0) => Math.sqrt(x * x + y * y + z * z)

  // The Doppler factor of an emitter moving at (vx, vy, vz) relative to
  // the camera, (nx, ny, nz) the unit vector from it toward the camera:
  // D = 1 / (gamma (1 - beta cos theta)), beta = v / C, at most BETA.
  function doppler (vx, vy, vz, nx, ny, nz) {
    let b2 = (vx * vx + vy * vy + vz * vz) / C2
    let bn = (vx * nx + vy * ny + vz * nz) / C
    if (b2 > BETA * BETA) {
      bn *= BETA / Math.sqrt(b2)
      b2 = BETA * BETA
    }
    return Math.sqrt(1 - b2) / (1 - bn)
  }

  // The gravitational shift of light from (x, y, z) to a distant camera:
  // over the holes { b, s } (s = r_s), the product of sqrt(1 - r_s / r),
  // 0 within r_s.
  function lapse (holes, x, y, z) {
    let g = 1
    for (const o of holes) {
      const r = len(x - o.b.x, y - o.b.y, z - o.b.z)
      g *= r > o.s ? Math.sqrt(1 - o.s / r) : 0
    }
    return g
  }

  // The colour rule: the hue seen of an emitter of hue whose light is
  // shifted by g, lambda_obs = lambda_em / g. A spectral hue has the
  // nominal wavelength of the spectral colour of that hue (wavelength),
  // shifted and clamped to LAM_BLUE and LAM_RED, the range's ends, and
  // seen as that wavelength's hue (spectral): toward HUE_BLUE, violet,
  // for g > 1, toward HUE_RED for g < 1. A purple, between HUE_BLUE and
  // HUE_RED + 360, mixes the two ends: it moves along its own arc by
  // the part ln g / ln(LAM_RED / LAM_BLUE) of it, toward the same ends.
  function shift (hue, g) {
    const h = ((hue % 360) + 360) % 360
    const u = h > HUE_BLUE ? h - 360 : h
    if (u >= HUE_RED) return (spectral(Math.max(LAM_BLUE, Math.min(LAM_RED, wavelength(u) / g))) + 360) % 360
    const arc = 360 + HUE_RED - HUE_BLUE
    const x = Math.max(0, Math.min(1, (360 + HUE_RED - h) / arc + Math.log(g) / Math.log(LAM_RED / LAM_BLUE)))
    return (360 + HUE_RED - x * arc) % 360
  }

  // The session's activity, 0 to 1, from its levels (synth.js): the
  // strongest of the output, busy and the tokens' rate, none at idle.
  function activity (L) {
    return Math.min(1, Math.max(Math.min(1, L.bass), L.busy, L.treble)) * (1 - L.idle)
  }

  // The share s of the way from a hole's own spin to CHI_MAX after dt s
  // of activity a: it moves toward a by 1 - exp(-dt / TAU) of the gap,
  // so by at most 1 / TAU a second and never past a.
  function spinStep (s, a, dt) {
    return s + (a - s) * (1 - Math.exp(-Math.max(0, dt) / TAU))
  }

  // A hole's own spin: chi0, or chi for a hole that has none.
  function own (h) {
    return h.chi0 === undefined ? (h.chi || 0) : h.chi0
  }

  // Hole h spun up by share s: chi = chi0 + (CHI_MAX - chi0) s, its
  // horizon moved with it.
  function spin (h, s) {
    const c = own(h)
    h.up = s
    h.chi = c + (CHI_MAX - c) * Math.max(0, Math.min(1, s))
    h.r = horizon(h)
    return h
  }

  // The outer horizon of hole h: r_+ = M / C^2 + sqrt((M / C^2)^2 - a^2).
  function horizon (h) {
    const g = h.m / C2
    const a = (h.chi || 0) * g
    return g + Math.sqrt(g * g - a * a)
  }

  // The speed of a circular orbit at distance r about body s.
  function circular (s, r) {
    return s.hole ? Math.sqrt(s.m * r) / (r - horizon(s)) : Math.sqrt(s.m / r)
  }

  // The Lense-Thirring acceleration of what is at r from spinning hole h,
  // moving at v relative to it, into out.
  function drag (h, rx, ry, rz, vx, vy, vz, out) {
    const d2 = rx * rx + ry * ry + rz * rz
    const d = Math.sqrt(d2)
    const k = 2 * h.m * (h.chi * h.m / C2) / (C * d2 * d)
    const jn = (h.jx * rx + h.jy * ry + h.jz * rz) / d2
    const bx = k * (h.jx - 3 * jn * rx)
    const by = k * (h.jy - 3 * jn * ry)
    const bz = k * (h.jz - 3 * jn * rz)
    out[0] = vy * bz - vz * by
    out[1] = vz * bx - vx * bz
    out[2] = vx * by - vy * bx
  }

  const lt = [0, 0, 0]

  // Radiation reaction on the pair a, b: the 2.5PN relative acceleration
  // in the Burke-Thorne gauge (Iyer and Will 1995, alpha = -1, beta = 0),
  //   8/5 eta M^2 / (c^5 r^3) [(3 v^2 + 17/3 M / r) rdot n - (v^2 + 3 M / r) v],
  // M = m_a + m_b, eta = m_a m_b / M^2, r = x_a - x_b and v its rate,
  // split by mass so momentum holds. On a circular orbit it takes
  // 32/5 eta^2 M^5 / (c^5 r^5) of energy a unit of time, Peters' rate,
  // so r shrinks at 64/5 m_a m_b M / (c^5 r^3). At most a tenth of the
  // Newtonian pull, which a Paczynski-Wiita plunge would pass.
  function reaction (a, b) {
    const M = a.m + b.m
    const rx = a.x - b.x
    const ry = a.y - b.y
    const rz = a.z - b.z
    const vx = a.vx - b.vx
    const vy = a.vy - b.vy
    const vz = a.vz - b.vz
    const r2 = rx * rx + ry * ry + rz * rz
    const r = Math.sqrt(r2)
    if (r < 1e-6) return
    const v2 = vx * vx + vy * vy + vz * vz
    const rd = (rx * vx + ry * vy + rz * vz) / r
    const g = M / r
    let k = 1.6 * (a.m * b.m / (M * M)) * M * M / (C2 * C2 * C * r2 * r)
    const A = k * (3 * v2 + 17 / 3 * g) * rd / r
    const B = k * (v2 + 3 * g)
    let ax = A * rx - B * vx
    let ay = A * ry - B * vy
    let az = A * rz - B * vz
    const most = 0.1 * M / r2
    const l = len(ax, ay, az)
    if (l > most) {
      k = most / l
      ax *= k
      ay *= k
      az *= k
    }
    a.ax += ax * b.m / M
    a.ay += ay * b.m / M
    a.az += az * b.m / M
    b.ax -= ax * a.m / M
    b.ay -= ay * a.m / M
    b.az -= az * a.m / M
  }

  // The accelerations, and in (ex, ey, ez) the part of each that the
  // Paczynski-Wiita pull adds within r_+ of a horizon, where it grows
  // without bound: the waves leave it out (waves.js), so a fall's burst
  // is bounded as in general relativity, near mu c^2 in Iddot.
  function accel (bodies) {
    for (const a of bodies) {
      a.ax = 0
      a.ay = 0
      a.az = 0
      a.ex = 0
      a.ey = 0
      a.ez = 0
    }
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i]
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dz = b.z - a.z
        let f
        if (a.hole || b.hole) {
          // Paczynski-Wiita, about the larger horizon of the pair.
          const s = Math.max(a.hole ? horizon(a) : 0, b.hole ? horizon(b) : 0)
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
          const gap = Math.max(d - s, 0.02 * s)
          f = 1 / (gap * gap * d)
          const e = f - 1 / (Math.max(gap, s) ** 2 * d)
          if (e) {
            a.ex += dx * e * b.m
            a.ey += dy * e * b.m
            a.ez += dz * e * b.m
            b.ex -= dx * e * a.m
            b.ey -= dy * e * a.m
            b.ez -= dz * e * a.m
          }
        } else {
          const d2 = dx * dx + dy * dy + dz * dz + SOFT
          f = 1 / (d2 * Math.sqrt(d2))
        }
        a.ax += dx * f * b.m
        a.ay += dy * f * b.m
        a.az += dz * f * b.m
        b.ax -= dx * f * a.m
        b.ay -= dy * f * a.m
        b.az -= dz * f * a.m
        reaction(a, b)
      }
    }
    for (const h of bodies) {
      if (!h.hole || !h.chi) continue
      for (const b of bodies) {
        if (b === h) continue
        drag(h, b.x - h.x, b.y - h.y, b.z - h.z, b.vx - h.vx, b.vy - h.vy, b.vz - h.vz, lt)
        b.ax += lt[0]
        b.ay += lt[1]
        b.az += lt[2]
        h.ax -= lt[0] * b.m / h.m
        h.ay -= lt[1] * b.m / h.m
        h.az -= lt[2] * b.m / h.m
      }
    }
  }

  function leap (bodies, h) {
    accel(bodies)
    for (const b of bodies) {
      b.vx += b.ax * h / 2
      b.vy += b.ay * h / 2
      b.vz += b.az * h / 2
      b.x += b.vx * h
      b.y += b.vy * h
      b.z += b.vz * h
    }
    accel(bodies)
    for (const b of bodies) {
      b.vx += b.ax * h / 2
      b.vy += b.ay * h / 2
      b.vz += b.az * h / 2
    }
  }

  // The longest safe substep: near a hole, a small part of the gap to
  // its horizon over the speed across it.
  function limit (bodies) {
    let hm = Infinity
    for (const h of bodies) {
      if (!h.hole) continue
      const s = horizon(h)
      for (const b of bodies) {
        if (b === h) continue
        const gap = Math.max(1e-6, len(b.x - h.x, b.y - h.y, b.z - h.z) - s - (b.hole ? horizon(b) : 0))
        const v = len(b.vx - h.vx, b.vy - h.vy, b.vz - h.vz)
        hm = Math.min(hm, 0.03 * gap / (v + 1e-9), 0.05 * gap * Math.sqrt(gap / h.m))
      }
    }
    return hm
  }

  // Hole h swallows b: mass, momentum and angular momentum kept, the
  // spin capped below the extreme. The angular momentum is that of the
  // holes' own spins (chi0), so the session's spin-up leaves none behind,
  // and the hole stays spun up by the same share.
  function absorb (h, b) {
    const m = h.m + b.m
    const mu = h.m * b.m / m
    const rx = b.x - h.x
    const ry = b.y - h.y
    const rz = b.z - h.z
    const vx = b.vx - h.vx
    const vy = b.vy - h.vy
    const vz = b.vz - h.vz
    const sh = own(h) * h.m * h.m / C
    const sb = b.hole ? own(b) * b.m * b.m / C : 0
    const jx = sh * h.jx + sb * (b.jx || 0) + mu * (ry * vz - rz * vy)
    const jy = sh * h.jy + sb * (b.jy || 0) + mu * (rz * vx - rx * vz)
    const jz = sh * h.jz + sb * (b.jz || 0) + mu * (rx * vy - ry * vx)
    const J = len(jx, jy, jz)
    h.x = (h.x * h.m + b.x * b.m) / m
    h.y = (h.y * h.m + b.y * b.m) / m
    h.z = (h.z * h.m + b.z * b.m) / m
    h.vx = (h.vx * h.m + b.vx * b.m) / m
    h.vy = (h.vy * h.m + b.vy * b.m) / m
    h.vz = (h.vz * h.m + b.vz * b.m) / m
    h.m = m
    if (J > 0) {
      h.chi0 = Math.min(CHI_MAX, J * C / (m * m))
      h.jx = jx / J
      h.jy = jy / J
      h.jz = jz / J
      spin(h, h.up || 0)
    }
    h.r = horizon(h)
  }

  // The least distance between a and b over the last substep hs, their
  // relative motion taken as straight: a fall that crossed a horizon
  // within one substep is caught.
  function least (a, b, hs) {
    const rx = a.x - b.x
    const ry = a.y - b.y
    const rz = a.z - b.z
    const vx = a.vx - b.vx
    const vy = a.vy - b.vy
    const vz = a.vz - b.vz
    const v2 = vx * vx + vy * vy + vz * vz
    const s = v2 > 0 ? Math.max(0, Math.min(hs, (rx * vx + ry * vy + rz * vz) / v2)) : 0
    return len(rx - vx * s, ry - vy * s, rz - vz * s)
  }

  // Swallowings, then mergers of bodies that touch, as in the Gravity
  // mode. Each is pushed to its list.
  function collide (bodies, merged, swallowed, hs = 0) {
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        let a = bodies[i]
        let b = bodies[j]
        const d = len(a.x - b.x, a.y - b.y, a.z - b.z)
        if (a.hole || b.hole) {
          if (b.hole && (!a.hole || b.m > a.m)) [a, b] = [b, a]
          if (least(a, b, hs) > horizon(a) + (b.hole ? horizon(b) : 0)) continue
          absorb(a, b)
          bodies[i] = a
          swallowed.push({ x: a.x, y: a.y, z: a.z, m: b.m, hole: a })
        } else {
          if (d > a.r + b.r) continue
          const m = a.m + b.m
          const big = a.m >= b.m ? a : b
          for (const k of ['x', 'y', 'z', 'vx', 'vy', 'vz']) a[k] = (a[k] * a.m + b[k] * b.m) / m
          a.hue = big.hue
          a.star = a.star || b.star
          a.comet = big.comet
          // The trail of the larger, whose colour the body keeps, or none
          // for a star, which keeps none: a trail left on a star stood
          // still while the star moved on, and was drawn to it straight.
          if (a.trail) {
            a.trail = a.star ? [] : big.trail
            a.tv = a.star ? [] : big.tv
            a.tt = big.tt
          }
          merged.push({ x: a.x, y: a.y, z: a.z, m: Math.min(a.m, b.m) })
          a.m = m
          a.r = radius(m, a.star)
        }
        bodies.splice(j, 1)
        j = i
      }
    }
  }

  // Step bodies { x, y, z, vx, vy, vz, m, r, hole, chi, jx, jy, jz } by
  // h, in leapfrog substeps short enough near a horizon. Returns the
  // mergers and the swallowings.
  function step (bodies, h) {
    const merged = []
    const swallowed = []
    let t = 0
    while (t < h) {
      const hs = Math.min(h - t, Math.max(h / 256, limit(bodies)))
      leap(bodies, hs)
      collide(bodies, merged, swallowed, hs)
      t += hs
    }
    return { merged, swallowed }
  }

  // A place of body b's trail at time clock, if it is due: one every
  // TRAIL_DT units of time, or TRAIL_D of travel, the last TRAIL_N kept,
  // each with the velocity there relative to c, the view's centre, which
  // its light is shifted by. Called after every step, not every frame: a
  // frame may advance up to 60 steps, and a place a frame drew a fast
  // body's path as chords of a frame's travel, a trail turning sharp
  // corners. A hole and a star keep none. True if a place was kept.
  const TRAIL_DT = 1.5
  const TRAIL_D = 4
  const TRAIL_N = 64
  const REST = { vx: 0, vy: 0, vz: 0 }
  function track (b, clock, c) {
    if (b.hole || b.star) return false
    const tr = b.trail
    const k = tr.length - 3
    if (k >= 0 && clock - b.tt < TRAIL_DT && (b.x - tr[k]) ** 2 + (b.y - tr[k + 1]) ** 2 + (b.z - tr[k + 2]) ** 2 < TRAIL_D * TRAIL_D) return false
    b.tt = clock
    tr.push(b.x, b.y, b.z)
    b.tv.push(b.vx - c.vx, b.vy - c.vy, b.vz - c.vz)
    if (tr.length > 3 * TRAIL_N) tr.splice(0, 3)
    if (b.tv.length > tr.length) b.tv.splice(0, b.tv.length - tr.length)
    return true
  }

  function radius (m, star) {
    return star ? 4 + 1.1 * Math.cbrt(m) : 1.2 + 1.3 * Math.cbrt(m)
  }

  // Dust falls in the bodies' field and is dragged by spinning holes,
  // each grain in substeps short enough near a horizon. A grain that
  // crosses a horizon is swallowed, one inside another body joins it.
  // Returns the grains each hole swallowed, as a Map.
  function fall (dust, bodies, h) {
    const holes = bodies.filter(b => b.hole)
    const eaten = new Map()
    const r2 = holes.map(horizon)
    const disc = holes.map(b => DISC * rs(b.m))
    // The last stable orbit, 3 r_+ in this potential, which the spin moves.
    const isco = r2.map(r => 3 * r)
    const hz = bodies.map(b => b.hole ? horizon(b) : 0)
    for (const d of dust) {
      let n = 1
      for (let i = 0; i < holes.length; i++) {
        const o = holes[i]
        const gap = Math.max(1e-3, len(d.x - o.x, d.y - o.y, d.z - o.z) - r2[i])
        const v = len(d.vx - o.vx, d.vy - o.vy, d.vz - o.vz)
        n = Math.max(n, Math.ceil(h * v / (0.08 * gap)))
      }
      n = Math.min(n, 12)
      const hs = h / n
      for (let k = 0; k < n && !d.gone; k++) {
        let ax = 0
        let ay = 0
        let az = 0
        for (let bi = 0; bi < bodies.length; bi++) {
          const b = bodies[bi]
          const dx = b.x - d.x
          const dy = b.y - d.y
          const dz = b.z - d.z
          let f
          if (b.hole) {
            const r = Math.sqrt(dx * dx + dy * dy + dz * dz)
            const gap = Math.max(r - hz[bi], 0.02 * hz[bi])
            f = b.m / (gap * gap * r)
          } else {
            const d2 = dx * dx + dy * dy + dz * dz + SOFT
            f = b.m / (d2 * Math.sqrt(d2))
          }
          ax += dx * f
          ay += dy * f
          az += dz * f
        }
        d.vx += ax * hs
        d.vy += ay * hs
        d.vz += az * hs
        for (let i = 0; i < holes.length; i++) {
          const o = holes[i]
          const rx = d.x - o.x
          const ry = d.y - o.y
          const rz = d.z - o.z
          if (o.chi) {
            drag(o, rx, ry, rz, d.vx - o.vx, d.vy - o.vy, d.vz - o.vz, lt)
            d.vx += lt[0] * hs
            d.vy += lt[1] * hs
            d.vz += lt[2] * hs
          }
          const r = Math.sqrt(rx * rx + ry * ry + rz * rz)
          if (r < disc[i] && r > isco[i]) {
            // The circular velocity in the plane of the grain's orbit.
            const vx = d.vx - o.vx
            const vy = d.vy - o.vy
            const vz = d.vz - o.vz
            const lx = ry * vz - rz * vy
            const ly = rz * vx - rx * vz
            const lz = rx * vy - ry * vx
            const tx = ly * rz - lz * ry
            const ty = lz * rx - lx * rz
            const tz = lx * ry - ly * rx
            const tl = len(tx, ty, tz)
            if (tl > 0) {
              const c = circular(o, r) * SLOW / tl
              const k = Math.min(1, VISC * hs)
              d.vx += (tx * c - vx) * k
              d.vy += (ty * c - vy) * k
              d.vz += (tz * c - vz) * k
            }
          }
        }
        d.x += d.vx * hs
        d.y += d.vy * hs
        d.z += d.vz * hs
        for (let i = 0; i < holes.length; i++) {
          const o = holes[i]
          if ((d.x - o.x) ** 2 + (d.y - o.y) ** 2 + (d.z - o.z) ** 2 > r2[i] * r2[i]) continue
          for (const key of ['vx', 'vy', 'vz']) o[key] = (o[key] * o.m + d[key] * DUST_M) / (o.m + DUST_M)
          o.m += DUST_M
          d.gone = true
          eaten.set(o, (eaten.get(o) || 0) + 1)
          break
        }
      }
    }
    return eaten
  }

  // Total momentum to zero and the centre of mass to the origin, the
  // dust and the trails moved with the bodies. Returns the shift.
  function centre (bodies, dust = []) {
    let m = 0
    const p = [0, 0, 0]
    const q = [0, 0, 0]
    for (const b of bodies) {
      m += b.m
      p[0] += b.m * b.vx
      p[1] += b.m * b.vy
      p[2] += b.m * b.vz
      q[0] += b.m * b.x
      q[1] += b.m * b.y
      q[2] += b.m * b.z
    }
    if (!m) return [0, 0, 0]
    for (const o of [...bodies, ...dust]) {
      o.vx -= p[0] / m
      o.vy -= p[1] / m
      o.vz -= p[2] / m
      o.x -= q[0] / m
      o.y -= q[1] / m
      o.z -= q[2] / m
      if (!o.trail) continue
      for (let i = 0; i < o.trail.length; i += 3) {
        o.trail[i] -= q[0] / m
        o.trail[i + 1] -= q[1] / m
        o.trail[i + 2] -= q[2] / m
      }
    }
    return [-q[0] / m, -q[1] / m, -q[2] / m]
  }

  // The view's centre (decision 0015, 2026-10-18): the heaviest hole, or
  // null when there is none and the view takes the origin, where centre
  // puts the centre of mass. Only the camera follows it: the bodies
  // still move about their centre of mass.
  function anchor (bodies) {
    let a = null
    for (const b of bodies) if (b.hole && (!a || b.m > a.m)) a = b
    return a
  }

  // Camera V for a pane w by h, at turn yaw about the vertical and height
  // pitch, in radians, about the place o: its basis (right r, up u,
  // toward the camera e), its centre on screen and its focal length.
  function aim (V, yaw, pitch, w, h, o) {
    const cy = Math.cos(yaw)
    const sy = Math.sin(yaw)
    const cp = Math.cos(pitch)
    const sp = Math.sin(pitch)
    V.o = o
    V.e = [cp * cy, cp * sy, sp]
    V.r = [-sy, cy, 0]
    V.u = [-sp * cy, -sp * sy, cp]
    V.cx = w / 2
    V.cy = h / 2
    V.f = Math.min(w, h) / 2 / Math.tan(0.42)
  }

  // A point of the world in camera V's frame, into out: right, up and
  // depth along the view, the camera V.D from V.o. The trace reads the
  // holes so.
  function frameOf (V, x, y, z, out) {
    x -= V.o[0]
    y -= V.o[1]
    z -= V.o[2]
    out[0] = x * V.r[0] + y * V.r[1] + z * V.r[2]
    out[1] = x * V.u[0] + y * V.u[1] + z * V.u[2]
    out[2] = V.D - (x * V.e[0] + y * V.e[1] + z * V.e[2])
    return out
  }

  // A point of the world into P by camera V: its place on screen, its
  // depth along the view and its scale.
  function place (V, P, x, y, z) {
    x -= V.o[0]
    y -= V.o[1]
    z -= V.o[2]
    const X = x * V.r[0] + y * V.r[1]
    const Y = x * V.u[0] + y * V.u[1] + z * V.u[2]
    const d = Math.max(1, V.D - (x * V.e[0] + y * V.e[1] + z * V.e[2]))
    P.k = V.f / d
    P.x = V.cx + X * P.k
    P.y = V.cy - Y * P.k
    P.d = d
  }

  // A seeded generator, so every pane shows the same sky.
  function rng (s) {
    return () => {
      s = (s + 0x6d2b79f5) | 0
      let t = Math.imul(s ^ (s >>> 15), 1 | s)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  // Two unit vectors normal to unit n and to each other.
  function basis (n) {
    const a = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]
    const u = [n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0]]
    const l = len(...u)
    u[0] /= l
    u[1] /= l
    u[2] /= l
    return [u, [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]]]
  }

  // The distant stars: directions only, so they turn with the camera and
  // show no parallax. Most lie anywhere, some in a band about a great
  // circle, a galaxy's disc seen from inside, its glow a haze of soft
  // dots brightest toward one point, and a few bright ones on the circle
  // the camera's line of sight through the centre sweeps at its first
  // pitch, so a hole there lines up with one now and then.
  function sky (pitch) {
    const r = rng(83)
    const gauss = () => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r())
    const band = [0.35, -0.42, 0.84].map(v => v / len(0.35, -0.42, 0.84))
    const [e1, e2] = basis(band)
    const onBand = (t, lat) => e1.map((v, i) => Math.cos(lat) * (Math.cos(t) * v + Math.sin(t) * e2[i]) + Math.sin(lat) * band[i])
    const stars = []
    const hues = [210, 220, 230, 200, 40, 48, 15, 120, 280, 320]
    for (let k = 0; k < 3000; k++) {
      let n
      if (k < 2000) {
        const z = 2 * r() - 1
        const a = 2 * Math.PI * r()
        n = [Math.sqrt(1 - z * z) * Math.cos(a), Math.sqrt(1 - z * z) * Math.sin(a), z]
      } else n = onBand(2 * Math.PI * r(), 0.06 * gauss())
      const b = Math.pow(r(), 3)
      stars.push({ n, b: 0.2 + 0.8 * b, size: b > 0.6 ? 2 : b > 0.2 ? 1.5 : 1, hue: hues[Math.floor(r() * hues.length)], sat: 30 + 40 * r() })
    }
    for (let k = 0; k < 6; k++) {
      const a = 2 * Math.PI * (k + r() * 0.5) / 6
      const z = -Math.sin(pitch) + 0.01 * gauss()
      const c = Math.sqrt(1 - z * z)
      stars.push({ n: [-c * Math.cos(a), -c * Math.sin(a), z], b: 1, size: 2, hue: hues[k], sat: 60 })
    }
    const haze = []
    for (let k = 0; k < 120; k++) {
      const t = 2 * Math.PI * r()
      const core = Math.exp(-((Math.atan2(Math.sin(t - 1), Math.cos(t - 1))) ** 2) / 0.5)
      haze.push({ n: onBand(t, 0.035 * gauss()), a: 0.035 + 0.07 * core * r(), size: 0.05 + 0.05 * r(), warm: r() < 0.2 + 0.6 * core })
    }
    return { stars, haze }
  }

  // A sprite of a soft dot, white at its centre, in hue.
  function sprite (hue) {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    // On the CPU, as the layer it is drawn on: a sprite on the GPU is
    // read back at every draw.
    const g = c.getContext('2d', { willReadFrequently: true })
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, `hsla(${hue}, 60%, 75%, 1)`)
    grad.addColorStop(0.4, `hsla(${hue}, 60%, 55%, 0.35)`)
    grad.addColorStop(1, `hsla(${hue}, 60%, 40%, 0)`)
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
    return c
  }

  // Heat from a fall: 0 far out, 1 at the last stable orbit and within.
  // The colour of a grain or a body as it heats: toward orange that
  // whitens, then a blue white.
  function hot (hue, sat, light, heat) {
    if (heat <= 0.02) return [hue, sat, light]
    if (heat < 0.7) {
      const t = heat / 0.7
      const dh = ((30 - hue + 540) % 360) - 180
      return [(hue + dh * Math.min(1, 2 * t) + 360) % 360, sat + (95 - sat) * t * (1 - t) * 2, light + (88 - light) * t]
    }
    const t = (heat - 0.7) / 0.3
    return [215, 70 * t, 88 + 8 * t]
  }

  // Where unit n falls on face fi of a cube of directions, each of its
  // two coordinates in [-1, 1], as the trace reads it (trace.js:
  // skyPlace), or null if it points away from it.
  function onFace (fi, n) {
    const ax = fi >> 1
    const c = n[ax] * (fi & 1 ? -1 : 1)
    if (c <= 0.2) return null
    return ax === 0 ? [n[1] / c, n[2] / c] : ax === 1 ? [n[0] / c, n[2] / c] : [n[0] / c, n[1] / c]
  }

  // A face's pixels a radian at place p over those at its centre: the
  // geometric mean of the radial (1 + a^2 + b^2) and the tangential
  // sqrt(1 + a^2 + b^2) stretch of the gnomonic map.
  function stretch (p) {
    const q = 1 + p[0] * p[0] + p[1] * p[1]
    return Math.sqrt(q * Math.sqrt(q))
  }

  // The sky on a cube of faces F pixels square, F / 2 pixels a radian at
  // a face's centre, a star drawn scale times its size in a pane's
  // pixels, over black: the light from infinity, which the trace reads
  // along each ray's last direction. F comes in steps of 64, and the
  // four last built are kept, which panes of near sizes share.
  let SKY = null
  const cubes = []
  function cube (F, scale) {
    for (const c of cubes) if (c.F === F) return c
    if (!SKY) SKY = sky(PITCH)
    const { stars, haze } = SKY
    const can = document.createElement('canvas')
    can.width = can.height = F
    const g = can.getContext('2d', { willReadFrequently: true })
    const blue = sprite(228)
    const warm = sprite(32)
    const faces = []
    for (let fi = 0; fi < 6; fi++) {
      g.globalCompositeOperation = 'source-over'
      g.globalAlpha = 1
      g.fillStyle = '#000'
      g.fillRect(0, 0, F, F)
      g.globalCompositeOperation = 'lighter'
      for (const o of haze) {
        const p = onFace(fi, o.n)
        if (!p) continue
        const sz = o.size * F / 2 * stretch(p)
        const x = (p[0] + 1) * F / 2
        const y = (p[1] + 1) * F / 2
        if (x < -sz || y < -sz || x > F + sz || y > F + sz) continue
        g.globalAlpha = Math.min(1, o.a)
        g.drawImage(o.warm ? warm : blue, x - sz, y - sz, 2 * sz, 2 * sz)
      }
      for (const s of stars) {
        const p = onFace(fi, s.n)
        if (!p) continue
        const sz = s.size * scale * stretch(p)
        const x = (p[0] + 1) * F / 2
        const y = (p[1] + 1) * F / 2
        if (x < -sz || y < -sz || x > F + sz || y > F + sz) continue
        g.globalAlpha = s.b
        g.fillStyle = `hsl(${s.hue}, ${s.sat | 0}%, 85%)`
        g.fillRect(x - sz / 2, y - sz / 2, sz, sz)
      }
      faces.push(g.getImageData(0, 0, F, F).data)
    }
    const c = { F, scale, faces, lit: T3.skyTiles(faces, F), nt: Math.ceil(F / 4) }
    cubes.unshift(c)
    if (cubes.length > 4) cubes.pop()
    return c
  }

  // env.text(): the visualization text size, a factor (decision 0036).
  function create (canvas, env) {
    // The scene is drawn on canvases of the CPU and traced into frame,
    // which alone is drawn up to the pane.
    const out = canvas.getContext('2d')
    // The traced frame, at the trace's scale.
    const frame = document.createElement('canvas')
    const fx = frame.getContext('2d', { willReadFrequently: true })
    let fimg = null
    const since = {}
    const styles = new Map()
    let bodies = []
    let dust = []
    let flares = []
    let clock = 0
    let subs = 0
    let shed = 0
    // The camera: its turn about the vertical and its height, in
    // radians, and the time the pointer last turned it. The press while
    // the pointer is down, and the counts the probe reports.
    const cam = { yaw: 0.6, pitch: PITCH, held: -1e9 }
    let press = null
    let thrown = 0
    let turns = 0
    // Each body's number, and the body and the hole the live checks
    // judge (look), set only by a staged scene (stage).
    let made = 0
    const judged = { body: 0, hole: 0 }
    // A scene a check staged (stage): no event, step or turn of the
    // camera moves it, and it is drawn at full light with whole trails.
    let staged = false
    let swallowed = 0
    // The last frame's trace: its size, the pixels traced one by one,
    // its planes and holes.
    let traced = null
    // The view's centre at the last frame: the hole's number, its place
    // on screen and in the trace's frame (null without a hole), and the
    // recentrings of the bodies so far.
    let held = null
    let recentred = 0
    // The pane's signal clock at the last frame, and the simulation time
    // the last frame advanced.
    let tick = 0
    let adv = 0
    // The frame's projection: centre on screen, focal length, camera
    // distance from the place it turns about, o, and basis (right, up,
    // toward the camera).
    const V = { cx: 0, cy: 0, f: 1, D: 620, o: [0, 0, 0], r: [1, 0, 0], u: [0, 1, 0], e: [0, 0, 1] }
    const P = { x: 0, y: 0, d: 0, k: 0 }
    // The waves, their grid of cells' colours and the pair the probe
    // watches.
    const field = new W.Field(C)
    const watch = new W.Watch(field, true)
    let img = null
    let hs = null
    let xs = null
    let vs = null
    let ws = null
    let gb = null
    // The waves' gain as drawn (waves.js gain), and the time over which
    // it rises again, in s: it falls at once, so a burst or a strong
    // pair never floods the pane, and rises slowly, so the pane does not
    // pump as a burst passes.
    let gk = W.GAIN
    const RISE = 2
    // The share of the way from each hole's own spin to CHI_MAX that the
    // session's activity has spun the holes (spinStep), held by a staged
    // scene.
    let up = 0
    const hv = [0, 0]
    const at = [0, 0, 0]
    const cf = [0, 0, 0]
    // The frame's camera in the world, the velocity of the view's centre,
    // which carries it, and the holes { b, s }, for the shift (emit).
    const eye = [0, 0, 0]
    const vo = [0, 0, 0]
    let near = []

    // The shift g of the light of what is at (x, y, z), moving at (vx,
    // vy, vz) relative to the view's centre, seen from the camera: its
    // Doppler factor times the holes' gravitational shift.
    function emit (x, y, z, vx, vy, vz) {
      let nx = eye[0] - x
      let ny = eye[1] - y
      let nz = eye[2] - z
      const l = len(nx, ny, nz) || 1
      nx /= l
      ny /= l
      nz /= l
      return doppler(vx, vy, vz, nx, ny, nz) * lapse(near, x, y, z)
    }

    function body (x, y, z, vx, vy, vz, m, hue, kind) {
      const b = { id: ++made, x, y, z, vx, vy, vz, m, hue, star: kind === 'star', hole: kind === 'hole', comet: kind === 'comet', chi: 0, chi0: 0, up: 0, jx: 0, jy: 0, jz: 1, r: 0, ax: 0, ay: 0, az: 0, trail: [], tv: [], tt: clock, flash: 0, px: 0, py: 0, pd: 1, pk: 0, heat: 0, g: 1 }
      b.r = b.hole ? horizon(b) : radius(m, b.star)
      bodies.push(b)
      return b
    }

    // Body m on a circular orbit about s at distance r, in the plane of
    // unit normal n, at angle a, retrograde if back.
    function orbit (s, r, n, a, m, hue, kind, back) {
      const [p, q] = basis(n)
      const c = Math.cos(a)
      const si = Math.sin(a)
      const v = circular(s, r) * (back ? -1 : 1)
      return body(s.x + r * (c * p[0] + si * q[0]), s.y + r * (c * p[1] + si * q[1]), s.z + r * (c * p[2] + si * q[2]),
        s.vx + v * (-si * p[0] + c * q[0]), s.vy + v * (-si * p[1] + c * q[1]), s.vz + v * (-si * p[2] + c * q[2]), m, hue, kind)
    }

    // A unit normal tilted from the vertical by up to t.
    function tilt (t) {
      const a = Math.random() * Math.PI * 2
      const i = (Math.random() * 2 - 1) * t
      return [Math.sin(i) * Math.cos(a), Math.sin(i) * Math.sin(a), Math.cos(i)]
    }

    function sun () {
      return bodies.reduce((s, b) => !s || b.m > s.m ? b : s, null)
    }

    // A grain, every one of the same shape, which keeps the loops over
    // them fast.
    function grain (o) {
      return Object.assign({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, hue: 0, disc: false, gone: false, px: 0, py: 0, pd: 1, heat: 0, g: 1, lum: 1 }, o)
    }

    // Grains on circular orbits about hole h, in its equator.
    function disc (h, n, r0, r1, hue) {
      const [p, q] = basis([h.jx, h.jy, h.jz])
      for (let k = 0; k < n; k++) {
        const r = r0 + (r1 - r0) * Math.random()
        const a = Math.random() * Math.PI * 2
        const v = circular(h, r)
        const c = Math.cos(a)
        const si = Math.sin(a)
        const w = (Math.random() - 0.5) * 0.02 * r
        const at = [0, 1, 2].map(i => r * (c * p[i] + si * q[i]) + w * [h.jx, h.jy, h.jz][i])
        const vel = [0, 1, 2].map(i => v * (-si * p[i] + c * q[i]))
        dust.push(grain({ x: h.x + at[0], y: h.y + at[1], z: h.z + at[2], vx: h.vx + vel[0], vy: h.vy + vel[1], vz: h.vz + vel[2], hue, disc: true }))
      }
    }

    // A spinning hole at the centre with its disc, a companion star that
    // feeds it, in a tight pair with a small hole, and two planets.
    function seed () {
      bodies = []
      dust = []
      field.reset()
      const h = body(0, 0, 0, 0, 0, 0, 900, 0, 'hole')
      const n = tilt(0.12)
      Object.assign(h, { chi0: 0.35, jx: n[0], jy: n[1], jz: n[2] })
      spin(h, up)
      const s = rs(h.m)
      disc(h, 420, 3.3 * s, 8 * s, 30)
      pair(h, tilt(0.35), Math.random() * 6.3)
      for (const [r, hue] of [[215, 120], [245, 30]]) orbit(h, r, tilt(0.3), Math.random() * 6.3, 2 + Math.random() * 3, hue)
      centre(bodies, dust)
    }

    // The companion about h, in the plane of unit normal n at angle a: a
    // star and a hole on a circular orbit about each other in the
    // Paczynski-Wiita pull, in that plane and sense, their centre of mass
    // on a circular orbit about h.
    function pair (h, n, a) {
      const M = PAIR_STAR + PAIR_HOLE
      const c = orbit(h, PAIR_R, n, a, M, 48, 'star')
      bodies.pop()
      const [p, q] = basis(n)
      const u = [0, 1, 2].map(i => Math.cos(a) * p[i] + Math.sin(a) * q[i])
      const t = [0, 1, 2].map(i => -Math.sin(a) * p[i] + Math.cos(a) * q[i])
      const v = Math.sqrt(M * PAIR_SEP) / (PAIR_SEP - rs(PAIR_HOLE))
      for (const [m, k, hue, kind] of [[PAIR_STAR, PAIR_HOLE / M, 48, 'star'], [PAIR_HOLE, -PAIR_STAR / M, 0, 'hole']]) {
        body(c.x + k * PAIR_SEP * u[0], c.y + k * PAIR_SEP * u[1], c.z + k * PAIR_SEP * u[2], c.vx + k * v * t[0], c.vy + k * v * t[1], c.vz + k * v * t[2], m, hue, kind)
      }
    }

    function planet (hue, m) {
      const s = sun()
      // Clear of a hole's disc.
      const r = s.hole ? Math.min(VIEW, (DISC + 1) * rs(s.m) + Math.random() * 120) : Math.max(s.r + 20, 60 + Math.random() * 160)
      orbit(s, r, tilt(0.5), Math.random() * 6.3, m, hue, 'planet', Math.random() < 0.15)
    }

    // The events, as decision 0015 lists them.
    function react (e) {
      const s = sun()
      if (e.kind === 2) {
        planet(CLASS_HUE[e.cls] ?? 200, 1 + Math.random() * 6)
      } else if (e.kind === 3) {
        // From the edge, aimed to pass close by the heaviest body: for a
        // hole, within a few r_s, so some are swallowed.
        const n = tilt(1.2)
        const [p, q] = basis(n)
        const a = Math.random() * Math.PI * 2
        const r = VIEW * 1.3
        const d = [Math.cos(a) * p[0] + Math.sin(a) * q[0], Math.cos(a) * p[1] + Math.sin(a) * q[1], Math.cos(a) * p[2] + Math.sin(a) * q[2]]
        const miss = (s.hole ? rs(s.m) * (1.5 + 3 * Math.random()) : 20 + Math.random() * 40) * (Math.random() < 0.5 ? -1 : 1)
        const v = Math.sqrt(2 * s.m / r) * 1.05
        const side = [n[1] * d[2] - n[2] * d[1], n[2] * d[0] - n[0] * d[2], n[0] * d[1] - n[1] * d[0]]
        const b = body(s.x + r * d[0], s.y + r * d[1], s.z + r * d[2], 0, 0, 0, 0.5, 190, 'comet')
        b.vx = s.vx + v * (-d[0] + miss / r * side[0])
        b.vy = s.vy + v * (-d[1] + miss / r * side[1])
        b.vz = s.vz + v * (-d[2] + miss / r * side[2])
        flares.push({ x: s.x, y: s.y, z: s.z, t: clock, r: s.hole ? RING * rs(s.m) : s.r })
      } else if (e.kind === 4) {
        s.m = Math.min(Math.max(s.m, HOLE_MAX), s.m * 1.12)
        s.r = s.hole ? horizon(s) : radius(s.m, s.star)
        s.flash = 1
        flares.push({ x: s.x, y: s.y, z: s.z, t: clock, r: s.hole ? RING * rs(s.m) : s.r })
      } else if (e.kind === 5) {
        // A subagent: a black hole, then a star, in turn, three of each
        // at most, a star first when none is left.
        subs++
        const holes = bodies.filter(b => b.hole).length
        const suns = bodies.filter(b => b.star).length
        const r = 150 + Math.random() * 60
        if (subs % 2 && holes < 3 && suns > 0) {
          const h = orbit(s, r, tilt(0.4), Math.random() * 6.3, 150 + Math.random() * 150, 0, 'hole')
          const n = tilt(1)
          Object.assign(h, { chi0: 0.15 + 0.3 * Math.random(), jx: n[0], jy: n[1], jz: n[2] })
          spin(h, up)
          disc(h, 50, 3.3 * rs(h.m), 7 * rs(h.m), 280)
          flares.push({ x: h.x, y: h.y, z: h.z, t: clock, r: RING * rs(h.m) })
        } else if (suns < 3) orbit(s, r, tilt(0.4), Math.random() * 6.3, 100 + Math.random() * 150, 15, 'star')
        else planet(300, 8)
      } else if (e.kind === 6) {
        for (const o of [...bodies, ...dust]) {
          o.vx *= 0.6
          o.vy *= 0.6
          o.vz *= 0.6
        }
      } else {
        // A puff of dust from a body that is not a hole.
        const from = bodies.filter(b => !b.hole)
        const p = from[Math.floor(Math.random() * from.length)]
        if (p) {
          for (let k = 0; k < 16; k++) {
            const z = 1 - 2 * (k + 0.5) / 16
            const a = k * 2.39996
            const c = Math.sqrt(1 - z * z)
            const d = [c * Math.cos(a), c * Math.sin(a), z]
            const v = 0.3 + Math.random() * 0.5
            dust.push(grain({ x: p.x + (p.r + 3) * d[0], y: p.y + (p.r + 3) * d[1], z: p.z + (p.r + 3) * d[2], vx: p.vx + v * d[0], vy: p.vy + v * d[1], vz: p.vz + v * d[2], hue: p.hue }))
          }
        }
      }
      trim()
    }

    // The lightest planets past the cap gone, the oldest dust past its
    // cap, a disc's last, the frame recentred.
    function trim () {
      while (bodies.length > MAX_BODIES) bodies.splice(bodies.indexOf(bodies.filter(b => !b.star && !b.hole).reduce((a, b) => a.m < b.m ? a : b)), 1)
      cap()
      recentre()
    }

    // The bodies recentred, the waves' places moved with them.
    function recentre () {
      recentred++
      const [dx, dy, dz] = centre(bodies, dust)
      field.shift(dx, dy, dz)
      for (const f of flares) {
        f.x += dx
        f.y += dy
        f.z += dz
      }
    }

    function cap () {
      let over = dust.length - MAX_DUST
      if (over <= 0) return
      dust = dust.filter(d => d.disc || over-- <= 0)
      if (dust.length > MAX_DUST) dust.splice(0, dust.length - MAX_DUST)
    }

    // The star nearest each hole sheds grains from the point between
    // them where their pulls balance, L1, at about the star's angular
    // speed: slower than a circular orbit there, so they fall in a stream
    // toward the hole and feed its disc.
    function feed (hh) {
      shed += hh * 1.5
      const holes = bodies.filter(b => b.hole)
      while (shed >= 1) {
        shed--
        for (const h of holes) {
          const s = bodies.filter(b => b.star).reduce((a, b) => !a || len(b.x - h.x, b.y - h.y, b.z - h.z) < len(a.x - h.x, a.y - h.y, a.z - h.z) ? b : a, null)
          if (!s) continue
          const dx = h.x - s.x
          const dy = h.y - s.y
          const dz = h.z - s.z
          const d = len(dx, dy, dz)
          if (d > VIEW * 1.5) continue
          const l1 = d * Math.cbrt(s.m / (3 * h.m))
          const k = (1 - l1 / d) * (1.1 + 0.35 * Math.random())
          const j = () => (Math.random() - 0.5) * 0.08
          dust.push(grain({ x: s.x + dx / d * l1, y: s.y + dy / d * l1, z: s.z + dz / d * l1, vx: h.vx + (s.vx - h.vx) * k + j(), vy: h.vy + (s.vy - h.vy) * k + j(), vz: h.vz + (s.vz - h.vz) * k + j(), hue: s.hue }))
        }
      }
      cap()
    }

    // The camera from its turn and height, about the heaviest hole.
    function point (w, h) {
      const a = anchor(bodies)
      aim(V, cam.yaw, cam.pitch, w, h, a ? [a.x, a.y, a.z] : [0, 0, 0])
    }

    const project = (x, y, z) => place(V, P, x, y, z)

    function style (hue, sat, light, a) {
      const key = (((hue | 0) * 128 + (sat | 0)) * 128 + (light | 0)) * 32 + Math.round(a * 20)
      let s = styles.get(key)
      if (!s) {
        s = `hsla(${hue | 0}, ${sat | 0}%, ${light | 0}%, ${Math.round(a * 20) / 20})`
        if (styles.size > 4000) styles.clear()
        styles.set(key, s)
      }
      return s
    }

    // The frame's audit (scene): per class of matter, the pieces painted,
    // those painted on a slice that does not hold their depth z, and the
    // pieces to paint. Each paint below counts what it puts on slice L.
    let audit = null
    function paint (cls, L, z) {
      audit[cls][0]++
      if (z < L.lo || z >= L.hi) audit[cls][1]++
    }

    // Squares of side s centred at (x, y) on slice L, a grain at depth
    // z, batched by fill and alpha and filled one path a batch: on a
    // canvas of the CPU a call costs more than its few pixels.
    function rect (L, fill, a, x, y, s, z) {
      paint('dust', L, z)
      const k = Math.min(20, Math.round(a * 20))
      if (k <= 0) return
      let bins = L.batch.get(fill)
      if (!bins) {
        bins = []
        L.batch.set(fill, bins)
      }
      ;(bins[k] || (bins[k] = [])).push(x - s / 2, y - s / 2, s)
    }

    function flush (L) {
      const c = L.g
      for (const [fill, bins] of L.batch) {
        c.fillStyle = fill
        for (let k = 1; k < bins.length; k++) {
          const b = bins[k]
          if (!b || !b.length) continue
          c.globalAlpha = k / 20
          c.beginPath()
          for (let i = 0; i < b.length; i += 3) c.rect(b[i], b[i + 1], b[i + 2], b[i + 2])
          c.fill()
          b.length = 0
        }
      }
      if (L.batch.size > 600) L.batch.clear()
      c.globalAlpha = 1
    }

    // The heat of a point at (x, y, z) from the holes: 0 far out, about
    // 0.6 at the last stable orbit, 1 within 2 r_s.
    // The hole that heats the point most, set by heatAt.
    let hotHole = null
    function heatAt (holes, x, y, z) {
      let heat = 0
      hotHole = null
      for (const o of holes) {
        const d = len(x - o.b.x, y - o.b.y, z - o.b.z)
        const t = Math.min(1, (2.3 * o.s / d) ** 2)
        if (t > heat) {
          heat = t
          hotHole = o.b
        }
      }
      return heat
    }

    // The trace's centre and focal length, in its pixels, the sky's
    // cube, and the waves' ground: a plane that only emits, at the mean
    // depth of the waves' sources, read at its edge beyond the screen,
    // smooth, so read at the trace's nodes where they serve.
    let tcx = 0
    let tcy = 0
    let tf = 1
    let sk = null
    let groundZ = V.D
    let ground = null

    // A body's trail: its places, kept in the world as the camera moves,
    // fading with age, in CH chunks, each on the slice of its middle
    // place, drawn there as its images (lensed).
    function trails (b, dim, keep, put) {
      const tr = b.trail
      const n = Math.min(tr.length / 3, Math.ceil(keep * tr.length / 3))
      if (n < 2) return
      const CH = 6
      const per = Math.ceil(n / CH)
      const start = tr.length / 3 - n
      for (let c = 0; c < CH; c++) {
        const i0 = start + c * per
        const i1 = Math.min(start + n - 1, i0 + per)
        if (i1 <= i0) continue
        const m = 3 * ((i0 + i1) >> 1)
        project(tr[m], tr[m + 1], tr[m + 2])
        // Shifted as the body's light was at the chunk's middle place.
        const tv = b.tv
        const g = tv.length === tr.length ? emit(tr[m], tr[m + 1], tr[m + 2], tv[m], tv[m + 1], tv[m + 2]) : b.g
        put(P.d, { b, i0, i1, a: (c + 1) / CH * 0.9 * dim, end: i1 === start + n - 1, g })
      }
    }

    // The count of pieces trails(b) makes.
    function trailCount (b, keep) {
      const tr = b.trail
      const n = Math.min(tr.length / 3, Math.ceil(keep * tr.length / 3))
      if (n < 2) return 0
      const per = Math.ceil(n / 6)
      let k = 0
      for (let c = 0; c < 6; c++) if (Math.min(n - 1, c * per + per) > c * per) k++
      return k
    }

    // A trail's images through the holes (trace.js curve) on the trace's
    // frame, scene sc: its places from the oldest kept to the body's
    // own, in the camera's frame. Each image carries J, so a stroke of
    // width lw across the unbent direction t is lw / |adj(J) t| wide
    // there, at most 3 lw: thinner where a hole squeezes it, as a trace
    // of it would show.
    function lensed (b, keep, sc, lw) {
      const tr = b.trail
      const N = tr.length / 3
      const n = Math.min(N, Math.ceil(keep * N))
      if (n < 2) return null
      const start = N - n
      const pl = new Float64Array(3 * (n + 1))
      for (let i = 0; i <= n; i++) {
        const k = 3 * (start + i)
        if (i < n) frameOf(V, tr[k], tr[k + 1], tr[k + 2], cf)
        else frameOf(V, b.x, b.y, b.z, cf)
        pl[3 * i] = cf[0]
        pl[3 * i + 1] = cf[1]
        pl[3 * i + 2] = cf[2]
      }
      const branches = T3.curve(sc, pl, n + 1)
      for (const br of branches) {
        for (let k = 0; k < br.length; k++) {
          const p0 = br[Math.max(0, k - 1)]
          const p1 = br[Math.min(br.length - 1, k + 1)]
          const s1 = br[k]
          let tx = p1.qx - p0.qx
          let ty = p1.qy - p0.qy
          const tl = Math.hypot(tx, ty) || 1
          tx /= tl
          ty /= tl
          s1.w = Math.min(3 * lw, lw / (Math.hypot(s1.d * tx - s1.b * ty, s1.a * ty - s1.c * tx) || 1e-9))
        }
      }
      return { start, n, branches }
    }

    // A trail's piece t on slice L, stroked along each of its images on
    // the slice's screen layer, which the trace reads where it is seen:
    // each run of images of one width, in steps of a quarter of an
    // octave, a path of that width, butt ended, so neighbouring runs and
    // pieces meet without overlap, and a stroke under a pixel is drawn
    // thin and faint rather than broken.
    const runs = new Map()
    function drawTrail (L, t) {
      paint('trails', L, t.z)
      const { b, im } = t
      if (!im) return
      const S = L.s
      const c = S.g
      const u0 = t.i0 - im.start
      const u1 = t.end ? im.n : t.i1 - im.start
      for (const v of runs.values()) v.length = 0
      for (const br of im.branches) {
        let k0 = 0
        while (k0 < br.length && br[k0].u < u0) k0++
        let k1 = br.length - 1
        while (k1 >= 0 && br[k1].u > u1) k1--
        let run = null
        let q = NaN
        for (let k = k0; k < k1; k++) {
          const p = br[k]
          const p1 = br[k + 1]
          const qk = Math.round(4 * Math.log2((p.w + p1.w) / 2))
          if (qk !== q) {
            q = qk
            if (!runs.has(q)) runs.set(q, [])
            run = [p.x, p.y]
            runs.get(q).push(run)
            mark(S, p.x - p.w / 2 - 1, p.y - p.w / 2 - 1, p.x + p.w / 2 + 1, p.y + p.w / 2 + 1)
          }
          run.push(p1.x, p1.y)
          mark(S, p1.x - p1.w / 2 - 1, p1.y - p1.w / 2 - 1, p1.x + p1.w / 2 + 1, p1.y + p1.w / 2 + 1)
        }
      }
      c.strokeStyle = style(shift(b.hue, t.g), b.comet ? 40 : 85, b.comet ? 80 : 60, Math.min(1, t.a * t.g * t.g * t.g))
      c.lineCap = 'butt'
      c.lineJoin = 'round'
      for (const [q, list] of runs) {
        if (!list.length) continue
        c.lineWidth = 2 ** (q / 4)
        c.beginPath()
        for (const r of list) {
          c.moveTo(r[0], r[1])
          for (let i = 2; i < r.length; i += 2) c.lineTo(r[i], r[i + 1])
        }
        c.stroke()
      }
    }

    // The glow's and the disc's radius of body b on screen.
    function reach (b) {
      const r = Math.max(1.5, b.r * b.pk * (b.star ? 1 : 1.4))
      return [r, b.star ? r * 3.2 : b.heat > 0.15 ? r * (1.5 + 3 * b.heat) : r]
    }

    function drawBody (L, b, dim) {
      paint('bodies', L, b.pd)
      const c = L.g
      const fog = Math.max(0.5, Math.min(1.1, 1.3 - 0.5 * b.pd / V.D))
      const lit = dim * fog
      // The beaming, g^3: in the glow's alpha, and in the disc's
      // lightness up to 80%, past which its hue would wash to white.
      const I = b.g * b.g * b.g
      const [r, R] = reach(b)
      const [h0, sat, light] = hot(b.hue, b.star ? 100 : b.comet ? 40 : 80, b.star ? 90 : b.comet ? 85 : 62, b.heat)
      const hue = shift(h0, b.g)
      if (b.star || b.heat > 0.15) {
        const glow = c.createRadialGradient(b.px, b.py, r * 0.3, b.px, b.py, R)
        glow.addColorStop(0, `hsla(${hue | 0}, 100%, 85%, ${Math.min(1, lit * I)})`)
        glow.addColorStop(0.35, `hsla(${hue | 0}, 100%, 60%, ${Math.min(1, 0.35 * lit * I)})`)
        glow.addColorStop(1, `hsla(${hue | 0}, 100%, 50%, 0)`)
        c.fillStyle = glow
        c.fillRect(b.px - R, b.py - R, 2 * R, 2 * R)
      }
      const l0 = light * lit
      c.fillStyle = `hsl(${hue | 0}, ${sat | 0}%, ${Math.min(l0 * I, Math.max(l0, 80)) | 0}%)`
      c.beginPath()
      c.arc(b.px, b.py, r, 0, Math.PI * 2)
      c.fill()
      mark(L, b.px - R, b.py - R, b.px + R, b.py + R)
    }

    // The waves on a grid of cells, 32 across the pane's shorter side and
    // 8 px at least, blurred up to the pane, each source's on the plane
    // through it that faces the camera: at each cell the sums over
    // sources of h_+ and h_x in the camera's basis, the line of sight and
    // the direction across it in that plane, which is the source's own
    // where its axis lies in the plane or along the line of sight, as
    // shown (waves.js) at the gain gk, eased over dt, squared, its sign
    // kept, h_+ in blue and amber, h_x in teal and rose, over black: the
    // frame's ground, a plane at the
    // sources' mean depth that emits this light and hides nothing, which
    // the trace bends as it bends what else lies at that depth, read
    // bilinear from the grid itself at the trace's scale kt, once a ray
    // and never in a hole's shadow (trace.js plane).
    function drawWaves (w, h, dim, kt, dt) {
      const cell = Math.max(8, Math.round(Math.min(w, h) / 32))
      const gw = Math.ceil(w / cell) + 1
      const gh = Math.ceil(h / cell) + 1
      if (!img || img.width !== gw || img.height !== gh) {
        img = new ImageData(gw, gh)
        hs = new Float32Array(gw * gh)
        xs = new Float32Array(gw * gh)
        vs = new Float32Array(gw * gh)
        ws = new Float32Array(gw * gh)
        gb = new Float32Array(gw * gh)
      }
      const src = []
      let zs = 0
      for (const tr of field.traces.values()) {
        tr.at(tr.last(), at)
        project(at[0], at[1], at[2])
        zs += P.d
        src.push({ tr, x: at[0], y: at[1], z: at[2], sx: P.x, sy: P.y, k: P.k, blur: 1.5 * cell / P.k / C })
      }
      groundZ = src.length ? zs / src.length : V.D
      const px = img.data
      const { r, u } = V
      const k = 0.7 * dim
      for (let j = 0; j < gh; j++) {
        for (let i = 0; i < gw; i++) {
          let hp = 0
          let hx = 0
          for (const o of src) {
            const X = (i * cell - o.sx) / o.k
            const Y = -(j * cell - o.sy) / o.k
            if (!field.wave(o.tr, clock, o.x + X * r[0] + Y * u[0], o.y + X * r[1] + Y * u[1], o.z + Y * u[2], hv, V.e, o.blur)) continue
            hp += hv[0]
            hx += hv[1]
          }
          hs[j * gw + i] = hp
          xs[j * gw + i] = hx
        }
      }
      const want = W.gain(hs, xs, gw * gh, gb)
      gk = want < gk ? want : gk * (want / gk) ** (1 - Math.exp(-dt / RISE))
      W.shown(hs, gw, gh, vs, gk)
      W.shown(xs, gw, gh, ws, gk)
      for (let j = 0; j < gh; j++) {
        for (let i = 0; i < gw; i++) {
          const a0 = vs[j * gw + i]
          const b0 = ws[j * gw + i]
          const a = a0 * Math.abs(a0) * k
          const b = b0 * Math.abs(b0) * k
          const o = 4 * (j * gw + i)
          let R = 0
          let G = 0
          let B = 0
          if (a >= 0) {
            R += 70 * a
            G += 140 * a
            B += 255 * a
          } else {
            R -= 255 * a
            G -= 150 * a
            B -= 60 * a
          }
          if (b >= 0) {
            R += 60 * b
            G += 190 * b
            B += 210 * b
          } else {
            R -= 230 * b
            G -= 110 * b
            B -= 120 * b
          }
          px[o] = R
          px[o + 1] = G
          px[o + 2] = B
          px[o + 3] = 255
        }
      }
      ground = T3.plane(groundZ, img.data, gw, gh, ground, -cell * kt / 2, -cell * kt / 2)
      ground.edge = ground.add = ground.smooth = ground.ground = true
      ground.k = 1 / (cell * kt)
    }

    // The slices the scene is drawn on, flat, near to far, and a slice's
    // box on screen, in the pane's pixels, grown to hold what is drawn.
    const pool = []
    function mark (L, x0, y0, x1, y1) {
      const b = L.box
      if (x0 < b[0]) b[0] = x0
      if (y0 < b[1]) b[1] = y0
      if (x1 > b[2]) b[2] = x1
      if (y1 > b[3]) b[3] = y1
    }

    // The depths that part the slices: each hole's, and behind the
    // nearest hole SUB slices to far, equal in the sum over the holes in
    // front of sqrt((z - z_h) / z), so that a slice's Einstein radii
    // differ little across it.
    function bounds (far) {
      const zs = []
      for (const b of bodies) if (b.hole) zs.push(b.pd)
      zs.sort((a, b) => a - b)
      const out = zs.slice()
      if (!zs.length || far <= zs[0]) return out
      const q = z => {
        let s = 0
        for (const h of zs) if (z > h) s += Math.sqrt((z - h) / z)
        return s
      }
      const q1 = q(far)
      for (let i = 1; i < SUB; i++) {
        let lo = zs[0]
        let hi = far
        for (let it = 0; it < 30; it++) {
          const m = (lo + hi) / 2
          if (q(m) < q1 * i / SUB) lo = m
          else hi = m
        }
        out.push((lo + hi) / 2)
      }
      return out.sort((a, b) => a - b)
    }

    // A canvas the scene is drawn on, tw by th, cleared where it was
    // drawn last, its box emptied.
    const layer = () => ({ c: document.createElement('canvas'), g: null, box: [0, 0, 0, 0], last: null, plane: null })
    function begin (L, tw, th) {
      if (!L.g) L.g = L.c.getContext('2d', { willReadFrequently: true })
      if (L.c.width !== tw || L.c.height !== th) {
        L.c.width = tw
        L.c.height = th
        L.last = null
      }
      L.g.setTransform(1, 0, 0, 1, 0, 0)
      if (L.last) L.g.clearRect(L.last[0], L.last[1], L.last[2], L.last[3])
      L.last = null
      L.box[0] = L.box[1] = Infinity
      L.box[2] = L.box[3] = -Infinity
    }

    // Layer L's drawing within its box, at kt of the box's pixels to one
    // of the trace's, as a plane at depth z, or null if it drew nothing.
    function finish (L, kt, tw, th, z) {
      const x0 = Math.max(0, Math.floor(L.box[0] * kt) - 1)
      const y0 = Math.max(0, Math.floor(L.box[1] * kt) - 1)
      const x1 = Math.min(tw, Math.ceil(L.box[2] * kt) + 1)
      const y1 = Math.min(th, Math.ceil(L.box[3] * kt) + 1)
      if (x1 <= x0 || y1 <= y0) return null
      L.last = [x0, y0, x1 - x0, y1 - y0]
      L.plane = T3.plane(z, L.g.getImageData(x0, y0, x1 - x0, y1 - y0).data, x1 - x0, y1 - y0, L.plane, x0, y0)
      return L.plane
    }

    // The scene for the trace at scale kt, tw by th: every body but skip,
    // the dust and the flares drawn flat on the slice of their depth,
    // each slice's drawing a plane at its content's mean depth, the
    // trails' images on each slice's screen layer, a plane at the mean
    // depth of its pieces, and the holes in the camera's frame, but skip
    // if it is a hole.
    function scene (kt, tw, th, dim, keep, skip) {
      let far = 0
      for (const b of bodies) if (!b.hole) far = Math.max(far, b.pd)
      for (const d of dust) far = Math.max(far, d.pd)
      const bs = bounds(far + 1)
      const ns = bs.length + 1
      while (pool.length < ns) pool.push(Object.assign(layer(), { batch: new Map(), s: layer() }))
      for (let i = 0; i < ns; i++) {
        const L = pool[i]
        begin(L, tw, th)
        begin(L.s, tw, th)
        L.g.setTransform(kt, 0, 0, kt, 0, 0)
        L.zs = 0
        L.ws = 0
        L.tz = 0
        L.lo = i ? bs[i - 1] : 0
        L.hi = i < bs.length ? bs[i] : Infinity
        L.dust = []
        L.bodies = []
        L.trails = []
        L.flares = []
      }
      const at = z => {
        let i = 0
        while (i < bs.length && bs[i] <= z) i++
        return pool[i]
      }
      // The holes, in the camera's frame, first: the trails' images are
      // found through them.
      const hb = bodies.filter(b => b.hole && b !== skip)
      const hs = new Float64Array(4 * hb.length)
      const bref = new Float64Array(hb.length)
      const ks = new Float64Array(T3.KS * hb.length)
      hb.forEach((b, i) => {
        frameOf(V, b.x, b.y, b.z, cf)
        hs[4 * i] = cf[0]
        hs[4 * i + 1] = cf[1]
        hs[4 * i + 2] = cf[2]
        hs[4 * i + 3] = RING * rs(b.m)
        const out = b.chi > 0 ? edged(b, ks, T3.KS * i, hs[4 * i + 3]) : 0
        // Where a cell's linear map would be off by a pixel or more, the
        // light from far behind bent by theta_E^2 / theta: the error of
        // the line across S pixels is S^2 r_s D^2 / (2 f b^3). A spinning
        // hole bends by b less its edge's offset (trace.js), so by as much
        // as 1.5 b_c further out by that offset.
        bref[i] = Math.max(1.5 * hs[4 * i + 3] + out, Math.cbrt(STEP * STEP * rs(b.m) * hs[4 * i + 2] ** 2 / (2 * tf)))
      })
      const lens = { cx: tcx, cy: tcy, f: tf, hs, nh: hb.length, ks }
      const order = bodies.filter(b => !b.hole).sort((a, b) => b.pd - a.pd)
      for (const b of order) {
        const L = at(b.pd)
        if (b !== skip) L.bodies.push(b)
        L.zs += 20 * b.pd
        L.ws += 20
        if (b.trail.length) {
          const im = lensed(b, keep, lens, Math.max(1, Math.min(3, b.r * b.pk * 0.8)) * kt)
          trails(b, dim, keep, (z, t) => {
            const M = at(z)
            t.z = z
            t.im = im
            M.trails.push(t)
            M.tz += z
          })
        }
      }
      for (const d of dust) {
        const L = at(d.pd)
        L.dust.push(d)
        L.zs += d.pd
        L.ws++
      }
      for (const f of flares) {
        project(f.x, f.y, f.z)
        const L = at(P.d)
        L.flares.push({ x: P.x, y: P.y, z: P.d, r: (f.r + (clock - f.t) * 3) * P.k, a: (1 - (clock - f.t) / 18) ** 2 })
        L.zs += P.d
        L.ws++
      }
      // What each class painted, and of it what lies outside the depths
      // of the slice it was painted on, and how many it had to paint:
      // every grain, body, trail piece and flare is painted on the slice
      // of its depth, or the trace bends it wrongly.
      audit = { dust: [0, 0, dust.length], bodies: [0, 0, order.length - (order.includes(skip) ? 1 : 0)], trails: [0, 0, 0], flares: [0, 0, flares.length] }
      for (const b of order) audit.trails[2] += b.trail.length ? trailCount(b, keep) : 0
      const planes = []
      for (let i = 0; i < ns; i++) {
        const L = pool[i]
        if (L.trails.length) {
          for (const t of L.trails) drawTrail(L, t)
          const z = Math.min(L.hi - 1e-3, Math.max(L.lo + 1e-3, L.tz / L.trails.length))
          const p = finish(L.s, 1, tw, th, z)
          if (p) {
            p.screen = true
            planes.push(p)
          }
        }
        if (!L.ws) continue
        const c = L.g
        c.globalCompositeOperation = 'lighter'
        for (const d of L.dust) {
          const heat = d.heat
          const [hue, sat, light] = hot(d.hue, 70, 75, Math.round(heat * 12) / 12)
          const fog = Math.max(0.5, Math.min(1.1, 1.3 - 0.5 * d.pd / V.D))
          const a = (0.55 + 0.45 * heat) * dim * fog * d.lum
          const s = 1.2 + 1.3 * heat
          rect(L, style(shift(hue, d.g), sat, light, 1), a, d.px, d.py, s, d.pd)
          mark(L, d.px - s, d.py - s, d.px + s, d.py + s)
        }
        flush(L)
        c.globalCompositeOperation = 'source-over'
        for (const b of L.bodies) drawBody(L, b, dim)
        for (const f of L.flares) {
          paint('flares', L, f.z)
          c.strokeStyle = `rgba(255, 230, 170, ${f.a})`
          c.lineWidth = 2
          c.beginPath()
          c.arc(f.x, f.y, f.r, 0, Math.PI * 2)
          c.stroke()
          mark(L, f.x - f.r - 2, f.y - f.r - 2, f.x + f.r + 2, f.y + f.r + 2)
        }
        const p = finish(L, kt, tw, th, Math.min(L.hi - 1e-3, Math.max(L.lo + 1e-3, L.zs / L.ws)))
        if (p) planes.push(p)
      }
      planes.sort((a, b) => a.z - b.z)
      if (ground) {
        let i = 0
        while (i < planes.length && planes[i].z < ground.z) i++
        planes.splice(i, 0, ground)
      }
      return { w: tw, h: th, cx: tcx, cy: tcy, f: tf, S: STEP, hs, nh: hb.length, ks, bref, planes, sky: sk, holes: hb, audit }
    }

    // The edge of spinning hole b's shadow, of b_c bc, for the trace,
    // into ks from o (trace.js edge): it seen from the camera (eye) at
    // inclination i to its axis j, its axes alpha = beta x n and beta,
    // j across n, n toward the camera, in the camera's frame, and the
    // edge's offsets from bc. Returns the greatest.
    const ja = [0, 0, 0]
    const jb = [0, 0, 0]
    function edged (b, ks, o, bc) {
      let nx = eye[0] - b.x
      let ny = eye[1] - b.y
      let nz = eye[2] - b.z
      const nl = len(nx, ny, nz) || 1
      nx /= nl
      ny /= nl
      nz /= nl
      const ci = b.jx * nx + b.jy * ny + b.jz * nz
      let ux = b.jx - ci * nx
      let uy = b.jy - ci * ny
      let uz = b.jz - ci * nz
      let ul = len(ux, uy, uz)
      if (ul < 1e-6) {
        // Seen along its axis: any beta across n.
        const k = V.u[0] * nx + V.u[1] * ny + V.u[2] * nz
        ux = V.u[0] - k * nx
        uy = V.u[1] - k * ny
        uz = V.u[2] - k * nz
        ul = len(ux, uy, uz) || 1
      }
      jb[0] = ux / ul
      jb[1] = uy / ul
      jb[2] = uz / ul
      ja[0] = jb[1] * nz - jb[2] * ny
      ja[1] = jb[2] * nx - jb[0] * nz
      ja[2] = jb[0] * ny - jb[1] * nx
      ks[o] = 1
      for (const [at, v] of [[1, ja], [4, jb]]) {
        ks[o + at] = v[0] * V.r[0] + v[1] * V.r[1] + v[2] * V.r[2]
        ks[o + at + 1] = v[0] * V.u[0] + v[1] * V.u[1] + v[2] * V.u[2]
        ks[o + at + 2] = -(v[0] * V.e[0] + v[1] * V.e[1] + v[2] * V.e[2])
      }
      T3.shadow(b.chi, ci, ks, o + 7)
      let most = 0
      for (let k = 0; k < T3.NA; k++) {
        const e = ks[o + 7 + k] * bc
        ks[o + 7 + k] = e
        most = Math.max(most, e)
      }
      return most
    }

    // The traced frame img, at scale kt, onto the canvas of c, scaled up
    // to the pane, under the pane's label.
    function present (c, img, kt) {
      if (frame.width !== img.width || frame.height !== img.height) {
        frame.width = img.width
        frame.height = img.height
      }
      fx.putImageData(img, 0, 0)
      c.setTransform(1, 0, 0, 1, 0, 0)
      c.globalCompositeOperation = 'source-over'
      c.globalAlpha = 1
      c.imageSmoothingEnabled = true
      c.drawImage(frame, 0, 0, img.width, img.height, 0, 0, img.width / kt, img.height / kt)
      W.label(c, canvas.width, env && env.text ? env.text() : 1, gk)
    }

    // For the live check (vizlens.js), while the probe asks: the body and
    // the hole the checks judge (judged), when another hole lies in front
    // of it,
    // and if it lies, glow and all, within the shadow of the hole in
    // front nearest its line, so that a straight ray would hide it, the
    // frame drawn again without it (ctl), the control: a body left out of
    // its slice, a hole out of the trace. The record (seen, seenHole)
    // holds its number and kind, the number and mass of the hole in front
    // (by), u, its distance from the line over the weak-field Einstein
    // radius te of its depth, the shadow's radius R, its own reach r and
    // a body's disc, all in the pane's pixels, the trace's scale k,
    // whether it is hidden, the pixels of the drawn frame outside the
    // shadow that differ from the control by 16 in a channel or more
    // (lighter for a body, darker for a hole, whose image is its shadow),
    // and nearer the hole in front than any other hole on screen,
    // those on its own side of the hole as its outer image, their least
    // and greatest distance from the hole, the degrees about it they span
    // and their spread along the line to it and across it, and up to 8 of
    // them in distinct degrees about the hole, each [x, y] with the
    // control's colour there, alt. Both frames are read whole, after
    // everything nearer is drawn over them.
    const ctl = document.createElement('canvas')
    const cg = ctl.getContext('2d', { willReadFrequently: true })
    let cimg = null
    let asked = -1e9
    let seen = null
    let seenHole = null
    function look (sc, kt, dim, keep) {
      seen = seenHole = null
      if (performance.now() - asked > 2000) return
      const hb = sc.holes
      // Each hole in front of the camera: centre, depth, shadow radius.
      const on = []
      hb.forEach((b, i) => {
        const Z = sc.hs[4 * i + 2]
        if (Z > 2 * sc.hs[4 * i + 3]) on.push({ b, i, Z, x: b.px, y: b.py, R: V.f * Math.tan(Math.asin(sc.hs[4 * i + 3] / Z)) })
      })
      // The hole in front of depth d nearest (x, y) on screen, its
      // distance and the Einstein radius there.
      const front = (x, y, d, skip) => {
        let best = null
        for (const o of on) {
          if (o.b === skip || o.Z >= d) continue
          const dist = len(x - o.x, y - o.y)
          if (!best || dist / o.R < best.dist / best.o.R) best = { o, dist }
        }
        if (best) best.te = V.f * Math.sqrt(2 * rs(best.o.b.m) * (d - best.o.Z) / (best.o.Z * d))
        return best
      }
      let body = null
      for (const b of bodies) {
        if (b.hole || b.id !== judged.body) continue
        const fr = front(b.px, b.py, b.pd, null)
        if (!fr) continue
        // Its glow's reach: the whole of it within the shadow.
        const r = reach(b)[1]
        body = { b, fr, r, disc: reach(b)[0], hidden: fr.dist + r <= fr.o.R, others: on.filter(q => q !== fr.o) }
      }
      let hole = null
      for (const o2 of on) {
        if (o2.b.id !== judged.hole) continue
        const fr = front(o2.x, o2.y, o2.Z, o2.b)
        if (!fr) continue
        hole = { b: o2.b, i: o2.i, fr, r: o2.R, disc: o2.R, hidden: fr.dist + o2.R <= fr.o.R, others: on.filter(q => q !== fr.o && q !== o2) }
      }
      // Each control is the scene drawn again without its body or hole,
      // the trails' images found without the hole.
      if (hole) seenHole = record(hole, true, sc, kt, dim, keep)
      if (body) seen = record(body, false, sc, kt, dim, keep)
    }

    // For the live checks, while the probe asks: the shadow of hole i of
    // scene sc as the trace draws it, along the frame's line through the
    // hole's point across its projected axis, from that point to the
    // edge on the side moving away (away) and on the side moving toward
    // the camera (toward), and the Schwarzschild shadow's radius R, in
    // the pane's pixels, found by halving on the trace's own rule, and
    // the hole's spin chi.
    const RIMSEG = new Float64Array(T3.STRIDE * T3.MAXSEG)
    let rimmed = null
    function rim (sc, i, kt) {
      const o = T3.KS * i
      let ux = sc.ks[o] ? sc.ks[o + 1] : 1
      let uy = sc.ks[o] ? -sc.ks[o + 2] : 0
      const ul = len(ux, uy) || 1
      ux /= ul
      uy /= ul
      const Z = sc.hs[4 * i + 2]
      const hx = sc.cx + sc.f * sc.hs[4 * i] / Z
      const hy = sc.cy - sc.f * sc.hs[4 * i + 1] / Z
      const R = sc.f * sc.hs[4 * i + 3] / Z
      const caught = (x, y) => {
        const dx = (x - sc.cx) / sc.f
        const dy = -(y - sc.cy) / sc.f
        const l = Math.sqrt(dx * dx + dy * dy + 1)
        return T3.trace(0, 0, 0, dx / l, dy / l, 1 / l, sc.hs, sc.nh, RIMSEG, null, sc.ks) < 0
      }
      const out = { chi: sc.holes[i].chi, R: R / kt }
      for (const [k, side] of [['away', 1], ['toward', -1]]) {
        let lo = 0
        let hi = 3 * R
        for (let n = 0; n < 40; n++) {
          const m = (lo + hi) / 2
          if (caught(hx + side * m * ux, hy + side * m * uy)) lo = m
          else hi = m
        }
        out[k] = lo / kt
      }
      return out
    }

    function record (t, isHole, sc, kt, dim, keep) {
      const { fr, r, hidden } = t
      const o = fr.o
      const kind = t.b.hole ? 'hole' : t.b.star ? 'star' : t.b.comet ? 'comet' : 'planet'
      const rec = { id: t.b.id, kind, hole: isHole, star: !!t.b.star, m: t.b.m, by: { id: o.b.id, m: o.b.m }, disc: t.disc, k: kt, u: fr.dist / fr.te, te: fr.te, R: o.R, r, hx: o.x, hy: o.y, x: t.b.px, y: t.b.py, hidden, pixels: 0, outer: { pixels: 0, lo: 0, hi: 0, span: 0 }, pts: [], alt: [] }
      if (!hidden) return rec
      const w = canvas.width
      const h = canvas.height
      const csc = scene(kt, sc.w, sc.h, dim, keep, t.b)
      if (!cimg || cimg.width !== sc.w || cimg.height !== sc.h) cimg = cg.createImageData(sc.w, sc.h)
      T3.render(csc, cimg.data)
      if (ctl.width !== w || ctl.height !== h) {
        ctl.width = w
        ctl.height = h
      }
      present(cg, cimg, kt)
      const a = out.getImageData(0, 0, w, h).data
      const c = cg.getImageData(0, 0, w, h).data
      const deg = new Array(360).fill(null)
      const degs = new Set()
      let lo = Infinity
      let hi = 0
      // Sums for the outer image's spread across and along the line to
      // the hole: distances, and unit vectors about the hole.
      let s1 = 0
      let s2 = 0
      let cx = 0
      let cy = 0
      const outer = []
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const k = 4 * (y * w + x)
          const dist = len(x + 0.5 - o.x, y + 0.5 - o.y)
          if (dist <= o.R + 2) continue
          // Nearer another hole, it may be that hole's image: left out.
          if (t.others.some(q => len(x + 0.5 - q.x, y + 0.5 - q.y) < dist)) continue
          let e = 0
          for (let ch = 0; ch < 3; ch++) e = Math.max(e, isHole ? c[k + ch] - a[k + ch] : a[k + ch] - c[k + ch])
          // 16, the least step vizlens reads as shown: a body far behind
          // the hole, dimmed by its fog, lifts its image by 31 to 39.
          if (e < 16) continue
          rec.pixels++
          const dg = Math.floor((Math.atan2(y + 0.5 - o.y, x + 0.5 - o.x) + Math.PI) / (2 * Math.PI) * 360) % 360
          if (!deg[dg] || e > deg[dg][2]) deg[dg] = [x, y, e, c[k], c[k + 1], c[k + 2]]
          if ((x + 0.5 - o.x) * (t.b.px - o.x) + (y + 0.5 - o.y) * (t.b.py - o.y) <= 0) continue
          rec.outer.pixels++
          lo = Math.min(lo, dist)
          hi = Math.max(hi, dist)
          degs.add(dg)
          s1 += dist
          s2 += dist * dist
          cx += (x + 0.5 - o.x) / dist
          cy += (y + 0.5 - o.y) / dist
          outer.push(x + 0.5 - o.x, y + 0.5 - o.y)
        }
      }
      // The outer image's spread: radial, the deviation of its distances,
      // and tangential, of its pixels' offsets across its mean direction.
      const n = rec.outer.pixels
      if (n) {
        const m = s1 / n
        const cl = len(cx, cy) || 1
        let t2 = 0
        for (let i = 0; i < outer.length; i += 2) t2 += (outer[i] * -cy / cl + outer[i + 1] * cx / cl) ** 2
        Object.assign(rec.outer, { lo, hi, span: degs.size, radial: Math.sqrt(Math.max(0, s2 / n - m * m)), across: Math.sqrt(t2 / n) })
      }
      const full = deg.filter(Boolean)
      const np = Math.min(8, full.length)
      for (let k = 0; k < np; k++) {
        const p = full[Math.floor(k * full.length / np)]
        rec.pts.push([p[0], p[1]])
        rec.alt.push([p[3], p[4], p[5]])
      }
      return rec
    }

    // For the live checks: how far a trail's places lie apart beyond
    // what track allows, the most over neighbouring places, and the last
    // and the body, of their distance less the travel of one step of H
    // at the greater of their speeds, relative to the view's centre,
    // plus that centre's own speed. Kept every step, places lie within
    // TRAIL_D of travel and one step's more, so this is under TRAIL_D but
    // for a merger's jump to the pair's centre of mass. adv is the
    // simulation time the last frame advanced.
    function spacing () {
      const c = anchor(bodies)
      const vc = c ? len(c.vx, c.vy, c.vz) : 0
      let most = 0
      for (const b of bodies) {
        const tr = b.trail
        const tv = b.tv
        if (b.hole || tr.length < 3 || tv.length !== tr.length) continue
        const n = tr.length / 3
        for (let i = 0; i < n; i++) {
          const k = 3 * i
          const last = i === n - 1
          const x1 = last ? b.x : tr[k + 3]
          const y1 = last ? b.y : tr[k + 4]
          const z1 = last ? b.z : tr[k + 5]
          const v0 = len(tv[k], tv[k + 1], tv[k + 2])
          const v1 = last ? len(b.vx - (c ? c.vx : 0), b.vy - (c ? c.vy : 0), b.vz - (c ? c.vz : 0)) : len(tv[k + 3], tv[k + 4], tv[k + 5])
          const dd = len(x1 - tr[k], y1 - tr[k + 1], z1 - tr[k + 2]) - H * (Math.max(v0, v1) + vc)
          most = Math.max(most, dd)
        }
      }
      return { apart: most, adv }
    }

    seed()
    return {
      draw (synth, dt) {
        const w = canvas.width
        const h = canvas.height
        if (w < 4 || h < 4) return
        for (const e of synth.since(since)) if (!staged) react(e)
        const L = synth.level
        if (!staged) up = spinStep(up, activity(L), dt)
        for (const b of bodies) if (b.hole) spin(b, up)
        // Simulation time per second: the clock, as in the Gravity mode.
        const speed = (6 + 30 * Math.min(1, L.bass) + 14 * L.busy + 10 * L.treble) * (1 - 0.9 * L.idle)
        let left = staged ? 0 : Math.min(speed * dt, 60 * H)
        adv = left
        const bursts = []
        const eaten = []
        while (left > 0) {
          const hh = Math.min(H, left)
          const r = step(bodies, hh)
          for (const m of r.merged) bursts.push(m)
          for (const m of r.swallowed) eaten.push(m)
          for (const [o, n] of fall(dust, bodies, hh)) {
            o.flash = Math.min(1, o.flash + 0.03 * n)
            swallowed += n
          }
          feed(hh)
          left -= hh
          clock += hh
          const c0 = anchor(bodies) || REST
          for (const b of bodies) track(b, clock, c0)
          // After the step: a body merged or swallowed in it carries its
          // last acceleration for one sample, and the pair's end leaves
          // as a front.
          watch.sample(clock, field.sample(clock, bodies))
        }
        for (const m of bursts) flares.push({ x: m.x, y: m.y, z: m.z, t: clock, r: 6 + 2 * Math.cbrt(m.m) })
        if (bursts.length || eaten.length) recentre()
        for (const m of eaten) {
          m.hole.flash = 1
          swallowed++
        }
        bodies = bodies.filter(b => b.star || b.hole || len(b.x, b.y, b.z) < VIEW * 4)
        dust = dust.filter(d => !d.gone && len(d.x, d.y, d.z) < VIEW * 2 && bodies.every(b => b.hole || (b.x - d.x) ** 2 + (b.y - d.y) ** 2 + (b.z - d.z) ** 2 > b.r * b.r))
        if (bodies.length < 2 && !staged) seed()
        for (const b of bodies) b.flash *= Math.exp(-dt / 0.6)

        // The camera turns slowly by itself, unless the pointer turned
        // it in the last 4 s.
        const now = synth.t
        if (now - cam.held > 4 && !staged) cam.yaw += dt * 0.06 * (1 - 0.8 * L.idle)
        point(w, h)
        const dim = staged ? 1 : 1 - 0.45 * L.idle
        // Trails: long while busy, gone while idle, when time all but
        // stops.
        const keep = staged ? 1 : 1 - 0.85 * L.idle
        // The holes, for the heat, and the bodies and grains on screen:
        // their places, depths and scales, unlensed, as the trace reads
        // them.
        const holes = []
        for (const b of bodies) if (b.hole) holes.push({ b, s: rs(b.m) })
        // The shift's frame: the view's centre's, which carries the
        // camera (decision 0015, 2026-10-18).
        const c1 = anchor(bodies)
        for (let i = 0; i < 3; i++) eye[i] = V.o[i] + V.D * V.e[i]
        vo[0] = c1 ? c1.vx : 0
        vo[1] = c1 ? c1.vy : 0
        vo[2] = c1 ? c1.vz : 0
        near = holes
        for (const b of bodies) {
          project(b.x, b.y, b.z)
          b.pd = P.d
          b.pk = P.k
          b.px = P.x
          b.py = P.y
          b.heat = b.hole ? 0 : heatAt(holes.filter(o => o.b !== b), b.x, b.y, b.z)
          b.g = b.hole ? 1 : emit(b.x, b.y, b.z, b.vx - vo[0], b.vy - vo[1], b.vz - vo[2])
        }
        for (const d of dust) {
          project(d.x, d.y, d.z)
          d.pd = P.d
          d.px = P.x
          d.py = P.y
          d.heat = heatAt(holes, d.x, d.y, d.z)
          // The shift, in steps of QLN in ln g, so grains of near shifts
          // share a fill, and the beaming, g^3. A hole's flash brightens
          // the hot matter about it.
          const g = emit(d.x, d.y, d.z, d.vx - vo[0], d.vy - vo[1], d.vz - vo[2])
          d.g = g > 0 ? Math.exp(QLN * Math.round(Math.log(g) / QLN)) : 0
          const o = hotHole
          d.lum = d.g * d.g * d.g * (1 + (o ? 1.5 * o.flash * d.heat : 0))
        }
        flares = flares.filter(f => clock - f.t < 18)
        // The trace's scale: the pixels traced bounded a pane, and a
        // window however it is split.
        const view = canvas.ownerDocument && canvas.ownerDocument.defaultView
        const area = view ? view.innerWidth * view.innerHeight * (view.devicePixelRatio || 1) ** 2 : w * h
        const pane = (env && env.trace && env.trace()) || PANE
        const kt = Math.min(1, Math.max(Math.sqrt(pane / (w * h)), Math.sqrt(3 * pane / Math.max(area, w * h))))
        const tw = Math.ceil(w * kt)
        const th = Math.ceil(h * kt)
        tcx = V.cx * kt
        tcy = V.cy * kt
        tf = V.f * kt
        const F = Math.min(CUBE, Math.max(64, Math.round(2 * tf / 64) * 64))
        const cb = cube(F, F / (2 * V.f))
        sk = { F, faces: cb.faces, lit: cb.lit, nt: cb.nt, dim, m: [V.r[0], V.r[1], V.r[2], V.u[0], V.u[1], V.u[2], -V.e[0], -V.e[1], -V.e[2]] }
        drawWaves(w, h, dim, kt, dt)
        const sc = scene(kt, tw, th, dim, keep, null)
        if (!fimg || fimg.width !== tw || fimg.height !== th) fimg = fx.createImageData(tw, th)
        traced = { w: tw, h: th, px: T3.render(sc, fimg.data), planes: sc.planes.length, holes: sc.nh, slices: sc.audit }
        const a = anchor(bodies)
        const ai = a ? sc.holes.indexOf(a) : -1
        held = ai < 0 ? null : { id: a.id, x: a.px, y: a.py, cx: V.cx, cy: V.cy, X: sc.hs[4 * ai], Y: sc.hs[4 * ai + 1] }
        rimmed = ai >= 0 && performance.now() - asked < 2000 ? rim(sc, ai, kt) : null
        present(out, fimg, kt)
        look(sc, kt, dim, keep)
        tick = now
      },

      // A drag turns the camera about the view's centre, the heaviest
      // hole: across, about the vertical, and up and down, its height. A
      // click throws a moon from the point under it, on the plane through
      // that centre facing the camera, on a circular orbit about the
      // heaviest body.
      pointer (kind, x, y, down) {
        if (kind === 'down') {
          press = { x0: x, y0: y, yaw: cam.yaw, pitch: cam.pitch, moved: false }
          return
        }
        if (!press) return
        const dx = x - press.x0
        const dy = y - press.y0
        if (kind === 'move' && down) {
          if (!press.moved && len(dx, dy) >= 5) {
            press.moved = true
            turns++
          }
          if (press.moved) {
            cam.yaw = press.yaw - dx * 0.008
            cam.pitch = Math.max(-1.45, Math.min(1.45, press.pitch + dy * 0.008))
            cam.held = tick
          }
          return
        }
        if (kind !== 'up') return
        const moved = press.moved || len(dx, dy) >= 5
        press = null
        if (moved || !V.f) return
        const k = V.f / V.D
        const X = (x - V.cx) / k
        const Y = -(y - V.cy) / k
        const p = [0, 1, 2].map(i => V.o[i] + X * V.r[i] + Y * V.u[i])
        const s = sun()
        let rel = [p[0] - s.x, p[1] - s.y, p[2] - s.z]
        let d = len(...rel)
        const least = s.hole ? 3.3 * rs(s.m) : s.r + 4
        if (d < 1e-6) {
          rel = V.r.slice()
          d = 1
        }
        if (d < least) {
          rel = rel.map(v => v / d * least)
          d = least
        }
        const n = s.hole ? [s.jx, s.jy, s.jz] : [0, 0, 1]
        let t = [n[1] * rel[2] - n[2] * rel[1], n[2] * rel[0] - n[0] * rel[2], n[0] * rel[1] - n[1] * rel[0]]
        if (len(...t) < 1e-3 * d) t = [V.u[1] * rel[2] - V.u[2] * rel[1], V.u[2] * rel[0] - V.u[0] * rel[2], V.u[0] * rel[1] - V.u[1] * rel[0]]
        const tl = len(...t)
        const v = circular(s, d)
        body(s.x + rel[0], s.y + rel[1], s.z + rel[2], s.vx + v * t[0] / tl, s.vy + v * t[1] / tl, s.vz + v * t[2] / tl, 2 + Math.random() * 3, 55, 'planet')
        thrown++
        trim()
      },

      // For the live checks: a scene staged and held still. The camera at
      // turn yaw and height pitch, a hole of mass m at the centre, its
      // spin along the vertical, its own spin chi (0 if not given) spun
      // up by the share busy of the way to CHI_MAX (0 if not given), as
      // the session's activity spins it, and items, each { kind, m, Z, u, a } or
      // { kind, m, Z, X, Y }: a planet, a star, a hole, a grain (dust) or
      // a flare (of radius r), Z beyond the hole along the line of sight
      // (nearer if negative), and from the hole's line u weak-field
      // Einstein radii of its depth at a degrees from the camera's right
      // toward its up, or X right and Y up, at rest, and a planet with trail
      // given a straight trail of that many places toward the right,
      // 4 apart, or, trail a list of [X, Y, Z], those places, oldest
      // first. Every other body, grain, flare and wave is gone. judge
      // names the items judged: { body, hole }, indices into items. disc,
      // if given, is a count of grains on circular orbits in the hole's
      // equator, from 3.3 to 8 r_s, which turn counterclockwise seen
      // from above, held still with their velocities. Returns the items'
      // numbers.
      stage ({ yaw, pitch, m, chi, busy, items, judge, disc: nd }) {
        staged = true
        cam.yaw = yaw
        cam.pitch = pitch
        point(canvas.width, canvas.height)
        bodies = []
        dust = []
        flares = []
        field.reset()
        const c = body(0, 0, 0, 0, 0, 0, m, 0, 'hole')
        up = busy || 0
        c.chi0 = chi || 0
        spin(c, up)
        if (nd) disc(c, nd, 3.3 * rs(m), 8 * rs(m), 30)
        const ids = items.map(it => {
          let X = it.X
          let Y = it.Y
          if (it.u !== undefined) {
            const d = V.D + it.Z
            const te = Math.sqrt(2 * rs(c.m) * it.Z / (V.D * d))
            const a = it.a * Math.PI / 180
            X = it.u * te * d * Math.cos(a)
            Y = it.u * te * d * Math.sin(a)
          }
          const p = [0, 1, 2].map(i => X * V.r[i] + Y * V.u[i] - it.Z * V.e[i])
          if (it.kind === 'dust') {
            dust.push(grain({ x: p[0], y: p[1], z: p[2], hue: 30 }))
            return 0
          }
          if (it.kind === 'flare') {
            flares.push({ x: p[0], y: p[1], z: p[2], t: clock, r: it.r })
            return 0
          }
          const b = body(p[0], p[1], p[2], 0, 0, 0, it.m, it.kind === 'hole' ? 0 : 55, it.kind)
          if (Array.isArray(it.trail)) {
            for (const [tx, ty, tz] of it.trail) {
              for (let i = 0; i < 3; i++) b.trail.push(tx * V.r[i] + ty * V.u[i] - tz * V.e[i])
              b.tv.push(0, 0, 0)
            }
          } else {
            for (let k = it.trail || 0; k > 0; k--) {
              b.trail.push(p[0] + 4 * k * V.r[0], p[1] + 4 * k * V.r[1], p[2] + 4 * k * V.r[2])
              b.tv.push(0, 0, 0)
            }
          }
          b.tt = clock
          return b.id
        })
        judged.body = judge.body === undefined ? 0 : ids[judge.body]
        judged.hole = judge.hole === undefined ? 0 : ids[judge.hole]
        return ids
      },

      // For the live checks: the staged scene let go, and the mode seeded
      // again.
      unstage () {
        staged = false
        judged.body = judged.hole = 0
        seed()
      },

      // For the live checks: the numbers of the body and the hole judged
      // and whether each is still there, the moons thrown, the camera's
      // turns by a drag, what the holes have swallowed, the bodies and the
      // dust, the waves' sources and the pair watched (waves.js), the last
      // frame's trace (its size, the pixels traced one by one, its planes
      // and holes, and per class of matter [painted, painted on a slice
      // that does not hold its depth, to paint]), the records of the body
      // and the hole judged behind a hole (look), the camera's turn and
      // height, the holes' places and masses, the share of the way to
      // CHI_MAX the session has spun the holes and each hole's own spin
      // and spin (spin: { up, chi: [[chi0, chi]] }), the shadow of the
      // heaviest hole as the trace draws it (rim), the view's centre (held:
      // the heaviest hole's number, its place on screen, the pane's
      // centre, and its place across the trace's axis, X right and Y up)
      // and the recentrings so far, and how far the trails' places lie
      // apart (spacing).
      probe () {
        asked = performance.now()
        return { judged: { body: judged.body, hole: judged.hole, live: [judged.body, judged.hole].map(id => bodies.some(b => b.id === id)) }, thrown, turns, swallowed, holes: bodies.filter(b => b.hole).length, bodies: bodies.length, dust: dust.length, disc: dust.filter(d => d.disc).length, sources: field.traces.size, pair: watch.report(), trace: traced, lens: seen, hole: seenHole, cam: { yaw: cam.yaw, pitch: cam.pitch }, at: bodies.filter(b => b.hole).map(b => [b.x, b.y, b.z, b.m]), spin: { up, chi: bodies.filter(b => b.hole).map(b => [b.chi0, b.chi]) }, rim: rimmed, held, recentred, trails: spacing() }
      }
    }
  }

  const api = { step, track, fall, centre, anchor, aim, frameOf, place, horizon, circular, rs, doppler, lapse, shift, spectral, wavelength, activity, spinStep, spin, C, CHI_MAX, TAU, PANE, BETA, LAM_BLUE, LAM_RED, HUE_BLUE, HUE_RED, quadrupole: W.quadrupole }
  if (typeof module === 'object' && module.exports) module.exports = api
  else (root.VizCanvas = root.VizCanvas || {}).gravity3d = create
})(this)
