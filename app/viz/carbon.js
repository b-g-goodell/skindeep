'use strict'
// Carbon mode (decision 0015, issue #144): the neutral carbon atom, C I,
// on NIST's levels and lines, from docs/research/carbon-atom.md, the
// photon from docs/research/carbon-photon.md, and the owner's answers of
// 2026-10-15 on #144. One site holds an ensemble of N_ATOMS atoms, one
// standing for many. An energy field, driven by the session's activity,
// excites them, and each jumps by Monte Carlo at NIST's rates on the
// event clock: instantaneous jumps at random times, a quantum trajectory
// per atom. Every jump sends a front out from the site on the light
// clock, painted by one M component's radiation pattern, its amplitude
// from h nu and 1/r, collapsing to one detected direction at the pane's
// edge, which lights the spectrum. Visible fronts are drawn in their
// hue, as the packet's leading edge and a trail behind it lambda / TRAIL
// long, no crest: lambda is 94 to 5x10^5 times the view, so the view is in
// the near zone, in one phase. Ultraviolet fronts sharpen the picture and
// infrared ones refract it as heat haze across the same trail, by one
// pass over the atom's pixels (see Warp), on a faint grid in bohr under
// the atom, built for them to act on (see drawBackdrop). One atom
// of the ensemble is drawn: its cloud, particles of |psi|^2 for its M_L
// about the chosen axis z that flow by Nelson's stochastic mechanics,
// about the axis as Madelung's probability current says for m != 0,
// the core from the Bunge 1993 orbitals, the outer electron from the
// research's quantum-defect model, labelled a model; its jumps carry the
// same particles to the lower level's density and flash the jump's
// transition density on them as the source (see Cloud). Beside it the level
// diagram, every level at its energy, the ensemble's populations, the
// drawn atom's level lit and its last jump an arrow, the ground term's
// fine structure in an inset. Along the bottom the spectrum. The two
// clocks, the ensemble, the cloud and the fronts sit behind small
// interfaces: Clock, Ensemble, Cloud, Front and Warp. A magnetic field B
// (issue #158), set on a dial, turns every atom's axis about B at its
// Larmor rate g_J mu_B B / h on the event clock, and a polarized pulse
// aligns the ensemble so that the rate at a detector beats: see Larmor.
// Signals: see react. The pointer: see pointer.

;(function (root) {
  const D = typeof module === 'object' && module.exports ? require('./carbon-data') : root.CarbonData

  // The event clock: every NIST rate divided by EVENT, one factor, so
  // the ratios between levels stay true. The light clock: light at
  // c / LIGHT. Both slowed from 1e6 and 1e17, by the factors that keep
  // every field of the pane under three flashes a second as
  // scripts/checks/vizflash.js counts them (issues #164 and #166,
  // decision 0015). The ground term 3P is where a cascade rests.
  const EVENT = 5e6
  const LIGHT = 5e17
  // The speed of light (exact, SI) and the atomic unit of time (CODATA
  // 2022), seconds.
  const C_LIGHT = 299792458
  const AU_TIME = 2.4188843265864e-17
  // The ensemble, and its field: a hot discharge's electron collisions
  // into any radiating level above the present one, by statistical
  // weight, at up to FIELD_MAX a second per atom at full activity, a few
  // times below the slowest allowed decay on the event clock (2p4p 3D,
  // 4.1e6 / EVENT a second), so the visible lines still leave: 1.2 on an
  // event clock of 1e6, scaled with EVENT.
  const N_ATOMS = 160
  const FIELD_MAX = 1.2e6 / EVENT
  // The ensemble's caption, longest first, for a pane's width.
  const ENSEMBLE = ['one site, ' + N_ATOMS + ' atoms: cloud of 1, fronts of all', N_ATOMS + ' atoms: cloud of 1, fronts of all', N_ATOMS + ' atoms, cloud of 1']
  // Boltzmann's constant over hc, cm^-1 per K (CODATA 2022), and the
  // gas's temperature for the ground term's thermal populations.
  const K_CM = 0.6950348004
  const T_GAS = 300
  // The cloud (issue #165): particles per electron slot, the five core
  // slots and the slot that holds the outer electron in an excited
  // level, which keeps its particles in every level.
  const PTS_CORE = 230
  const PTS_OUTER = 1300
  // Nelson's process runs NELSON times as fast as the light clock: its
  // time factor, current and osmotic velocity and noise alike.
  const NELSON = 1
  // The osmotic velocity (1/2) grad ln rho is clipped at U_MAX bohr per
  // atomic unit of time: it grows without bound at a node of rho and on
  // the axis for m != 0. The Metropolis step keeps rho exact under the
  // clip. Carbon's 1s, the steepest orbital, reaches 6 at the nucleus.
  const U_MAX = 10
  // One step of the Metropolis-adjusted Langevin chain is at most
  // (STEP <r>)^2 atomic units of time for an orbital of mean radius <r>,
  // so its noise is under a third of the cloud and 98 % of proposals are
  // taken in 1s: one step a frame down to 13 frames a second.
  const STEP = 0.3
  // A level change carries each particle from its quantile of the old
  // density to the same quantile of the new over MORPH seconds of wall
  // time, eased: 30 frames at 60 a second, and within the 0.37 to 1.22 s
  // a 2p4p level lives on the event clock, so a lifted cloud mostly
  // reaches its level before it jumps.
  const MORPH = 0.5
  // A particle is drawn at its path's exponential mean over SMOOTH
  // seconds of wall time: a step of Nelson's noise, 0.47 pixels a frame
  // in a full pane, would make every point twinkle, a seethe by other
  // means. The mean lags the path by 0.10 bohr an axis, rms.
  const SMOOTH = 0.25
  // A Madelung angular velocity above this, radians a second on screen,
  // is clipped: m / rho^2 grows without bound near the axis, where the
  // density of m != 0 vanishes. 3 on a light clock of 1e17, scaled with
  // LIGHT, so the clip keeps its radius.
  const SPIN_MAX = 3e17 / LIGHT
  // The fronts: at most FRONTS in flight, the drawn amplitude 1 at R0
  // bohr for a 538 nm front in its pattern's brightest direction, the
  // factor by which a front's trail is shorter than its vacuum
  // wavelength (issue #167, decision 0015), the least width in pixels
  // of the invisible fronts' band, the visible edge's stroke, the ink of
  // the source's flash in points of full brightness, which the
  // particles it rides on share, and its seconds, in wall time.
  const FRONTS = 500
  const R0 = 8
  const NU_REF = 1 / 538.18
  const TRAIL = 1e4
  const BAND_MIN = 1.6
  const SOURCE_PTS = 700
  const SOURCE_T = 0.4
  // The backdrop under the atom (issue #168): a grid's least spacing in
  // pixels, its lines' Gaussian half-width sigma in pixels, their peak
  // and the floor between them, red, green and blue of 255, and the
  // lines' share of that peak at the atom box's corners, where the
  // captions stand: full to GRID_IN of the box's half side from the
  // site, falling linearly to GRID_OUT at the half side and beyond.
  const GRID_PX = 10
  const GRID_SIGMA = 0.7
  const GRID_INK = [22, 30, 50]
  const GRID_FLOOR = [4, 6, 10]
  const GRID_IN = 0.55
  const GRID_OUT = 0.4
  // The invisible fronts' strengths (issue #168): the sharpening's share
  // of the Laplacian and its lift of the pixel, and the haze's peak
  // shift, pixels, each per unit of the front's drawn amplitude, and the
  // most the sharpening may move a channel, levels of 255, which keeps a
  // grid line's lift under a relative luminance of 0.1, so dozens of
  // ultraviolet fronts in flight do not flash (issue #164). Over 64 the
  // most falls linearly to 0.15 of it at 172 and above, so the cloud's
  // dense points, which fill whole cells, are crisped and barely lifted.
  const SHARP = 1.5
  const LIFT = 4
  const SHARP_MAX = 56
  const HAZE = 8
  // The view's radius, bohr: fixed, so every front keeps the light
  // clock's pace, about 1.6 times a 2p4p cloud's mean radius: a front
  // crosses that cloud's diameter in 0.5 LIGHT / 1e17 seconds.
  const VIEW = 24
  const MONO = '"DejaVu Sans Mono", monospace'
  // The field: the Bohr magneton over h, Hz a tesla (CODATA 2022), the
  // dial's largest field and the field at start, tesla, and its angle to
  // z at start, degrees: at the start the drawn atom's axis, turning,
  // flashes no cell of the pane more than three times a second at any
  // g_J up to 2 (issue #169, decision 0015). The pulse's level, the
  // detector's share of the sphere, and its trace: a sample every
  // TRACE_DT of the event clock, TRACE_T of them shown, 2 ms and 1 s on
  // an event clock of 1e6, scaled with EVENT. The detector counts one
  // line of the pulsed level through a filter, its strongest visible
  // line.
  const MU_B_H = 1.39962449171e10
  const B_MAX = 2e-3
  const B_START = 0.15e-3
  const DEG_START = 60
  const PULSE_LEVEL = '2p4p_3P_2'
  const DETECT = 0.05
  const TRACE_DT = 2e-9 * EVENT
  const TRACE_T = 1e-6 * EVENT

  // Text outside ASCII, by code point.
  const U = (...c) => String.fromCharCode(...c)
  const SUP = { 1: U(0xb9), 2: U(0xb2), 3: U(0xb3), 4: U(0x2074), 5: U(0x2075) }
  const SUB = J => U(0x2080 + J)
  const ODD = U(0x1d52)
  const MU = U(0xb5)
  const TO = ' ' + U(0x2192) + ' '
  const TAU = U(0x3c4)
  const TIMES = U(0xd7)
  const A0 = 'a' + U(0x2080)
  const PSI = U(0x3c8)
  const DELTA = U(0x394)
  const THETA = U(0x398)
  const DOTS = U(0x2026)
  const DEG = U(0xb0)
  const LAM = U(0x3bb)

  // A level is in the ground term.
  const ground = l => l.conf === '2s2.2p2' && l.term === '3P'

  // ---- Orbitals --------------------------------------------------------

  const fact = n => n <= 1 ? 1 : n * fact(n - 1)

  // The Clebsch-Gordan coefficient <j1 m1; j2 m2 | J M> for integer
  // momenta, by Racah's formula.
  function cg (j1, m1, j2, m2, J, M) {
    if (m1 + m2 !== M || Math.abs(m1) > j1 || Math.abs(m2) > j2 || Math.abs(M) > J || J < Math.abs(j1 - j2) || J > j1 + j2) return 0
    let s = 0
    for (let k = 0; k <= j1 + j2 - J; k++) {
      const d = [k, j1 + j2 - J - k, j1 - m1 - k, j2 + m2 - k, J - j2 + m1 + k, J - j1 - m2 + k]
      if (d.some(x => x < 0)) continue
      s += (k % 2 ? -1 : 1) / d.reduce((p, x) => p * fact(x), 1)
    }
    return s * Math.sqrt((2 * J + 1) * fact(J + j1 - j2) * fact(J - j1 + j2) * fact(j1 + j2 - J) / fact(j1 + j2 + J + 1) *
      fact(J + M) * fact(J - M) * fact(j1 - m1) * fact(j1 + m1) * fact(j2 - m2) * fact(j2 + m2))
  }

  // ---- Rotations --------------------------------------------------------

  // v turned by ang about the unit vector u, right-handed (Rodrigues).
  function turnAbout (u, ang, v) {
    const c = Math.cos(ang)
    const s = Math.sin(ang)
    const d = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) * (1 - c)
    return [
      v[0] * c + (u[1] * v[2] - u[2] * v[1]) * s + u[0] * d,
      v[1] * c + (u[2] * v[0] - u[0] * v[2]) * s + u[1] * d,
      v[2] * c + (u[0] * v[1] - u[1] * v[0]) * s + u[2] * d
    ]
  }
  // The same turn as a 3 by 3 matrix, rows first, and the product A B.
  function rotation (u, ang) {
    const m = new Array(9)
    for (let c = 0; c < 3; c++) {
      const e = turnAbout(u, ang, [c === 0 ? 1 : 0, c === 1 ? 1 : 0, c === 2 ? 1 : 0])
      for (let r = 0; r < 3; r++) m[3 * r + c] = e[r]
    }
    return m
  }
  function times (A, B) {
    const C = new Array(9)
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[3 * i + j] = A[3 * i] * B[j] + A[3 * i + 1] * B[3 + j] + A[3 * i + 2] * B[6 + j]
    return C
  }
  const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1]
  const Z = [0, 0, 1]
  const unit = v => {
    const n = Math.hypot(v[0], v[1], v[2]) || 1
    return [v[0] / n, v[1] / n, v[2] / n]
  }
  // A vector given about z, carried to the frame whose z is the unit
  // vector n: any such frame, since every pattern is round about its
  // axis.
  function carry (n, v) {
    const h = Math.abs(n[2]) < 0.9 ? Z : [1, 0, 0]
    const a = unit([h[1] * n[2] - h[2] * n[1], h[2] * n[0] - h[0] * n[2], h[0] * n[1] - h[1] * n[0]])
    const b = [n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0]]
    return [v[0] * a[0] + v[1] * b[0] + v[2] * n[0], v[0] * a[1] + v[1] * b[1] + v[2] * n[1], v[0] * a[2] + v[1] * b[2] + v[2] * n[2]]
  }

  // R_nl(r) of the RHF basis: sum_j c_j N_j r^(n_j - 1) exp(-zeta_j r),
  // N_j = (2 zeta_j)^(n_j + 1/2) / sqrt((2 n_j)!). col: the coefficient's
  // column in the basis rows.
  function slater (rows, col, r) {
    let s = 0
    for (const row of rows) {
      const n = row[0]
      const z = row[1]
      s += row[col] * Math.pow(2 * z, n + 0.5) / Math.sqrt(fact(2 * n)) * Math.pow(r, n - 1) * Math.exp(-z * r)
    }
    return s
  }

  // The generalized Laguerre polynomial L_k^(a)(x), by the recurrence.
  function laguerre (k, a, x) {
    if (k === 0) return 1
    let l0 = 1
    let l1 = 1 + a - x
    for (let j = 1; j < k; j++) {
      const l2 = ((2 * j + 1 + a - x) * l1 - (j + a) * l0) / (j + 1)
      l0 = l1
      l1 = l2
    }
    return l1
  }

  // The outer electron's P(r) = r R(r), unnormalized: r^(lambda + 1)
  // exp(-r / n*) L_{n_r}^(2 lambda + 1)(2 r / n*) (research, 6.3).
  function outerP (t, r) {
    return Math.pow(r, t.lambda + 1) * Math.exp(-r / t.nStar) * laguerre(t.nr, 2 * t.lambda + 1, 2 * r / t.nStar)
  }

  // P(r) = r R(r) of an orbital by its key: 1s, 2s, 2p of Bunge, or an
  // outer-electron term of the model.
  function radialP (key, r) {
    if (key === '1s') return r * slater(D.rhf.s, 2, r)
    if (key === '2s') return r * slater(D.rhf.s, 3, r)
    if (key === '2p') return r * slater(D.rhf.p, 2, r)
    return outerP(D.outer[key], r)
  }

  const reach = key => D.outer[key] ? 6 * D.outer[key].meanR + 20 : key === '1s' ? 8 : 20

  // A radial distribution as an inverse-CDF table: q[i] is the radius
  // below which a share i / (q.length - 1) of it lies. dens(r) is the
  // density per unit r, P(r)^2 for an orbital. Built once, on a grid
  // dense near the nucleus.
  function radialTable (dens, rmax, n = 4096, m = 1024) {
    const r = new Float64Array(n + 1)
    const c = new Float64Array(n + 1)
    let prev = 0
    for (let k = 1; k <= n; k++) {
      r[k] = rmax * (k / n) * (k / n)
      const v = dens(r[k])
      c[k] = c[k - 1] + 0.5 * (v + prev) * (r[k] - r[k - 1])
      prev = v
    }
    const q = new Float64Array(m + 1)
    let k = 1
    for (let i = 0; i <= m; i++) {
      const u = c[n] * i / m
      while (k < n && c[k] < u) k++
      const lo = c[k - 1]
      const hi = c[k]
      q[i] = r[k - 1] + (hi > lo ? (u - lo) / (hi - lo) : 0) * (r[k] - r[k - 1])
    }
    return q
  }

  // A radius drawn from the table, for u uniform on [0, 1).
  function drawR (q, u) {
    const x = u * (q.length - 1)
    const i = Math.min(q.length - 2, Math.floor(x))
    return q[i] + (x - i) * (q[i + 1] - q[i])
  }

  // The table's mean radius, by the midpoint of each share.
  function meanR (q) {
    let s = 0
    for (let i = 0; i + 1 < q.length; i++) s += (q[i] + q[i + 1]) / 2
    return s / (q.length - 1)
  }

  const tables = new Map()
  function table (key) {
    let q = tables.get(key)
    if (!q) {
      q = radialTable(r => radialP(key, r) ** 2, reach(key))
      tables.set(key, q)
    }
    return q
  }

  // The electrons of a level by orbital: { key, count, outer, l, nl }.
  // 2s2.2p.nl: the C II core 1s2 2s2 2p with one outer electron of the
  // model. 2s.2p3: a 2s electron raised into 2p, in Bunge's ground
  // orbitals, an approximation the research names.
  function shells (lv) {
    if (lv.conf === '2s2.2p2') return [{ key: '1s', count: 2 }, { key: '2s', count: 2 }, { key: '2p', count: 2 }]
    if (lv.conf === '2s.2p3') return [{ key: '1s', count: 2 }, { key: '2s', count: 1 }, { key: '2p', count: 3 }]
    const nl = lv.conf.split('.').pop()
    return [{ key: '1s', count: 2 }, { key: '2s', count: 2 }, { key: '2p', count: 1 }, { key: lv.conf + ' ' + lv.term, count: 1, outer: true, nl, l: 'spdf'.indexOf(nl.slice(-1)) }]
  }

  // The size of a level: the mean radius of its widest orbital, bohr.
  function size (lv) {
    return Math.max(...shells(lv).map(e => e.outer ? D.outer[e.key].meanR : D.rhf.meanR[e.key]))
  }

  // The one electron a line moves, as orbital keys and l from upper to
  // lower, or null for a jump of two electrons (2s2.2p.nl to and from
  // 2s.2p3), which only configuration mixing allows.
  function mover (up, low) {
    const o = lv => shells(lv).find(e => e.outer)
    const ou = o(up)
    const ol = o(low)
    if (ou && ol) return { from: ou.key, lf: ou.l, to: ol.key, lt: ol.l }
    if (ou && low.conf === '2s2.2p2') return { from: ou.key, lf: ou.l, to: '2p', lt: 1 }
    if (up.conf === '2s.2p3' && low.conf === '2s2.2p2') return { from: '2p', lf: 1, to: '2s', lt: 0 }
    if (up.conf === '2s2.2p2' && low.conf === '2s2.2p2') return { from: '2p', lf: 1, to: '2p', lt: 1 }
    return null
  }

  // ---- Radiation patterns ------------------------------------------------

  // The angular distribution of one M component of a line's radiation
  // about the axis, at cos(Theta) = c, and its largest value. E1 and M1:
  // sin^2 for Delta M = 0, (1 + cos^2) / 2 for +-1. E2 (Jackson,
  // Classical Electrodynamics, ch. 9): sin^2 cos^2 for 0, 1 - 3 cos^2 +
  // 4 cos^4 for +-1, 1 - cos^4 for +-2. Each sums over its M to a
  // constant: an unoriented atom radiates isotropically.
  function pattern (type, q, c) {
    const c2 = c * c
    const a = Math.abs(q)
    if (type === 'E2') return a === 0 ? (1 - c2) * c2 : a === 1 ? 1 - 3 * c2 + 4 * c2 * c2 : 1 - c2 * c2
    return a === 0 ? 1 - c2 : (1 + c2) / 2
  }
  const patternMax = (type, q) => type === 'E2' ? [0.25, 2, 1][Math.abs(q)] : 1
  const patternName = (type, q) => {
    const a = Math.abs(q)
    if (type === 'E2') return ['sin' + U(0xb2) + THETA + 'cos' + U(0xb2) + THETA, '1-3cos' + U(0xb2) + THETA + '+4cos' + U(0x2074) + THETA, '1-cos' + U(0x2074) + THETA][a]
    return a === 0 ? 'sin' + U(0xb2) + THETA : '(1+cos' + U(0xb2) + THETA + ')/2'
  }

  // A unit vector drawn from a pattern about z, by rejection.
  function detectDir (type, q, rand = Math.random) {
    const top = patternMax(type, q)
    for (let i = 0; i < 1000; i++) {
      const z = 2 * rand() - 1
      if (rand() * top <= pattern(type, q, z)) {
        const ph = 2 * Math.PI * rand()
        const s = Math.sqrt(1 - z * z)
        return [s * Math.cos(ph), s * Math.sin(ph), z]
      }
    }
    return [1, 0, 0]
  }

  // The unnormalized associated Legendre function P_l^m(cos theta), m >= 0.
  function legendre (l, m, c) {
    const s = Math.sqrt(Math.max(0, 1 - c * c))
    if (l === 0) return 1
    if (l === 1) return m === 0 ? c : s
    if (l === 2) return m === 0 ? (3 * c * c - 1) / 2 : m === 1 ? 3 * s * c : 3 * s * s
    // l = 3, m 0 to 3.
    return [(5 * c * c * c - 3 * c) / 2, 1.5 * (5 * c * c - 1) * s, 15 * c * s * s, 15 * s * s * s][m]
  }

  // The m of the upper and lower orbitals for component q = m - m',
  // the smallest that the l allow.
  function mPair (lf, lt, q) {
    let best = null
    for (let m = -lf; m <= lf; m++) {
      const mt = m - q
      if (Math.abs(mt) > lt) continue
      if (!best || Math.abs(m) + Math.abs(mt) < Math.abs(best[0]) + Math.abs(best[1])) best = [m, mt]
    }
    return best || [0, 0]
  }

  // The sign of the transition density psi_f* psi_i of a jump, its
  // source (carbon-photon.md, sections 1 and 4), at a point of the
  // atom's frame: the radial part P_f P_i, the angular part
  // P_lf^|m|(cos theta) P_lt^|m'|(cos theta) cos(q phi), the real part
  // at one instant. The flash rides on the particles the jump moves,
  // each in the colour of this sign where it stands (issue #165).
  function sourceSign (mv, q) {
    const [m, mt] = mPair(mv.lf, mv.lt, q)
    return (x, y, z) => {
      const r = Math.hypot(x, y, z) || 1e-9
      const c = z / r
      const a = legendre(mv.lf, Math.abs(m), c) * legendre(mv.lt, Math.abs(mt), c) * Math.cos(q * Math.atan2(y, x))
      return Math.sign(a * radialP(mv.from, r) * radialP(mv.to, r)) || 1
    }
  }

  // Unit vectors spread evenly on the sphere, by the Fibonacci lattice.
  function sphere (n) {
    const v = new Float32Array(3 * n)
    const gold = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < n; i++) {
      const z = 1 - 2 * (i + 0.5) / n
      const s = Math.sqrt(1 - z * z)
      v[3 * i] = s * Math.cos(gold * i)
      v[3 * i + 1] = s * Math.sin(gold * i)
      v[3 * i + 2] = z
    }
    return v
  }
  // Each level's lines down, and its E1 lines up.
  let downs = null
  let ups = null
  function graph () {
    if (downs) return
    downs = D.levels.map(() => [])
    ups = D.levels.map(() => [])
    D.lines.forEach((ln, i) => {
      downs[ln.u].push(i)
      if (ln.type === 'E1') ups[ln.l].push(i)
    })
  }

  // The decay from level i for u uniform on [0, 1): a line index, by
  // the branching ratios.
  function decay (i, u) {
    graph()
    const d = downs[i]
    let s = 0
    for (const k of d) {
      s += D.lines[k].branch
      if (u < s) return k
    }
    return d[d.length - 1]
  }

  // A pick from items by weight, for u uniform on [0, 1).
  function pick (items, weight, u) {
    let total = 0
    for (const it of items) total += weight(it)
    let x = u * total
    for (const it of items) {
      x -= weight(it)
      if (x < 0) return it
    }
    return items[items.length - 1]
  }

  // The ground term's level after a thermal collision: J by Boltzmann's
  // populations at T_GAS, g_J exp(-E_J / kT).
  function thermal (u) {
    const g = D.levels.map((l, i) => i).filter(i => ground(D.levels[i]))
    return pick(g, i => D.levels[i].g * Math.exp(-D.levels[i].E / (K_CM * T_GAS)), u)
  }

  // The E1 absorptions from level i, as line indices sorted by the
  // upper level's energy. A lamp of flat spectral energy density drives
  // each at a rate in proportion to B_ik, so to f_ik lambda.
  function absorptions (i) {
    graph()
    return ups[i].slice().sort((a, b) => D.levels[D.lines[a].u].E - D.levels[D.lines[b].u].E)
  }

  // ---- Names and numbers -----------------------------------------------

  function confName (conf) {
    if (conf === '2s2.2p2') return '2p' + SUP[2]
    if (conf === '2s.2p3') return '2s2p' + SUP[3]
    return conf.replace('2s2.', '').replace('.', '')
  }

  const termName = lv => SUP[lv.term[0]] + lv.term[1] + (lv.term.endsWith('*') ? ODD : '') + SUB(lv.J)
  const levelName = lv => confName(lv.conf) + ' ' + termName(lv)

  // The wavelength NIST lists for a line: air between 200 and 2000 nm,
  // else vacuum.
  const wl = ln => ln.air || ln.vac

  function wlText (nm) {
    if (nm < 1000) return nm.toFixed(1) + ' nm'
    if (nm < 100000) return (nm / 1000).toFixed(nm < 10000 ? 2 : 1) + ' ' + MU + 'm'
    return Math.round(nm / 1000) + ' ' + MU + 'm'
  }

  function timeText (s) {
    if (s < 1e-6) return (s * 1e9).toPrecision(3) + ' ns'
    if (s < 1e-3) return (s * 1e6).toPrecision(3) + ' ' + MU + 's'
    if (s < 1) return (s * 1e3).toPrecision(3) + ' ms'
    if (s < 120) return s.toPrecision(3) + ' s'
    if (s < 86400) return Math.round(s / 60) + ' min'
    return Math.round(s / 86400) + ' d'
  }

  const sci = x => {
    const e = Math.floor(Math.log10(x))
    return (x / Math.pow(10, e)).toFixed(2).replace(/\.?0+$/, '') + 'e' + e
  }

  const visible = ln => ln.band === 'visible' && !!ln.rgb

  // ---- The clocks ------------------------------------------------------

  // A level's mean wait on the event clock, seconds: its lifetime times
  // EVENT, Infinity in the ground term.
  const tauScreen = lv => ground(lv) || !lv.tau ? Infinity : lv.tau * EVENT
  const Clock = {
    EVENT,
    LIGHT,
    tau: tauScreen,
    // Light on the light clock, bohr a second on screen.
    light: C_LIGHT / LIGHT / (D.bohrNm * 1e-9),
    // One atomic unit of time on the light clock, seconds on screen.
    au: AU_TIME * LIGHT
  }

  // ---- M_L and the ensemble ----------------------------------------------

  const L_OF = { S: 0, P: 1, D: 2, F: 3 }
  const Lof = lv => L_OF[lv.term[1]]

  // The subshell occupations n_m of level lv's component M_L = M, from
  // the research's Clebsch-Gordan table: { p: the 2p subshell's for m =
  // -1, 0, 1, o: the outer subshell's for m = -l to l }, or null where
  // the table has none (2s.2p3), which is then drawn round.
  function occupations (lv, M) {
    let key = null
    if (lv.conf === '2s2.2p2') key = '2p2 ' + lv.term
    else if (lv.conf !== '2s.2p3') key = 'l' + shells(lv)[3].l + ' L' + Lof(lv)
    const e = key && D.angular[key]
    const s = e && e.M[Math.abs(M)]
    if (!s) return null
    const flip = a => M < 0 ? a.slice().reverse() : a
    return { p: flip(s.p), o: s.o ? flip(s.o) : null }
  }

  // The radiating levels, those with an allowed decay, by energy: where
  // the field's collisions send an atom.
  let radiating = null
  function targets (i) {
    if (!radiating) radiating = D.levels.map((l, k) => k).filter(k => D.levels[k].tau && D.levels[k].tau < 1e-6)
    return radiating.filter(k => D.levels[k].E > D.levels[i].E)
  }

  // N atoms at one site, each { lv, M, n, t0 }: its level, its M_L about
  // its own axis, the unit vector n at time t0 (see Larmor). Ensemble.step
  // runs each for dt seconds of the event clock by Gillespie's method,
  // its decay at 1 / tau on screen competing with the field's collisions
  // at rate, calling excite(i, at) or jump(i, line, at), at the seconds
  // into the step it happened. Ensemble.weights gives a jump's components
  // q = M_upper - M_lower with their weights, the squared orbital
  // Clebsch-Gordan coefficient <L_l M-q; k q | L_u M> of the multipole's
  // rank k. A line whose L break the triangle, which LS coupling forbids
  // and only mixing allows, takes every q of the rank alike: it
  // radiates isotropically from any M, and the jump keeps M within the
  // lower L. Ensemble.q draws one.
  const Ensemble = {
    make (n, lv) {
      return Array.from({ length: n }, () => ({ lv: typeof lv === 'function' ? lv() : lv, M: 0, n: Z, t0: 0 }))
    },

    weights (ln, M) {
      const k = ln.type === 'E2' ? 2 : 1
      const Lu = Lof(D.levels[ln.u])
      const Ll = Lof(D.levels[ln.l])
      const out = []
      let sum = 0
      for (let q = -k; q <= k; q++) {
        const c = cg(Ll, M - q, k, q, Lu, M)
        if (c * c > 1e-12) out.push([q, c * c])
        sum += c * c
      }
      if (sum > 1e-12) return out.map(e => [e[0], e[1] / sum])
      const all = []
      for (let q = -k; q <= k; q++) all.push([q, 1 / (2 * k + 1)])
      return all
    },

    q (a, ln) {
      const w = Ensemble.weights(ln, a.M)
      return w.length ? pick(w, e => e[1], Math.random())[0] : 0
    },

    step (atoms, dt, rate, excite, jump) {
      for (let i = 0; i < atoms.length; i++) {
        let left = dt
        for (let n = 0; n < 64; n++) {
          const a = atoms[i]
          const tau = tauScreen(D.levels[a.lv])
          const down = tau === Infinity ? 0 : 1 / tau
          const up = rate > 0 && targets(a.lv).length ? rate : 0
          const total = down + up
          if (total <= 0) break
          const w = -Math.log(1 - Math.random()) / total
          if (w > left) break
          left -= w
          if (Math.random() * total < down) jump(i, decay(a.lv, Math.random()), dt - left)
          else excite(i, dt - left)
        }
      }
    }
  }

  // ---- The field ---------------------------------------------------------

  // An atom in a field B (issue #158, research carbon-beyond.md 5.2): a
  // state of M about an axis not along B precesses about B at the Larmor
  // rate g_J mu_B B / h, right-handed (dJ/dt = Omega x J, Omega = g_J
  // mu_B B / hbar), on the event clock divided by EVENT; one of M about B
  // stands. The level's g_J moves the whole M_L-resolved state, a model
  // of LS coupling. b is { T, u }: tesla and the unit direction.
  // Larmor.rate(lv, b): turns a second on screen, 0 for J = 0.
  // Larmor.axis(a, t, b): atom a's axis at time t. Larmor.frame(a, t, b):
  // the drawn atom's frame, its matrix O at t0 turned about B, and back
  // about its own axis by the share of the turn along that axis, so that
  // the frame swings and does not spin: a state round about its axis
  // shows no turn that is not a precession.
  const Larmor = {
    rate: (lv, b) => lv.gJ && b.T ? lv.gJ * MU_B_H * b.T / EVENT : 0,
    axis (a, t, b) {
      const f = Larmor.rate(D.levels[a.lv], b)
      return f ? unit(turnAbout(b.u, 2 * Math.PI * f * (t - a.t0), a.n)) : a.n
    },
    frame (a, t, b) {
      const f = Larmor.rate(D.levels[a.lv], b)
      if (!f) return a.O
      const th = 2 * Math.PI * f * (t - a.t0)
      const cosB = b.u[0] * a.n[0] + b.u[1] * a.n[1] + b.u[2] * a.n[2]
      return times(times(rotation(b.u, th), a.O), rotation(Z, -th * cosB))
    }
  }

  // The mean over the sphere of each pattern, for the angular density.
  const patternMean = (type, q) => type === 'E2' ? [2 / 15, 0.8, 0.8][Math.abs(q)] : 2 / 3
  // The angular density of line k's photon from M_L = M about the
  // atom's axis, over the isotropic one: sum over q of the weight times
  // the pattern over its mean, a polynomial in x = cos^2 Theta, [p0, p1,
  // p2], exact since every pattern is of degree 2 or less in x.
  const linePolys = new Map()
  function linePoly (k, M) {
    const key = k * 32 + M + 16
    let p = linePolys.get(key)
    if (p) return p
    const ln = D.lines[k]
    const at = x => {
      let s = 0
      for (const [q, w] of Ensemble.weights(ln, M)) s += w * pattern(ln.type, q, Math.sqrt(x)) / patternMean(ln.type, q)
      return s
    }
    const f0 = at(0)
    const fh = at(0.5)
    const f1 = at(1)
    const p2 = 2 * (f1 - 2 * fh + f0)
    p = [f0, f1 - f0 - p2, p2]
    linePolys.set(key, p)
    return p
  }
  // The angular density of level i's next photon from M_L = M, about its
  // axis, over the isotropic density: sum over its lines of the branch
  // times sum over q of the weight times the pattern over its mean, a
  // polynomial in x = cos^2 Theta, [p0, p1, p2]. Summed over M it is
  // flat: an atom excited without regard to M radiates isotropically.
  const polys = new Map()
  function emission (i, M) {
    const key = i * 32 + M + 16
    let p = polys.get(key)
    if (p) return p
    graph()
    const at = x => {
      let s = 0
      const c = Math.sqrt(x)
      for (const k of downs[i]) {
        const ln = D.lines[k]
        for (const [q, w] of Ensemble.weights(ln, M)) s += ln.branch * w * pattern(ln.type, q, c) / patternMean(ln.type, q)
      }
      return s
    }
    const f0 = at(0)
    const fh = at(0.5)
    const f1 = at(1)
    const p2 = 2 * (f1 - 2 * fh + f0)
    p = [f0, f1 - f0 - p2, p2]
    polys.set(key, p)
    return p
  }

  // ---- The cloud ---------------------------------------------------------

  // The drawn atom's cloud (issue #165): particles that flow by Nelson's
  // stochastic mechanics in the density rho = |psi|^2 of their electron,
  // each a trajectory, none drawn afresh. A particle of an electron in
  // the orbital R(r) Y_lm moves, in atomic units, by
  //   dx = (v + u) dt + dW,  each axis of dW of variance hbar/m_e dt = dt,
  // with the current velocity v = Im(grad psi / psi), m / rho_perp about
  // z, Madelung's swirl, and the osmotic velocity u = (1/2) grad ln rho
  // (Nelson, Phys. Rev. 150, 1079, 1966). Its stationary density is rho.
  // A step is two exact parts: the swirl, a turn about z by an angle of
  // rho_perp alone, which keeps any rho round about z, and the osmotic
  // drift and the noise as one Metropolis-adjusted Langevin step
  // (Roberts and Tweedie, Bernoulli 2, 341, 1996), whose acceptance
  // keeps rho exact at any step and under the clip of u at U_MAX. The
  // chain's rho is ln R^2 piecewise linear in r on the radial table's
  // grid times ln P_l^m(c)^2 piecewise linear in c = cos theta.

  // Six electron slots: 1s, 1s, 2s, 2s, 2p, and the slot of the electron
  // a level raises. In 2s2.2p2 it is in 2p, in 2s.2p3 the second 2s slot
  // is in 2p too, in 2s2.2p.nl it is the outer electron, the model's.
  // That slot's PTS_OUTER particles stay in every level, each weighted
  // PTS_CORE / PTS_OUTER while it is in a core orbital, so it carries
  // one core electron's ink there, as the other slots do.
  const SLOT_N = [PTS_CORE, PTS_CORE, PTS_CORE, PTS_CORE, PTS_CORE, PTS_OUTER]
  const SLOT_AT = SLOT_N.reduce((a, n) => a.concat(a[a.length - 1] + n), [0])
  const SLOTS = SLOT_N.length

  // ln R(r)^2 of an orbital on the radial table's grid, r_k = rmax (k /
  // n)^2, and each segment's slope, extended past rmax by the last.
  const LN_N = 4096
  const lnTables = new Map()
  function lnTable (key) {
    let t = lnTables.get(key)
    if (!t) {
      const rmax = reach(key)
      const f = new Float64Array(LN_N + 1)
      const d = new Float64Array(LN_N)
      for (let k = 0; k <= LN_N; k++) {
        const r = Math.max(1e-6, rmax * (k / LN_N) ** 2)
        f[k] = Math.log(Math.max(1e-300, (radialP(key, r) / r) ** 2))
      }
      for (let k = 0; k < LN_N; k++) d[k] = (f[k + 1] - f[k]) / (rmax * (2 * k + 1) / (LN_N * LN_N))
      t = { rmax, f, d }
      lnTables.set(key, t)
    }
    return t
  }

  // ln P_l^m(c)^2 on a grid of c = cos theta, each segment's slope, and
  // the cumulative share of P_l^m(c)^2 from c = -1. l = 0 is uniform.
  const ANG_N = 1024
  const angTables = new Map()
  function angTable (l, m) {
    const key = l * 8 + m
    let t = angTables.get(key)
    if (!t) {
      const f = new Float64Array(ANG_N + 1)
      const d = new Float64Array(ANG_N)
      const cdf = new Float64Array(ANG_N + 1)
      let prev = 0
      for (let k = 0; k <= ANG_N; k++) {
        const v = legendre(l, m, -1 + 2 * k / ANG_N) ** 2
        f[k] = Math.log(Math.max(1e-300, v))
        if (k) cdf[k] = cdf[k - 1] + (v + prev) / 2
        prev = v
      }
      for (let k = 0; k < ANG_N; k++) d[k] = (f[k + 1] - f[k]) * ANG_N / 2
      for (let k = 1; k <= ANG_N; k++) cdf[k] /= cdf[ANG_N]
      t = { f, d, cdf }
      angTables.set(key, t)
    }
    return t
  }

  // The share of the radial table below r, and the share of the angular
  // table below c, and c at a share u: the inverses of drawR.
  function shareR (q, r) {
    const n = q.length - 1
    if (r <= q[0]) return 0
    if (r >= q[n]) return 1 - 1e-9
    let lo = 0
    let hi = n
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (q[mid] <= r) lo = mid
      else hi = mid
    }
    return (lo + (q[hi] > q[lo] ? (r - q[lo]) / (q[hi] - q[lo]) : 0)) / n
  }
  function shareC (t, c) {
    const x = Math.max(0, Math.min(ANG_N, (c + 1) * ANG_N / 2))
    const k = Math.min(ANG_N - 1, Math.floor(x))
    return t.cdf[k] + (x - k) * (t.cdf[k + 1] - t.cdf[k])
  }
  function drawC (t, u) {
    const cdf = t.cdf
    let lo = 0
    let hi = ANG_N
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (cdf[mid] <= u) lo = mid
      else hi = mid
    }
    const w = cdf[hi] - cdf[lo]
    return -1 + 2 * (lo + (w > 0 ? (u - cdf[lo]) / w : 0.5)) / ANG_N
  }

  // A slot's orbital in a level: its key and l, the cumulative shares of
  // its n_m from m = -l, or null for m = 0 and directions uniform (an s
  // orbital, or a level the research's table leaves round), its weight,
  // its tables, and its step's cap in atomic units of time.
  function slotKind (key, occ, w) {
    const outer = !!D.outer[key]
    const l = outer ? D.outer[key].l : key === '2p' ? 1 : 0
    let cum = null
    if (l && occ) {
      const tot = occ.reduce((a, b) => a + b, 0)
      let s = 0
      cum = occ.map(v => (s += v) / tot)
    }
    const meanR = outer ? D.outer[key].meanR : D.rhf.meanR[key]
    return { key, l, cum, outer, w, q: table(key), ln: lnTable(key), hmax: (STEP * meanR) ** 2 }
  }
  // The m of a slot's particle at its fixed share u, and the angular
  // table its density takes.
  function mAt (k, u) {
    if (!k.cum) return 0
    for (let i = 0; i < k.cum.length; i++) if (u < k.cum[i]) return i - k.l
    return k.l
  }
  const angOf = (k, m) => k.cum ? angTable(k.l, Math.abs(m)) : angTable(0, 0)

  // The six slots' orbitals of level lv's component M_L = M, and whether
  // the research's table leaves it round.
  function roster (lv, M) {
    const occ = occupations(lv, M)
    const keys = lv.conf === '2s2.2p2'
      ? ['1s', '1s', '2s', '2s', '2p', '2p']
      : lv.conf === '2s.2p3' ? ['1s', '1s', '2s', '2p', '2p', '2p'] : ['1s', '1s', '2s', '2s', '2p', shells(lv)[3].key]
    const kinds = keys.map((key, s) => {
      const outer = !!D.outer[key]
      return slotKind(key, occ && (outer ? occ.o : key === '2p' ? occ.p : null), s === SLOTS - 1 && !outer ? PTS_CORE / PTS_OUTER : 1)
    })
    return { kinds, round: !occ }
  }

  // ln rho at (x, y, z) for a particle of radial table R and angular
  // table A, its gradient, clipped at 2 U_MAX, into g.
  function lnRho (R, A, x, y, z, g) {
    const r = Math.sqrt(x * x + y * y + z * z) || 1e-12
    let kr = Math.floor(LN_N * Math.sqrt(r / R.rmax))
    if (kr > LN_N - 1) kr = LN_N - 1
    const dr = R.d[kr]
    const fr = R.f[kr] + dr * (r - R.rmax * (kr / LN_N) * (kr / LN_N))
    const c = z / r
    let ka = Math.floor((c + 1) * ANG_N / 2)
    if (ka < 0) ka = 0
    else if (ka > ANG_N - 1) ka = ANG_N - 1
    const da = A.d[ka]
    const fa = A.f[ka] + da * (c + 1 - 2 * ka / ANG_N)
    const a = (dr - da * c / r) / r
    let gx = a * x
    let gy = a * y
    let gz = a * z + da / r
    const gn = Math.sqrt(gx * gx + gy * gy + gz * gz)
    if (gn > 2 * U_MAX) {
      const s = 2 * U_MAX / gn
      gx *= s
      gy *= s
      gz *= s
    }
    g[0] = gx
    g[1] = gy
    g[2] = gz
    return fr + fa
  }

  // One Metropolis-adjusted Langevin step of h atomic units of time for
  // the particle at p[o]: the proposal y = x + h u(x) + sqrt(h) xi, taken
  // with the chance min(1, rho(y) q(x | y) / (rho(x) q(y | x))).
  // ln rho and u at the particle are kept from its last step in c.ln and
  // c.g, valid while c.ok is set: a step takes one new evaluation.
  const G1 = new Float64Array(3)
  function mala (c, i, R, A, h, rand) {
    const p = c.pts
    const o = 3 * i
    const G0 = c.g
    const x = p[o]
    const y = p[o + 1]
    const z = p[o + 2]
    if (!c.ok[i]) {
      c.ln[i] = lnRho(R, A, x, y, z, G1)
      G0[o] = G1[0]
      G0[o + 1] = G1[1]
      G0[o + 2] = G1[2]
      c.ok[i] = 1
    }
    const l0 = c.ln[i]
    const s = Math.sqrt(h)
    const a = Math.sqrt(-2 * Math.log(1 - rand()))
    const b = 2 * Math.PI * rand()
    const n0 = a * Math.cos(b)
    const n1 = a * Math.sin(b)
    const n2 = Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand())
    const yx = x + 0.5 * h * G0[o] + s * n0
    const yy = y + 0.5 * h * G0[o + 1] + s * n1
    const yz = z + 0.5 * h * G0[o + 2] + s * n2
    const l1 = lnRho(R, A, yx, yy, yz, G1)
    const bx = x - yx - 0.5 * h * G1[0]
    const by = y - yy - 0.5 * h * G1[1]
    const bz = z - yz - 0.5 * h * G1[2]
    const la = l1 - l0 - (bx * bx + by * by + bz * bz) / (2 * h) + (n0 * n0 + n1 * n1 + n2 * n2) / 2
    if (la >= 0 || Math.log(rand()) < la) {
      p[o] = yx
      p[o + 1] = yy
      p[o + 2] = yz
      c.ln[i] = l1
      G0[o] = G1[0]
      G0[o + 1] = G1[1]
      G0[o + 2] = G1[2]
    }
  }

  // Cloud.make(lv, M) makes the cloud of level lv's component M_L = M,
  // each particle at an independent draw from its electron's rho, its m
  // by the subshell's n_m at a share it keeps for good. Cloud.step(c,
  // dt) moves it dt seconds on screen: Nelson's process on the light
  // clock times NELSON, in steps of at most each orbital's cap, and the
  // morphs under way, and the drawn points c.q, each particle's path
  // averaged over SMOOTH. Cloud.to(c, lv, M) sets a new level: every particle
  // whose density changes is carried from its quantile of the old one,
  // radius by the radial table and c by the angular table, its azimuth
  // kept, to the same quantile of the new over MORPH seconds, and takes
  // no Nelson step meanwhile. A particle moved again before it arrives
  // keeps the quantiles of its first move. Every particle stays: none is
  // made or lost. It returns the slots whose orbital changed.
  // Cloud.draw(c, fr, area, dim, rect, O, flash) turns the drawn points
  // by the atom's frame O and projects them, far points dimmer and smaller,
  // the outer electron's in amber, and the flash's slots again in the
  // colour of the source's sign where each particle stands.
  const Cloud = {
    N: SLOT_AT[SLOTS],
    SLOT_AT,

    make (lv, M, rand = Math.random) {
      const n = SLOT_AT[SLOTS]
      const ro = roster(lv, M)
      const c = {
        n,
        t: 0,
        kinds: ro.kinds,
        round: ro.round,
        pts: new Float32Array(3 * n),
        m: new Int8Array(n),
        um: new Float32Array(n),
        w: new Float32Array(n),
        amber: new Uint8Array(n),
        mt: new Float64Array(n).fill(-1),
        from: new Float32Array(2 * n),
        to: new Float32Array(2 * n),
        ph: new Float32Array(n),
        uq: new Float32Array(2 * n),
        w0: new Float32Array(n),
        ln: new Float64Array(n),
        g: new Float64Array(3 * n),
        ok: new Uint8Array(n),
        q: null
      }
      for (let s = 0; s < SLOTS; s++) {
        const k = c.kinds[s]
        for (let i = SLOT_AT[s]; i < SLOT_AT[s + 1]; i++) {
          c.um[i] = rand()
          c.m[i] = mAt(k, c.um[i])
          const r = drawR(k.q, rand())
          const z = drawC(angOf(k, c.m[i]), rand())
          const ph = 2 * Math.PI * rand()
          const sn = Math.sqrt(Math.max(0, 1 - z * z))
          c.pts[3 * i] = r * sn * Math.cos(ph)
          c.pts[3 * i + 1] = r * sn * Math.sin(ph)
          c.pts[3 * i + 2] = r * z
          c.w[i] = k.w
          c.amber[i] = k.outer ? 1 : 0
        }
      }
      c.q = Float32Array.from(c.pts)
      return c
    },

    to (c, lv, M) {
      const ro = roster(lv, M)
      const moved = []
      const p = c.pts
      for (let s = 0; s < SLOTS; s++) {
        const a = c.kinds[s]
        const b = ro.kinds[s]
        if (a.key !== b.key) moved.push(s)
        for (let i = SLOT_AT[s]; i < SLOT_AT[s + 1]; i++) {
          const m0 = c.m[i]
          const m = mAt(b, c.um[i])
          c.m[i] = m
          if (a.key === b.key && angOf(a, m0) === angOf(b, m)) continue
          const x = p[3 * i]
          const y = p[3 * i + 1]
          const z = p[3 * i + 2]
          const r = Math.sqrt(x * x + y * y + z * z) || 1e-12
          if (c.mt[i] < 0) {
            c.uq[2 * i] = shareR(a.q, r)
            c.uq[2 * i + 1] = shareC(angOf(a, m0), z / r)
            c.ph[i] = Math.atan2(y, x)
          }
          c.from[2 * i] = r
          c.from[2 * i + 1] = Math.acos(Math.max(-1, Math.min(1, z / r)))
          c.to[2 * i] = drawR(b.q, c.uq[2 * i])
          c.to[2 * i + 1] = Math.acos(drawC(angOf(b, m), c.uq[2 * i + 1]))
          c.w0[i] = c.w[i]
          c.mt[i] = c.t
          c.ok[i] = 0
        }
      }
      c.kinds = ro.kinds
      c.round = ro.round
      return moved
    },

    step (c, dt, rand = Math.random) {
      Cloud.flow(c, dt, rand)
      // The drawn points: each path's mean, or the path itself while a
      // morph carries it, so it arrives on time.
      const a = 1 - Math.exp(-dt / SMOOTH)
      for (let i = 0; i < c.n; i++) {
        const b = c.mt[i] >= 0 ? 1 : a
        for (let j = 3 * i; j < 3 * i + 3; j++) c.q[j] += (c.pts[j] - c.q[j]) * b
      }
    },

    // The particles' own motion, dt seconds on screen.
    flow (c, dt, rand = Math.random) {
      c.t += dt
      const p = c.pts
      const h = NELSON * dt / Clock.au
      for (let s = 0; s < SLOTS; s++) {
        const k = c.kinds[s]
        const nsub = Math.max(1, Math.ceil(h / k.hmax))
        const hs = h / nsub
        for (let i = SLOT_AT[s]; i < SLOT_AT[s + 1]; i++) {
          if (c.mt[i] >= 0) {
            const u = Math.min(1, (c.t - c.mt[i]) / MORPH)
            const e = u * u * (3 - 2 * u)
            const r = c.from[2 * i] + (c.to[2 * i] - c.from[2 * i]) * e
            const th = c.from[2 * i + 1] + (c.to[2 * i + 1] - c.from[2 * i + 1]) * e
            const sn = r * Math.sin(th)
            p[3 * i] = sn * Math.cos(c.ph[i])
            p[3 * i + 1] = sn * Math.sin(c.ph[i])
            p[3 * i + 2] = r * Math.cos(th)
            c.w[i] = c.w0[i] + (k.w - c.w0[i]) * e
            if (u >= 0.5) c.amber[i] = k.outer ? 1 : 0
            if (u >= 1) c.mt[i] = -1
            c.ok[i] = 0
            continue
          }
          const m = c.m[i]
          if (m) {
            const x = p[3 * i]
            const y = p[3 * i + 1]
            const w = Math.max(-SPIN_MAX, Math.min(SPIN_MAX, NELSON * m / Math.max(1e-6, x * x + y * y) / Clock.au)) * dt
            const cs = Math.cos(w)
            const sn = Math.sin(w)
            p[3 * i] = x * cs - y * sn
            p[3 * i + 1] = x * sn + y * cs
            const gx = c.g[3 * i]
            const gy = c.g[3 * i + 1]
            c.g[3 * i] = gx * cs - gy * sn
            c.g[3 * i + 1] = gx * sn + gy * cs
          }
          const A = angOf(k, m)
          for (let j = 0; j < nsub; j++) mala(c, i, k.ln, A, hs, rand)
        }
      }
    },

    // The particles of slot s that are moving to a new level's density.
    moving (c, s) {
      let n = 0
      for (let i = SLOT_AT[s]; i < SLOT_AT[s + 1]; i++) if (c.mt[i] >= 0) n++
      return n
    },

    draw (c, fr, a, dim, rect, O = IDENTITY, flash = null) {
      const p = c.q
      for (let s = 0; s < SLOTS; s++) {
        const lit = flash && flash.slots.includes(s)
        for (let i = SLOT_AT[s]; i < SLOT_AT[s + 1]; i++) {
          const x = p[3 * i]
          const y = p[3 * i + 1]
          const z = p[3 * i + 2]
          const v = fr.project(O[0] * x + O[1] * y + O[2] * z, O[3] * x + O[4] * y + O[5] * z, O[6] * x + O[7] * y + O[8] * z)
          if (v.x < a.x || v.x >= a.x + a.w || v.y < a.y || v.y >= a.y + a.h) continue
          const vx = v.x
          const vy = v.y
          const near = Math.max(0, Math.min(1, (v.s - 0.8) / 0.45))
          const amber = c.amber[i]
          rect(amber ? '#ffcf7a' : '#a9c8ff', (amber ? 0.4 + 0.5 * near : 0.3 + 0.45 * near) * dim * c.w[i], vx, vy, 1 + 1.6 * near)
          if (lit) rect(flash.sign(x, y, z) > 0 ? '#7dffd0' : '#ff8ad8', (0.5 + 0.4 * Math.max(0, Math.min(1, v.s - 0.8))) * flash.a, vx, vy, 1.8)
        }
      }
    }
  }

  // ---- The fronts --------------------------------------------------------

  // A front's pattern as one of five kinds: E1 and M1 with |q| 0 or 1,
  // E2 with |q| 0, 1 or 2.
  const kindOf = (type, q) => type === 'E2' ? 2 + Math.abs(q) : Math.abs(q)
  const KINDS = [['E1', 0], ['E1', 1], ['E2', 0], ['E2', 1], ['E2', 2]]
  // The drawn amplitude's share in the direction with cos(Theta) = c:
  // the square root of the pattern over its largest value.
  const shapeOf = (k, c) => Math.sqrt(Math.max(0, pattern(KINDS[k][0], KINDS[k][1], c) / patternMax(KINDS[k][0], KINDS[k][1])))
  // As a table of 257 steps of c from -1 to 1, for the pixel pass.
  const SHAPES = KINDS.map((_, k) => Float32Array.from({ length: 257 }, (_, i) => shapeOf(k, -1 + i / 128)))
  const shape = (k, c) => SHAPES[k][Math.round((c + 1) * 128)]

  // One photon's front, from the site, on the light clock: line k,
  // component q about the unit axis n its atom had, born at t: it keeps
  // that pattern as the atom turns on. Its amplitude follows the
  // physics: intensity h nu times the pattern over r^2, drawn as its
  // square root, so sqrt(nu / nu_538) sqrt(pattern) R0 / r, 1 at most.
  // Its wavelength is the vacuum one, the light's at the atom: 94 to
  // 5x10^5 times the view's radius. A front is detected 25 to 38 bohr
  // from the site, by the pane, and lambda / 2 pi is 358 bohr at the
  // shortest line, so every front lives in the near zone, where the
  // field has one phase across the view and no crest. On the light clock
  // its period is lambda / Clock.light, 198 s to 282 h. So a front is
  // drawn as the packet's leading edge and a trail behind it, lambda /
  // TRAIL long, the pane printing TRAIL: lengths in the true ratio of the
  // lines' wavelengths, against the scale bar by that factor. Nothing is
  // drawn ahead of the edge, where no field has come, and nothing
  // oscillates.
  const Front = {
    make (k, ln, q, t, n = Z) {
      return { k, ln, q, t, n, kind: kindOf(ln.type, q), amp: Math.sqrt((1 / wl(ln)) / NU_REF), vis: visible(ln), uv: wl(ln) < 380, trail: Front.trail(ln) }
    },

    // The line's vacuum wavelength, bohr.
    lambda: ln => ln.vac / D.bohrNm,
    // Its trail, bohr: lambda / TRAIL.
    trail: ln => Front.lambda(ln) / TRAIL,
    // Its period on the light clock, seconds on screen.
    period: ln => Front.lambda(ln) / Clock.light,

    // Its radius, bohr, at time now.
    radius: (f, now) => Clock.light * (now - f.t),

    // The trail's brightness, as a share of the edge's, in its three
    // thirds from the edge inward.
    FADE: [0.42, 0.24, 0.1],

    // The visible fronts, in their hue: each the limb of its sphere, the
    // edge, and its trail inside it in three bands of a third of its
    // length each, fading inward, as arcs whose brightness is the drawn
    // amplitude in the arc's direction, cos(Theta) = cos(phi) ax +
    // sin(phi) ay on the limb, [ax, ay] its axis on the screen. Arcs
    // batched by colour, the trail's width and brightness.
    draw (g, fronts, fr, now) {
      const N = 36
      const bins = new Map()
      for (const f of fronts) {
        if (!f.vis) continue
        const Rb = Front.radius(f, now)
        const R = Rb * fr.k
        if (R <= 1) continue
        const a0 = Math.min(1, f.amp * R0 / Math.max(Rb, 0.1))
        const v = fr.turn(f.n[0], f.n[1], f.n[2])
        const ax = v.x
        const ay = v.y
        // The trail's thirds, pixels, those inside the site dropped.
        const L = Math.min(f.trail * fr.k, R)
        const w3 = L / 3
        const key = f.ln.rgb + '|' + Math.round(4 * w3)
        let bin = bins.get(key)
        if (!bin) bins.set(key, bin = { rgb: f.ln.rgb, w: w3, rings: [[], [], [], []] })
        const radii = [R]
        if (w3 >= 0.5) for (let s = 0; s < 3; s++) radii.push(R - (s + 0.5) * w3)
        for (let j = 0; j < N; j++) {
          const p0 = 2 * Math.PI * j / N
          const p1 = 2 * Math.PI * (j + 1) / N
          const e = a0 * shape(f.kind, Math.cos((p0 + p1) / 2) * ax + Math.sin((p0 + p1) / 2) * ay)
          for (let s = 0; s < radii.length; s++) {
            const b = Math.round(20 * e * (s ? Front.FADE[s - 1] : 1))
            if (b <= 0) continue
            const r = radii[s]
            const list = bin.rings[s]
            const path = list[b] || (list[b] = new Path2D())
            path.moveTo(fr.cx + r * Math.cos(p0), fr.cy - r * Math.sin(p0))
            path.arc(fr.cx, fr.cy, r, -p0, -p1, true)
          }
        }
      }
      g.save()
      for (const bin of bins.values()) {
        g.strokeStyle = bin.rgb
        bin.rings.forEach((list, s) => {
          g.lineWidth = s ? bin.w : BAND_MIN
          list.forEach((path, b) => {
            if (!path) return
            g.globalAlpha = b / 20
            g.stroke(path)
          })
        })
      }
      g.restore()
    }
  }

  // Each kind's shape about an axis whose length on the screen is l, as
  // harmonics of the screen angle psi from that axis: shape(k, l cos psi)
  // = h_0 + sum h_n cos(2 n psi), n 1 to HARM, by l in 32 steps. Every
  // shape is even in cos, so only even harmonics occur.
  const HARM = 4
  const HARMS = KINDS.map((_, k) => Array.from({ length: 33 }, (_, j) => {
    const h = new Float32Array(HARM + 1)
    const N = 256
    for (let i = 0; i < N; i++) {
      const psi = 2 * Math.PI * (i + 0.5) / N
      const g = shapeOf(k, j / 32 * Math.cos(psi))
      for (let n = 0; n <= HARM; n++) h[n] += g * Math.cos(2 * n * psi) * (n ? 2 : 1) / N
    }
    return h
  }))

  // The invisible fronts as image transforms over the atom's pixels, in
  // one pass, since every front shares one centre. Each front keeps the
  // axis of its moment of emission, so its shape is taken about that
  // axis on the screen, as harmonics: every front adds its shape's
  // harmonics, turned to its axis, to tables by integer radius, and a
  // pixel sums the tables at its radius against the harmonics of its own
  // angle. The cost does not grow with the number of axes.
  // Each acts across the front's trail, lambda / TRAIL behind its edge
  // and nothing ahead of it, at least BAND_MIN pixels wide, its strength
  // falling from the edge inward: Warp.profile. Ultraviolet fronts
  // sharpen the picture and lift its contrast there, SHARP of the
  // Laplacian and LIFT of the pixel, by SHARP_MAX at most. Infrared fronts refract it,
  // shifting pixels along the radius by one smooth lobe across the trail,
  // HAZE pixels at its peak per unit amplitude, as a refracting shell
  // does: no ripple, since in the view the field has no crest. Radii with
  // no front are skipped.
  const Warp = {
    tables: null,
    // The last pass's mean change of the box's pixels, levels of 255 a
    // channel: the frame with its invisible fronts against without them.
    change: 0,
    // The band's width in pixels at k pixels a bohr.
    width: (f, k) => Math.max(BAND_MIN, f.trail * k),
    // At u, the share of the band from the edge (0) inward (1): the
    // sharpening's share of the front's amplitude, and the shift's in
    // pixels per unit amplitude. Zero outside the band.
    profile (f, u) {
      if (u < 0 || u > 1) return 0
      return f.uv ? 1 - u : 4 * HAZE * u * (1 - u)
    },
    apply (g, fronts, fr, box, now) {
      Warp.change = 0
      const some = fronts.filter(f => !f.vis)
      if (!some.length || box.w < 4 || box.h < 4) return 0
      const rmax = Math.ceil(Math.hypot(box.w, box.h)) + 4
      const H2 = 2 * HARM + 1
      if (!Warp.tables || Warp.tables.n < rmax) Warp.tables = { n: rmax, S: Array.from({ length: H2 }, () => new Float32Array(rmax)), Dp: Array.from({ length: H2 }, () => new Float32Array(rmax)), on: new Uint8Array(rmax) }
      const T = Warp.tables
      for (let k = 0; k < H2; k++) {
        T.S[k].fill(0)
        T.Dp[k].fill(0)
      }
      T.on.fill(0)
      const c = new Float32Array(H2)
      let used = 0
      for (const f of some) {
        const Rb = Front.radius(f, now)
        const R = Rb * fr.k
        const a = Math.min(1.5, f.amp * R0 / Math.max(Rb, 0.1))
        const w = Warp.width(f, fr.k)
        const lo = Math.max(0, Math.ceil(R - w))
        const hi = Math.min(rmax - 1, Math.floor(R))
        if (hi < lo) continue
        used++
        // The front's harmonics about its axis on the screen.
        const v = fr.turn(f.n[0], f.n[1], f.n[2])
        const l = Math.min(1, Math.hypot(v.x, v.y))
        const al = Math.atan2(v.y, v.x)
        const h = HARMS[f.kind][Math.round(l * 32)]
        c[0] = h[0]
        for (let n = 1; n <= HARM; n++) {
          c[2 * n - 1] = h[n] * Math.cos(2 * n * al)
          c[2 * n] = h[n] * Math.sin(2 * n * al)
        }
        const tab = f.uv ? T.S : T.Dp
        for (let r = lo; r <= hi; r++) {
          const e = a * Warp.profile(f, (R - r) / w)
          for (let k = 0; k < H2; k++) tab[k][r] += e * c[k]
          T.on[r] = 1
        }
      }
      if (!used) return 0
      const img = g.getImageData(box.x, box.y, box.w, box.h)
      const d = img.data
      if (!Warp.src || Warp.src.length < d.length) Warp.src = new Uint8ClampedArray(d.length)
      const src = Warp.src
      src.set(d)
      const W = box.w
      const H = box.h
      const ox = fr.cx - box.x
      const oy = fr.cy - box.y
      const S = T.S
      const Dp = T.Dp
      let sum = 0
      for (let y = 1; y < H - 1; y++) {
        const dy = y - oy
        for (let x = 1; x < W - 1; x++) {
          const dx = x - ox
          const rr = Math.sqrt(dx * dx + dy * dy)
          const ri = rr | 0
          if (ri >= rmax || !T.on[ri]) continue
          // cos and sin of 2 n psi, psi the pixel's angle on the screen,
          // y up.
          const ux = rr > 0 ? dx / rr : 0
          const uy = rr > 0 ? -dy / rr : 0
          const c1 = ux * ux - uy * uy
          const s1 = 2 * ux * uy
          let cn = 1
          let sn = 0
          let s = S[0][ri]
          let disp = Dp[0][ri]
          for (let n = 1; n <= HARM; n++) {
            const t = cn * c1 - sn * s1
            sn = sn * c1 + cn * s1
            cn = t
            s += S[2 * n - 1][ri] * cn + S[2 * n][ri] * sn
            disp += Dp[2 * n - 1][ri] * cn + Dp[2 * n][ri] * sn
          }
          const i = (y * W + x) * 4
          if (disp) {
            const sx = Math.max(0, Math.min(W - 1, Math.round(x + dx / (rr || 1) * disp)))
            const sy = Math.max(0, Math.min(H - 1, Math.round(y + dy / (rr || 1) * disp)))
            const j = (sy * W + sx) * 4
            d[i] = src[j]
            d[i + 1] = src[j + 1]
            d[i + 2] = src[j + 2]
          }
          if (s > 0) {
            s = Math.min(1, s)
            for (let ch = 0; ch < 3; ch++) {
              const p = src[i + ch]
              const lap = 4 * p - src[i + ch - 4] - src[i + ch + 4] - src[i + ch - 4 * W] - src[i + ch + 4 * W]
              const m = SHARP_MAX * Math.min(1, Math.max(0.15, (192 - p) / 128))
              d[i + ch] = d[i + ch] + Math.max(-m, Math.min(m, s * (SHARP * lap + LIFT * p)))
            }
          }
          sum += Math.abs(d[i] - src[i]) + Math.abs(d[i + 1] - src[i + 1]) + Math.abs(d[i + 2] - src[i + 2])
        }
      }
      Warp.change = sum / (3 * W * H)
      g.putImageData(img, box.x, box.y)
      return used
    }
  }

  // ---- The pane --------------------------------------------------------

  // The pane's parts, in pixels, at text size T (decision 0036): the
  // atom, the level diagram, the spectrum and the captions' places. The
  // top 24 pixels at T 1 hold the mode's drop-down at the left
  // (app/viz/layout.js), the bottom 18 its label. An atom smaller than
  // SMALL a side has no room for captions over its cloud: the pane is
  // small, and a band of two rows above the atom holds the jump's
  // caption and the ensemble's, with nothing written over the atom.
  const SMALL = 240
  function regions (w, h, T = 1) {
    const narrow = w < 480 * T
    const bottom = Math.round(18 * T)
    const button = 4 + Math.round(20 * T)
    const sh = Math.round(Math.max(34 * T, Math.min(84, h * 0.17)))
    const spec = { x: 8, y: h - bottom - sh, w: w - 16, h: sh }
    const parts = top => {
      const body = { x: 0, y: top, w, h: spec.y - top - 6 }
      if (w >= 1.15 * body.h) {
        const aw = Math.round(Math.min(w * 0.52, body.h * 1.25))
        return { atom: { x: 0, y: body.y, w: aw, h: body.h }, diag: { x: aw, y: body.y, w: w - aw - 6, h: body.h } }
      }
      const ah = Math.round(body.h * 0.55)
      return { atom: { x: 0, y: body.y, w, h: ah }, diag: { x: 0, y: body.y + ah, w: w - 6, h: body.h - ah } }
    }
    const top = Math.round(narrow ? button + 20 * T : button + 2)
    let r = parts(top)
    const small = Math.min(r.atom.w, r.atom.h) < SMALL
    if (small) r = parts(top + Math.round(12 * T))
    const cap = narrow ? { x: 8, y: Math.round(button + 12 * T) } : { x: 4 + Math.round(150 * T) + 8, y: button / 2 + 2 }
    const ens = small ? { x: 8, y: Math.round(narrow ? button + 24 * T : button + 8 * T) } : null
    return { atom: r.atom, diag: r.diag, spec, cap, ens, narrow, small }
  }

  const inside = (b, x, y) => b && x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h

  function cpu (w, h) {
    const c = document.createElement('canvas')
    c.width = Math.max(1, w)
    c.height = Math.max(1, h)
    return { c, g: c.getContext('2d', { willReadFrequently: true }) }
  }

  // The atom's pixels a bohr, in an atom box a: the view's radius to its
  // nearer side, 6 pixels in.
  const kOf = a => Math.max(10, Math.min(a.w, a.h) / 2 - 6) / VIEW
  // The scale bar's length, bohr, at k pixels a bohr in an atom w pixels
  // wide: a tenth of the width or more.
  const STEPS = [1, 2, 5, 10, 20, 50]
  const barStep = (k, w) => STEPS.find(s => s * k >= w * 0.1) || 50
  // The backdrop's grid spacing, bohr: the least of STEPS that divides the
  // scale bar's length and is GRID_PX pixels or more, so the bar spans
  // whole cells.
  const gridStep = (k, w) => {
    const bar = barStep(k, w)
    return STEPS.find(s => bar % s === 0 && s * k >= GRID_PX) || bar
  }

  const COLS = ['1even', '1odd', '3even', '3odd', '5odd']
  const COL_NAME = ['singlet', 'singlet' + ODD, 'triplet', 'triplet' + ODD, 'quintet' + ODD]
  const colOf = lv => COLS.indexOf(lv.term[0] + lv.parity)

  // env.text(): the visualization text size, a factor (decision 0036).
  function create (canvas, env) {
    // Composed on a canvas of the CPU and blitted once, as the other
    // procedural modes are.
    const out = canvas.getContext('2d')
    // The text size this layout was made at, and a font of n pixels at
    // it.
    let T = 1
    const font = n => n * T + 'px ' + MONO
    let layer = null
    let diagC = null
    let specC = null
    let backdrop = null
    // The invisible fronts' pass's mean change of this pane's atom, last
    // frame: Warp is shared by every pane.
    let warped = 0
    let R = null
    let ow = 0
    let oh = 0
    const mark = {}
    const levels = D.levels
    const lines = D.lines
    graph()
    const counts = new Float64Array(lines.length)
    const flash = new Float64Array(lines.length)
    let now = 0
    // The ensemble at rest in the ground term, J by its thermal
    // populations, and the one atom drawn, atoms[0].
    const atoms = Ensemble.make(N_ATOMS, () => thermal(Math.random()))
    atoms[0].O = IDENTITY
    let entered = 0
    let last = null
    let cause = { text: 'at rest in the ground term', t: -10 }
    let fronts = []
    let dots = []
    let src = null
    let cl = null
    // The drawn atom's axis as last drawn, [x0, y0, x1, y1] on the pane.
    let axisLine = null
    const view = VIEW
    let field = 0
    const born = []
    // The camera's turn about the vertical and its height, the time the
    // pointer last turned it, and the press while the pointer is down.
    const cam = { yaw: 0.4, pitch: 0.32, held: -1e9 }
    let press = null
    const tally = { clicks: 0, turns: 0, excitations: 0, photons: 0, detected: 0, fields: 0, pulses: 0 }
    // The magnetic field: tesla, degrees from z toward x, and its unit
    // direction, in the x-z plane: every excitation here is round about
    // z, so B's azimuth about z changes nothing. The detector looks along
    // y, perpendicular to z and to B, where an aligned atom's beat is
    // deepest.
    const mag = { T: B_START, deg: DEG_START, u: null }
    const toward = deg => [Math.sin(deg * Math.PI / 180), 0, Math.cos(deg * Math.PI / 180)]
    mag.u = toward(mag.deg)
    const DETECTOR = [0, 1, 0]
    const pulseLevel = levels.findIndex(l => l.id === PULSE_LEVEL)
    const filter = downs[pulseLevel].filter(k => visible(lines[k])).sort((a, b) => lines[b].branch - lines[a].branch)[0]
    // The rate at the detector, sampled: emission times t and rates r,
    // the last sample's time, and the last pulse, { t, n }.
    const trace = { t: [], r: [], last: 0 }
    let pulsed = null
    // When the drawn atom was last lifted, its axis set anew.
    let lifted = 0

    // ---- The ensemble's state ----

    // The drawn atom changed at time t: its cloud's particles move to
    // the new level's density. Returns the slots whose orbital changed.
    function redraw (why, t = now) {
      const a = atoms[0]
      const moved = Cloud.to(cl, levels[a.lv], a.M)
      entered = t
      if (why) cause = { text: why, t }
      return moved
    }

    // Atom i's axis, and the drawn atom's frame, carried to time t at
    // its present level's rate: before its level or the field changes.
    function settle (i, t) {
      const a = atoms[i]
      if (i === 0) a.O = Larmor.frame(a, t, mag)
      a.n = Larmor.axis(a, t, mag)
      a.t0 = t
    }

    // Atom i to level k by a collision at time t, its M_L drawn anew about
    // z, its axis z turned about B by a random phase: collisions come
    // incoherently, so atoms lifted at one instant do not precess in
    // step.
    function lift (i, k, why, t = now) {
      const a = atoms[i]
      if (k < 0 || k === a.lv) return
      const L = Lof(levels[k])
      a.lv = k
      a.M = Math.floor(Math.random() * (2 * L + 1)) - L
      const ph = 2 * Math.PI * Math.random()
      a.n = mag.T ? unit(turnAbout(mag.u, ph, Z)) : Z
      a.t0 = t
      if (i === 0) {
        a.O = mag.T ? rotation(mag.u, ph) : IDENTITY
        lifted = t
      }
      tally.excitations++
      if (i === 0) redraw(why, t)
    }

    // The field's collision at time t: any radiating level above, by
    // weight g.
    function excite (i, t = now) {
      const up = targets(atoms[i].lv)
      if (up.length) lift(i, pick(up, k => levels[k].g, Math.random()), 'the field: electron collision', t)
    }

    // Atom i jumps down by line k at time t, and its front leaves with
    // the pattern of its component about the atom's axis then.
    function jump (i, k, t = now) {
      const a = atoms[i]
      const ln = lines[k]
      settle(i, t)
      const q = Ensemble.q(a, ln)
      const L = Lof(levels[ln.l])
      a.M = Math.max(-L, Math.min(L, a.M - q))
      a.lv = ln.l
      tally.photons++
      born.push(t)
      fronts.push(Front.make(k, ln, q, t, a.n))
      if (fronts.length > FRONTS) detect(fronts.shift(), null)
      if (i === 0) {
        const mv = mover(levels[ln.u], levels[ln.l])
        last = { k, q, waited: t - entered, t }
        const moved = redraw(null, t)
        // The flash rides on the slots the line moves: the one whose
        // orbital changed, or within 2s2.2p2 the raised slot.
        const slots = moved.length ? moved : [5]
        const n = slots.reduce((s, j) => s + Cloud.SLOT_AT[j + 1] - Cloud.SLOT_AT[j], 0)
        src = { sign: mv ? sourceSign(mv, q) : null, slots, ink: Math.min(1, SOURCE_PTS / n), t, k, q }
      }
    }

    // A pulse of light linearly polarized along z, two photons: every
    // atom in the ground term 3P to 2p4p 3P2 at once, each left in M_L =
    // 0 about z, aligned, its axis z. A model of the alignment such a
    // pulse makes, at its largest. All precess in step, so the light at
    // the detector beats at twice the Larmor rate.
    function pulse () {
      let n = 0
      for (let i = 0; i < atoms.length; i++) {
        const a = atoms[i]
        if (!ground(levels[a.lv])) continue
        a.lv = pulseLevel
        a.M = 0
        a.n = Z
        a.t0 = now
        if (i === 0) {
          a.O = IDENTITY
          lifted = now
          redraw(null)
        }
        n++
      }
      tally.excitations += n
      tally.pulses++
      pulsed = { t: now, n }
      cause = { text: 'pulse: ' + n + ' atoms to ' + levelName(levels[pulseLevel]) + ', aligned along z', t: now }
    }

    // The field set on the dial: every atom settled under the old one.
    function setField (tesla, deg) {
      if (tesla === mag.T && deg === mag.deg) return
      for (let i = 0; i < atoms.length; i++) settle(i, now)
      mag.T = tesla
      mag.deg = deg
      mag.u = toward(deg)
      tally.fields++
    }

    // The rate at the detector from the ensemble's state, sampled every
    // TRACE_DT up to time t1: each atom in the filter line's upper level,
    // the line's A on the event clock times its photon's angular density
    // toward y over the isotropic one, times the detector's share DETECT
    // of the sphere: the rate a detector there counts, its expectation.
    // A pulse sends such a detector under one photon of the line, whose
    // count would show the beat only folded over many pulses; this is
    // what that count converges to.
    function sample (t1) {
      if (t1 - trace.last > 2 * TRACE_T) trace.last = t1 - 2 * TRACE_T
      const live = []
      const ln = lines[filter]
      for (const a of atoms) {
        if (a.lv !== ln.u) continue
        const lv = levels[a.lv]
        const w = 2 * Math.PI * Larmor.rate(lv, mag)
        // n's y component at time t: n_y cos + (u x n)_y sin + u_y (u.n)
        // (1 - cos) of w (t - t0).
        const n = a.n
        const u = mag.u
        live.push({ k: ln.A / EVENT, p: linePoly(filter, a.M), w, t0: a.t0, c: n[1], s: u[2] * n[0] - u[0] * n[2], d: u[1] * (u[0] * n[0] + u[1] * n[1] + u[2] * n[2]) })
      }
      for (let t = trace.last + TRACE_DT; t <= t1; t += TRACE_DT) {
        let r = 0
        for (const e of live) {
          const th = e.w * (t - e.t0)
          const cs = Math.cos(th)
          const y = e.c * cs + e.s * Math.sin(th) + e.d * (1 - cs)
          const x = y * y
          r += e.k * (e.p[0] + e.p[1] * x + e.p[2] * x * x)
        }
        trace.t.push(t)
        trace.r.push(r * DETECT)
        trace.last = t
      }
      const keep = Math.ceil(3 * TRACE_T / TRACE_DT)
      if (trace.t.length > keep + 200) {
        trace.t.splice(0, trace.t.length - keep)
        trace.r.splice(0, trace.r.length - keep)
      }
    }

    // A front reaches the pane's edge: it is found in one direction,
    // drawn from its pattern, and its line lights.
    function detect (f, F) {
      counts[f.k]++
      flash[f.k] = 1
      tally.detected++
      if (!F) return
      const dir = carry(f.n, detectDir(f.ln.type, f.q))
      const v = F.turn(dir[0], dir[1], dir[2])
      dots.push({ x: F.cx + v.x * F.edge, y: F.cy - v.y * F.edge, z: v.z, fill: f.vis ? f.ln.rgb : '#aab3c5', t: now })
      if (dots.length > 240) dots.shift()
    }

    // A share of the ensemble, always the drawn atom among it.
    function some (share, fn) {
      for (let i = 0; i < atoms.length; i++) if (i === 0 || Math.random() < share) fn(i)
    }

    function collide (confs, share, why) {
      const set = levels.map((l, k) => k).filter(k => confs.includes(levels[k].conf))
      some(share, i => lift(i, pick(set, k => levels[k].g, Math.random()), why))
    }

    // A photon absorbed from the present level, from a lamp of flat
    // spectral energy density: among the absorptions in fifth band of
    // five by the upper level's energy, or among all for band -1.
    function absorb (i, band, why) {
      const all = absorptions(atoms[i].lv)
      if (!all.length) {
        if (i === 0) cause = { text: why + ': no E1 line up from ' + levelName(levels[atoms[0].lv]), t: now }
        return
      }
      let set = all
      if (band >= 0 && band < 5) {
        const a = Math.floor(band * all.length / 5)
        const b = Math.floor((band + 1) * all.length / 5)
        if (b > a) set = all.slice(a, b)
      }
      const k = pick(set, k => lines[k].f * wl(lines[k]), Math.random())
      lift(i, lines[k].u, why + ': absorbed ' + wlText(wl(lines[k])))
    }

    // The session's events, each a pulse on a share of the ensemble,
    // over the field: see decision 0015's table.
    function react (e) {
      if (e.kind === 3) collide(['2s2.2p.4d', '2s2.2p.5s'], 0.25, 'prompt: electron collision')
      else if (e.kind === 4) collide(['2s2.2p.4p'], 0.25, 'stop: electron collision')
      else if (e.kind === 2) some(0.15, i => absorb(i, e.cls >= 0 && e.cls < 5 ? e.cls : -1, 'tool call'))
      else if (e.kind === 5) some(0.1, i => lift(i, levels.findIndex(l => l.id === '2s2p3_5So_2'), 'subagent: spin-exchange collision'))
      else if (e.kind === 6) some(1, i => lift(i, thermal(Math.random()), 'compaction: quenched by a collision, no light'))
      else if (e.kind === 1) {
        some(0.3, i => {
          if (ground(levels[atoms[i].lv])) lift(i, thermal(Math.random()), 'output: a thermal collision')
        })
      }
    }

    // The field's strength from the session's activity: busy, the output
    // and the token rate, nothing while idle.
    const strength = L => Math.max(0, Math.min(1, 0.45 * L.busy + 0.35 * Math.min(1, L.bass) + 0.2 * Math.min(1, L.treble))) * (1 - L.idle)

    // ---- Drawing ----

    // ---- Drawing ----

    // Every text the pane draws, as its ink box in the pane's pixels:
    // the diagram's and the spectrum's, drawn once a resize, in still,
    // and the frame's in said.
    // A text that would run off its canvas is moved in. A text placed
    // only where it fits overlaps no text placed before it, with a pixel
    // to spare.
    let still = []
    let said = []
    function box (g, t, x, y, ox = 0, oy = 0) {
      const m = g.measureText(t)
      const l = m.actualBoundingBoxLeft
      const r = m.actualBoundingBoxRight
      const W = g.canvas.width
      if (x - l < 1) x = 1 + l
      else if (x + r > W - 1) x = Math.max(1 + l, W - 1 - r)
      return { t, gx: x, gy: y, x: ox + x - l, y: oy + y - m.actualBoundingBoxAscent, w: l + r, h: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent }
    }
    function fits (b) {
      for (const o of still.concat(said)) {
        if (b.x < o.x + o.w + 1 && o.x < b.x + b.w + 1 && b.y < o.y + o.h + 1 && o.y < b.y + b.h + 1) return false
      }
      return true
    }
    function write (g, b, list = said) {
      g.fillText(b.t, b.gx, b.gy)
      list.push(b)
    }
    function say (g, t, x, y, ox = 0, oy = 0, list = said) {
      write(g, box(g, t, x, y, ox, oy), list)
    }
    // Draws t where it overlaps no text before it, or not at all.
    function sayIf (g, t, x, y, ox, oy, list) {
      const b = box(g, t, x, y, ox, oy)
      if (fits(b)) write(g, b, list)
    }
    // Draws t at the first of the places [x, y] where it fits, or not at
    // all, and tells whether it drew.
    function place (g, t, at) {
      for (const [x, y] of at) {
        const b = box(g, t, x, y)
        if (fits(b)) {
          write(g, b)
          return true
        }
      }
      return false
    }

    function yOf (E) {
      const d = R.dd
      return d.bot - (d.bot - d.top) * E / D.limit
    }

    const colX = c => R.dd.x0 + c * R.dd.cw

    function drawDiagram () {
      const { diag } = R
      diagC = cpu(diag.w, diag.h)
      const g = diagC.g
      const put = (t, x, y) => sayIf(g, t, x, y, diag.x, diag.y, still)
      const small = diag.w < 260 || diag.h < 200
      const left = Math.round((small ? 30 : 46) * T)
      const dd = { top: Math.round(16 * T), bot: diag.h - Math.round((small ? 14 : 26) * T), x0: left, cw: (diag.w - left - 6) / 5 }
      R.dd = dd
      g.font = font(10)
      g.textBaseline = 'middle'
      // The ionization limit, dashed.
      g.strokeStyle = '#7d89a1'
      g.setLineDash([5, 4])
      g.beginPath()
      g.moveTo(dd.x0 - 4, dd.top)
      g.lineTo(diag.w - 4, dd.top)
      g.stroke()
      g.setLineDash([])
      g.fillStyle = '#7d89a1'
      g.textAlign = 'right'
      put((small ? 'limit ' : 'ionization limit ') + D.limitEV.toFixed(2) + ' eV', diag.w - 6, dd.top - 8 * T)
      // The energy axis in eV.
      g.strokeStyle = '#1f2838'
      g.beginPath()
      g.moveTo(dd.x0 - 6, dd.top)
      g.lineTo(dd.x0 - 6, dd.bot)
      g.stroke()
      const perEV = D.limit / D.limitEV
      // Every 2 eV, or 5 in a small diagram, or wider where the labels'
      // rows would meet.
      const pxEV = (dd.bot - dd.top) / D.limitEV
      const step = (small ? [5, 10] : [2, 5, 10]).find(s => s * pxEV >= 14 * T) || 10
      for (let e = 0; e <= 10; e += step) put(e + (small ? '' : ' eV'), dd.x0 - 9, yOf(e * perEV))
      g.textAlign = 'center'
      if (!small) COL_NAME.forEach((n, c) => put(n, colX(c) + dd.cw / 2, dd.bot + 13 * T))
      // The Rydberg ladders, faint, toward the limit.
      g.strokeStyle = '#2b3446'
      for (const r of D.rydberg) {
        const c = r.series.startsWith('2pnp') ? 2 : 3
        const y = Math.round(yOf(r.E)) + 0.5
        g.beginPath()
        g.moveTo(colX(c) + dd.cw * 0.25, y)
        g.lineTo(colX(c) + dd.cw * 0.65, y)
        g.stroke()
      }
      // Every level, its fine structure within a pixel.
      g.strokeStyle = '#4d5b77'
      g.lineWidth = 1.5
      for (const lv of levels) {
        const y = Math.round(yOf(lv.E)) + 0.5
        g.beginPath()
        g.moveTo(colX(colOf(lv)) + 3, y)
        g.lineTo(colX(colOf(lv)) + dd.cw - 5, y)
        g.stroke()
      }
      g.lineWidth = 1
      // The ground term's fine structure, magnified, in the triplet
      // columns' empty band between 1.2 and 6 eV, where that band is
      // tall enough to part the labels of J = 0 and 1 by a row.
      R.inset = null
      const iy = Math.round(yOf(6 * perEV))
      const ih = Math.round(Math.min(yOf(1.2 * perEV) - iy, 96 * T))
      if (diag.h >= 140 && ih >= 64 * T) {
        const ix = Math.round(colX(2) + 4)
        const iw = Math.round(Math.min(dd.cw * 2 - 8, 130 * T))
        const gl = levels.filter(ground)
        const span = gl[gl.length - 1].E
        const inner = ih - 30 * T
        R.inset = { x: ix, y: iy, w: iw, h: ih, y0: E => iy + ih - 10 * T - inner * E / span }
        g.strokeStyle = '#2e3a50'
        g.strokeRect(ix + 0.5, iy + 0.5, iw, ih)
        g.setLineDash([2, 3])
        g.beginPath()
        g.moveTo(ix + iw / 2, iy + ih)
        g.lineTo(colX(2) + dd.cw / 2, yOf(0) - 2)
        g.stroke()
        g.setLineDash([])
        g.textAlign = 'left'
        g.fillStyle = '#7d89a1'
        const mag = inner / ((dd.bot - dd.top) * span / D.limit)
        put(SUP[3] + 'P ' + TIMES + Math.round(mag), ix + 4, iy + 9 * T)
        for (const lv of gl) {
          const y = Math.round(R.inset.y0(lv.E)) + 0.5
          g.strokeStyle = '#4d5b77'
          g.lineWidth = 1.5
          g.beginPath()
          g.moveTo(ix + 6, y)
          g.lineTo(ix + iw * 0.45, y)
          g.stroke()
          g.lineWidth = 1
          g.fillStyle = '#8c97ad'
          put('J=' + lv.J + (iw > 90 * T ? '  ' + lv.E.toFixed(1) + ' cm' + U(0x207b, 0xb9) : ''), ix + iw * 0.45 + 4, y)
        }
      }
    }

    // The spectrum's axis: log wavelength from LO to HI nm, the visible
    // band marked, every line a faint tick in its colour or grey, and an
    // off-scale bin at the right for the ground term's far-infrared lines.
    const LO = 110
    const HI = 10000
    function specX (nm) {
      const x1 = R.spec.w - 46 * T
      if (nm > HI) return x1 + (26 + (Math.log10(nm) - 5.5) * 24) * T
      return 6 + (x1 - 6) * Math.log(nm / LO) / Math.log(HI / LO)
    }

    function drawSpectrum () {
      const s = R.spec
      specC = cpu(s.w, s.h)
      const g = specC.g
      const put = (t, x, y) => sayIf(g, t, x, y, s.x, s.y, still)
      const base = s.h - Math.round(14 * T)
      R.base = base
      g.fillStyle = '#060a12'
      g.fillRect(0, 0, s.w, s.h)
      // The visible band.
      g.fillStyle = 'rgba(255, 255, 255, 0.05)'
      g.fillRect(specX(380), 2, specX(780) - specX(380), base - 2)
      g.strokeStyle = '#33405a'
      g.beginPath()
      g.moveTo(4, base + 0.5)
      g.lineTo(specX(HI) + 2, base + 0.5)
      g.stroke()
      g.font = font(9)
      g.fillStyle = '#7d89a1'
      g.textBaseline = 'top'
      g.textAlign = 'center'
      const marks = s.w < 330 * T ? [[200, '200 nm'], [1000, '1 ' + MU + 'm']] : [[120, '120 nm'], [200, '200'], [380, '380'], [780, '780'], [2000, '2 ' + MU + 'm'], [5000, '5'], [10000, '10']]
      for (const [nm, t] of marks) {
        g.fillRect(specX(nm), base, 1, 3)
        put(t, specX(nm), base + 3)
      }
      put('far IR', specX(370000), base + 3)
      g.strokeStyle = '#33405a'
      g.strokeRect(Math.round(specX(370000) - 16 * T) - 0.5, 2.5, Math.round(33 * T), base - 3)
      if (s.w >= 330 * T) {
        g.textAlign = 'left'
        put('visible', specX(380) + 2, 3)
      }
      lines.forEach(ln => {
        g.fillStyle = visible(ln) ? ln.rgb : '#3d4860'
        g.globalAlpha = visible(ln) ? 0.6 : 0.8
        g.fillRect(Math.round(specX(wl(ln))), base - 4, 1, 4)
      })
      g.globalAlpha = 1
    }

    // The backdrop under the atom, the picture the invisible fronts
    // sharpen and refract, which on black would show nothing (issue
    // #168): a faint Cartesian grid about the site, its spacing in bohr
    // a whole part of the scale bar's (gridStep), its lines soft, of
    // Gaussian half-width GRID_SIGMA pixels, so a sharpening crisps and
    // brightens them and a shift of a pixel or two bends them, as a
    // lensing grid bends, dimmed toward the corners under the captions.
    // Drawn once a resize.
    function drawBackdrop () {
      const a = R.atom
      backdrop = cpu(a.w, a.h)
      const p = gridStep(kOf(a), a.w) * kOf(a)
      const prof = (n, o) => Float32Array.from({ length: n }, (_, i) => {
        const t = (i + 0.5 - o) / p
        const e = (t - Math.round(t)) * p
        return Math.exp(-e * e / (2 * GRID_SIGMA * GRID_SIGMA))
      })
      const fx = prof(a.w, a.w / 2)
      const fy = prof(a.h, a.h / 2)
      const img = backdrop.g.createImageData(a.w, a.h)
      const d = img.data
      const half = Math.min(a.w, a.h) / 2
      for (let y = 0; y < a.h; y++) {
        for (let x = 0; x < a.w; x++) {
          const u = Math.min(1, Math.max(0, (Math.hypot(x + 0.5 - a.w / 2, y + 0.5 - a.h / 2) / half - GRID_IN) / (1 - GRID_IN)))
          const v = Math.max(fx[x], fy[y]) * (1 - (1 - GRID_OUT) * u)
          const i = (y * a.w + x) * 4
          for (let ch = 0; ch < 3; ch++) d[i + ch] = GRID_FLOOR[ch] + v * (GRID_INK[ch] - GRID_FLOOR[ch])
          d[i + 3] = 255
        }
      }
      backdrop.g.putImageData(img, 0, 0)
    }

    function resize (w, h) {
      layer = cpu(w, h)
      R = regions(w, h, T)
      still = []
      said = []
      drawDiagram()
      drawSpectrum()
      drawBackdrop()
    }

    // Squares batched by fill and alpha, one path a batch: on a canvas
    // of the CPU a call costs more than its few pixels.
    const batch = new Map()
    function rect (fill, a, x, y, s) {
      const k = Math.min(20, Math.round(a * 20))
      if (k <= 0) return
      let bins = batch.get(fill)
      if (!bins) {
        bins = []
        batch.set(fill, bins)
      }
      ;(bins[k] || (bins[k] = [])).push(x - s / 2, y - s / 2, s)
    }
    function flush (g) {
      for (const [fill, bins] of batch) {
        g.fillStyle = fill
        for (let k = 1; k < bins.length; k++) {
          const b = bins[k]
          if (!b || !b.length) continue
          g.globalAlpha = k / 20
          g.beginPath()
          for (let i = 0; i < b.length; i += 3) g.rect(b[i], b[i + 1], b[i + 2], b[i + 2])
          g.fill()
          b.length = 0
        }
      }
      if (batch.size > 64) batch.clear()
      g.globalAlpha = 1
    }
    // The atom's frame on screen this frame. Its z axis is the axis M_L
    // and the fronts' components are taken about.
    const F = { cx: 0, cy: 0, k: 1, edge: 1, upZ: 1, project: null, turn: null }
    const P = { x: 0, y: 0, s: 1 }
    const Q = { x: 0, y: 0, z: 0 }
    let B = [1, 0, 0, 0, 1, 0, 0, 0]
    F.turn = (x, y, z) => {
      Q.x = x * B[0] + y * B[1]
      Q.y = x * B[2] + y * B[3] + z * B[4]
      Q.z = x * B[5] + y * B[6] + z * B[7]
      return Q
    }
    F.project = (x, y, z) => {
      const v = F.turn(x, y, z)
      const d = 4 * view
      const s = d / (d - v.z)
      P.x = F.cx + v.x * F.k * s
      P.y = F.cy - v.y * F.k * s
      P.s = s
      return P
    }

    function frame (w, h) {
      const a = R.atom
      F.cx = a.x + a.w / 2
      F.cy = a.y + a.h / 2
      F.k = kOf(a)
      F.edge = Math.min(F.cx, F.cy, w - F.cx, h - F.cy)
      const cy = Math.cos(cam.yaw)
      const sy = Math.sin(cam.yaw)
      const cp = Math.cos(cam.pitch)
      const sp = Math.sin(cam.pitch)
      B = [-sy, cy, -sp * cy, -sp * sy, cp, cp * cy, cp * sy, sp]
      F.upZ = cp
    }

    function drawAtom (g, dim) {
      const a = R.atom
      g.save()
      g.beginPath()
      g.rect(a.x, a.y, a.w, a.h)
      g.clip()
      g.drawImage(backdrop.c, a.x, a.y)
      // A faint equator and meridian, for depth.
      g.strokeStyle = '#1d2638'
      g.setLineDash([3, 5])
      for (const ring of [0, 1]) {
        g.beginPath()
        for (let j = 0; j <= 64; j++) {
          const t = 2 * Math.PI * j / 64
          const r = 0.92 * view
          const p = ring ? F.project(r * Math.cos(t), 0, r * Math.sin(t)) : F.project(r * Math.cos(t), r * Math.sin(t), 0)
          if (j) g.lineTo(p.x, p.y)
          else g.moveTo(p.x, p.y)
        }
        g.stroke()
      }
      g.setLineDash([])
      g.globalCompositeOperation = 'lighter'
      // The drawn atom's cloud, dimmed while its jump's source flashes
      // over it, mint where psi_f* psi_i is positive, pink where negative.
      const flashing = src && src.sign && now - src.t < SOURCE_T
      const lit = flashing ? { slots: src.slots, sign: src.sign, a: (1 - (now - src.t) / SOURCE_T) * src.ink } : null
      Cloud.draw(cl, F, a, flashing ? 0.45 * dim : dim, rect, Larmor.frame(atoms[0], now, mag), lit)
      const c = F.project(0, 0, 0)
      rect('#ffffff', 1, c.x, c.y, 2)
      flush(g)
      g.restore()
      // The fronts in their hue over the pane, the detections, then the
      // invisible fronts' pass over the atom's pixels.
      g.save()
      g.globalCompositeOperation = 'lighter'
      Front.draw(g, fronts, F, now)
      dots = dots.filter(d => now - d.t < 0.6)
      for (const d of dots) rect(d.fill, 1 - (now - d.t) / 0.6, d.x, d.y, 2.5 + 1.5 * (0.5 + 0.5 * d.z))
      flush(g)
      g.restore()
      Warp.apply(g, fronts, F, a, now)
      warped = Warp.change
    }

    function labels (g) {
      const a = R.atom
      const ax = atoms[0]
      const lv = levels[ax.lv]
      // The axis, dashed through the atom.
      const top = F.project(0, 0, 1.15 * view)
      const tx = top.x
      const ty = top.y
      const bot = F.project(0, 0, -1.15 * view)
      g.strokeStyle = '#5d6780'
      g.setLineDash([2, 4])
      g.beginPath()
      g.moveTo(tx, ty)
      g.lineTo(bot.x, bot.y)
      g.stroke()
      g.setLineDash([])
      // B, solid violet through the atom, its arrow at +B.
      let tip = null
      if (mag.T) {
        const u = mag.u
        const e = 1.15 * view
        const p0 = F.project(-u[0] * e, -u[1] * e, -u[2] * e)
        const x0 = p0.x
        const y0 = p0.y
        const p1 = F.project(u[0] * e, u[1] * e, u[2] * e)
        tip = { x: p1.x, y: p1.y }
        g.strokeStyle = '#b48cff'
        g.fillStyle = '#b48cff'
        g.lineWidth = 1.5
        g.beginPath()
        g.moveTo(x0, y0)
        g.lineTo(tip.x, tip.y)
        g.stroke()
        const an = Math.atan2(tip.y - y0, tip.x - x0)
        g.beginPath()
        g.moveTo(tip.x, tip.y)
        g.lineTo(tip.x - 8 * Math.cos(an - 0.4), tip.y - 8 * Math.sin(an - 0.4))
        g.lineTo(tip.x - 8 * Math.cos(an + 0.4), tip.y - 8 * Math.sin(an + 0.4))
        g.fill()
        g.lineWidth = 1
      }
      // The drawn atom's axis, cyan: the axis of its M_L and of its next
      // photon's pattern, turning about B.
      const n = Larmor.axis(ax, now, mag)
      const e = 0.7 * view
      const q0 = F.project(-n[0] * e, -n[1] * e, -n[2] * e)
      const nx = q0.x
      const ny = q0.y
      const q1 = F.project(n[0] * e, n[1] * e, n[2] * e)
      axisLine = [nx, ny, q1.x, q1.y]
      g.strokeStyle = 'rgba(111, 227, 255, 0.8)'
      g.lineWidth = 1.5
      g.beginPath()
      g.moveTo(nx, ny)
      g.lineTo(q1.x, q1.y)
      g.stroke()
      g.lineWidth = 1
      // The detector, along y on the circle where fronts are detected.
      const dv = F.turn(DETECTOR[0], DETECTOR[1], DETECTOR[2])
      const det = { x: F.cx + dv.x * F.edge * 0.96, y: F.cy - dv.y * F.edge * 0.96 }
      g.strokeStyle = '#e8eefc'
      g.strokeRect(Math.round(det.x) - 3.5, Math.round(det.y) - 3.5, 7, 7)
      g.font = font(10)
      g.textAlign = 'left'
      g.textBaseline = 'alphabetic'
      if (R.small) return
      const o = shells(lv).find(e => e.outer)
      const rows = [['#e8eefc', levelName(lv) + '  M_L=' + ax.M + (cl.round ? ', round' : '')]]
      const tau = tauScreen(lv)
      rows.push(['#8c97ad', ground(lv) ? 'ground term, at rest' : TAU + ' ' + timeText(lv.tau) + ', ' + timeText(tau) + ' on the event clock'])
      const fieldRows = [['#b48cff', fieldText()], ['#b48cff', turnText(lv)]]
      if (lv.gJ) fieldRows.push(['#9a86c4', 'g_J ' + (lv.gJsrc === 'measured' ? lv.gJ + ', measured' : lv.gJ.toFixed(4) + ', LS: a model') + ', cyan its axis'])
      rows.push(...fieldRows)
      if (o) rows.push(['#ffcf7a', o.nl + ' cloud: a model, <r> ' + D.outer[o.key].meanR.toFixed(1) + ' ' + A0])
      if (now - cause.t < 4) rows.push(['#9fb7e0', cause.text])
      if (last && now - last.t < 3) {
        const ln = lines[last.k]
        rows.push(['#c9d3e6', 'its photon ' + DELTA + 'M=' + (last.q > 0 ? '+' : '') + last.q + ' ' + ln.type + ', ' + patternName(ln.type, last.q), visible(ln) ? ln.rgb : '#aab3c5'])
        rows.push(['#8c97ad', src && src.sign ? 'source: ' + PSI + 'f*' + PSI + 'i, + mint, - pink' : 'source: a two-electron jump, not drawn'])
        // Its true lengths and period, in vacuum: no crest in the view.
        const vac = wlText(ln.vac) + ' vac = ' + Math.round(ln.vac / (size(levels[ln.u]) * D.bohrNm)) + TIMES + ' this atom'
        const many = Math.round(Front.lambda(ln) / view) + TIMES + ' the view'
        rows.push(['#8c97ad', [vac + ', ' + many + ': in phase across it', vac + ', ' + many, vac]])
        rows.push(['#8c97ad', ['a period ' + timeText(Front.period(ln)) + ' on the light clock, no crest in view', 'period ' + timeText(Front.period(ln)) + ' on the light clock']])
      }
      const rate = born.length
      const rest = [
        ['#7d89a1', ENSEMBLE[0]],
        ['#7d89a1', 'events: NIST rates / ' + sci(EVENT) + ', light: c / ' + sci(LIGHT) + ' = ' + Clock.light.toFixed(1) + ' ' + A0 + '/s'],
        ['#7d89a1', 'field ' + Math.round(100 * field) + '%, ' + rate + ' photons/s, ' + fronts.length + ' fronts'],
        ['#7d89a1', ['fronts: an edge and a trail ' + LAM + ' / ' + sci(TRAIL) + ' long, ' + LAM + ' in vacuum', 'fronts: edge, trail ' + LAM + ' / ' + sci(TRAIL), 'trail ' + LAM + ' / ' + sci(TRAIL)]]
      ]
      const fit = a.w - 14
      // A narrower atom keeps the level, its clock, its photon and the
      // rate. Each row, then the axis's name, then the scale bar, is
      // written where it overlaps no text before it, or left out.
      const keep = a.w < 320 * T ? [rows[0], rows[1], ...fieldRows.slice(0, 2), ...rows.filter(r => r[2]), rest[2], rest[3]] : rows.concat(rest)
      let j = 0
      for (const [col, t, swatch] of keep) {
        const y = a.y + (11 + 12 * j) * T
        const x = a.x + 8 + (swatch ? 11 * T : 0)
        const room = fit - (x - a.x - 8)
        const ts = Array.isArray(t) ? t : [t]
        const b = box(g, clip(g, ts.find(v => g.measureText(v).width <= room) || ts[ts.length - 1], room), x, y)
        if (!fits(b)) continue
        if (swatch) {
          g.fillStyle = swatch
          g.fillRect(a.x + 8, y - 7 * T, 7 * T, 7 * T)
        }
        g.fillStyle = col
        write(g, b)
        j++
      }
      g.fillStyle = '#7d89a1'
      place(g, 'z, chosen', [[tx + 4, Math.max(a.y + 10 * T, ty)]])
      if (tip) {
        g.fillStyle = '#b48cff'
        place(g, 'B', [[tip.x + 5, tip.y + 4 * T], [tip.x - 12 * T, tip.y + 4 * T]])
      }
      g.fillStyle = '#c9d3e6'
      place(g, 'detector, y', [[det.x + 7, det.y + 4 * T], [det.x - 7 - 66 * T, det.y + 4 * T], [det.x - 30 * T, det.y - 7 * T]])
      // A scale bar, drawn only with its label.
      const step = barStep(F.k, a.w)
      const bx = a.x + 10
      const by = a.y + a.h - 6
      if (place(g, step + ' ' + A0 + ' = ' + (step * D.bohrNm).toFixed(2) + ' nm', [[bx, by - 4]])) g.fillRect(bx, by, step * F.k, 1)
    }

    // The field's statements: the field, and the drawn atom's precession.
    const mT = t => (t * 1e3).toFixed(2) + ' mT'
    const alongZ = () => mag.deg % 180 === 0
    function hz (f) {
      if (f >= 1e6) return (f / 1e6).toPrecision(3) + ' MHz'
      if (f >= 1e3) return (f / 1e3).toPrecision(3) + ' kHz'
      return f.toPrecision(3) + ' Hz'
    }
    // Each a list, longest first, for the atom's width.
    function fieldText () {
      if (!mag.T) return ['B 0: no field']
      if (alongZ()) return ['B ' + mT(mag.T) + ' along z']
      const t = 'B ' + mT(mag.T) + ' at ' + Math.abs(mag.deg) + DEG + ' to z'
      return [t + ', in the x-z plane', t]
    }
    function turnText (lv) {
      if (!lv.gJ) return ['J = 0: no magnetic moment, no precession', 'J = 0: no precession']
      if (!mag.T) return ['no field: nothing precesses']
      if (alongZ()) {
        const n = Larmor.axis(atoms[0], now, mag)
        return Math.abs(n[2]) > 1 - 1e-9 ? ['an M state about B is stationary: nothing turns', 'M about B is stationary: no turn'] : ['tilted before B was set, it turns until a collision', 'tilted before, turns till a collision']
      }
      const f = Larmor.rate(lv, mag)
      return ['turns about B at ' + hz(f) + ' on screen, ' + hz(f * EVENT) + ' real', 'turns ' + hz(f) + ' on screen, ' + hz(f * EVENT) + ' real', hz(f) + ' on screen, ' + hz(f * EVENT) + ' real']
    }

    // The dial, the pulse button and the detector's trace, along the
    // atom's lower right, drawn last: R.dial { x, y, r }, R.pulse and
    // R.trace boxes, or null. A small pane keeps the dial alone, with no
    // text over its atom.
    function controls (g) {
      const a = R.atom
      const r = Math.round((R.small ? 11 : 18) * T)
      const d = { x: a.x + a.w - r - 8, y: a.y + a.h - r - 8, r }
      R.dial = d
      R.pulse = null
      R.trace = null
      g.save()
      g.fillStyle = 'rgba(3, 5, 10, 0.75)'
      g.beginPath()
      g.arc(d.x, d.y, r + 2, 0, 2 * Math.PI)
      g.fill()
      g.strokeStyle = '#4b3d6e'
      g.beginPath()
      g.arc(d.x, d.y, r, 0, 2 * Math.PI)
      g.stroke()
      g.strokeStyle = '#2e3a50'
      g.beginPath()
      g.moveTo(d.x, d.y + r)
      g.lineTo(d.x, d.y - r)
      g.stroke()
      // B on the dial: its angle from z, up, its length the square root
      // of its share of B_MAX.
      const len = r * Math.sqrt(mag.T / B_MAX)
      const th = mag.deg * Math.PI / 180
      g.strokeStyle = '#b48cff'
      g.fillStyle = '#b48cff'
      g.lineWidth = 2
      g.beginPath()
      g.moveTo(d.x, d.y)
      g.lineTo(d.x + len * Math.sin(th), d.y - len * Math.cos(th))
      g.stroke()
      g.fillRect(d.x + len * Math.sin(th) - 2, d.y - len * Math.cos(th) - 2, 4, 4)
      g.restore()
      if (R.small) return
      g.font = font(10)
      g.textBaseline = 'middle'
      g.textAlign = 'center'
      const ph = Math.round(15 * T)
      const pw = Math.round(44 * T)
      const pb = { x: d.x - r - 8 - pw, y: Math.round(d.y - ph / 2), w: pw, h: ph }
      const label = box(g, 'pulse', pb.x + pw / 2, pb.y + ph / 2)
      if (fits(label)) {
        g.fillStyle = '#1a1430'
        g.fillRect(pb.x, pb.y, pb.w, pb.h)
        g.strokeStyle = '#b48cff'
        g.strokeRect(pb.x + 0.5, pb.y + 0.5, pb.w - 1, pb.h - 1)
        g.fillStyle = '#e8eefc'
        write(g, label)
        R.pulse = pb
      }
      const tw = Math.round(Math.min(150 * T, a.w * 0.4))
      const tht = Math.round(36 * T)
      if (a.w < 260 * T || a.h < 200 * T) return
      const tb = { x: pb.x - 8 - tw, y: a.y + a.h - 8 - tht, w: tw, h: tht }
      R.trace = tb
      drawTrace(g, tb)
    }

    // The rate at the detector over the last TRACE_T of detection time,
    // a sample detected R / c after its emission, R the circle's radius:
    // each pixel column its samples' least and largest rate, scaled to
    // the window's largest. A pulse in the window is ticked in violet.
    function drawTrace (g, tb) {
      const delay = F.edge / F.k / Clock.light
      const t1 = now - delay
      const t0 = t1 - TRACE_T
      g.save()
      g.fillStyle = 'rgba(3, 5, 10, 0.75)'
      g.fillRect(tb.x, tb.y, tb.w, tb.h)
      g.strokeStyle = '#2e3a50'
      g.strokeRect(tb.x + 0.5, tb.y + 0.5, tb.w - 1, tb.h - 1)
      const ts = trace.t
      const rs = trace.r
      let i = ts.length
      while (i > 0 && ts[i - 1] >= t0) i--
      let top = 0
      for (let k = i; k < ts.length && ts[k] <= t1; k++) top = Math.max(top, rs[k])
      if (top > 0) {
        const lo = new Float32Array(tb.w).fill(Infinity)
        const hi = new Float32Array(tb.w).fill(-Infinity)
        for (let k = i; k < ts.length && ts[k] <= t1; k++) {
          const c = Math.min(tb.w - 1, Math.floor((ts[k] - t0) / TRACE_T * tb.w))
          lo[c] = Math.min(lo[c], rs[k])
          hi[c] = Math.max(hi[c], rs[k])
        }
        g.strokeStyle = '#c9d3e6'
        g.beginPath()
        const yOfR = v => tb.y + tb.h - 2 - (tb.h - 4) * v / top
        for (let c = 0; c < tb.w; c++) {
          if (lo[c] === Infinity) continue
          g.moveTo(tb.x + c + 0.5, yOfR(hi[c]) - 0.5)
          g.lineTo(tb.x + c + 0.5, yOfR(lo[c]) + 0.5)
        }
        g.stroke()
      }
      const shown = pulsed && pulsed.t >= t0 && pulsed.t <= t1
      if (shown) {
        g.fillStyle = '#b48cff'
        g.fillRect(Math.round(tb.x + (pulsed.t - t0) / TRACE_T * tb.w), tb.y + 1, 1, tb.h - 2)
      }
      g.restore()
      g.font = font(10)
      g.textAlign = 'left'
      g.textBaseline = 'middle'
      g.fillStyle = '#8c97ad'
      place(g, 'detector y, ' + wlText(wl(lines[filter])) + ', last ' + TRACE_T + ' s', [[tb.x, tb.y - 7 * T]])
      const f2 = 2 * Larmor.rate(levels[pulseLevel], mag)
      g.fillStyle = shown ? '#b48cff' : '#7d89a1'
      const status = !shown ? 'no pulse: M incoherent, no beat' : f2 && !alongZ() ? 'pulse: beat at 2f = ' + hz(f2) : 'pulse: B along z or 0, no beat'
      place(g, status, [[tb.x, tb.y - 19 * T]])
    }

    function clip (g, t, w) {
      if (g.measureText(t).width <= w) return t
      while (t.length > 4 && g.measureText(t + DOTS).width > w) t = t.slice(0, -1)
      return t + DOTS
    }

    function drawDiagramNow (g) {
      const d = R.diag
      g.drawImage(diagC.c, d.x, d.y)
      const cw = R.dd.cw
      // The ensemble's populations: each level's bar as bright as its
      // share of the atoms.
      const pop = new Float32Array(levels.length)
      for (const a of atoms) pop[a.lv]++
      g.save()
      g.strokeStyle = '#9fb7e0'
      g.lineWidth = 2
      for (let k = 0; k < levels.length; k++) {
        if (!pop[k]) continue
        const lv = levels[k]
        g.globalAlpha = Math.min(1, 0.25 + 3 * pop[k] / atoms.length)
        const y = Math.round(d.y + yOf(lv.E)) + 0.5
        const x = d.x + colX(colOf(lv))
        g.beginPath()
        g.moveTo(x + 3, y)
        g.lineTo(x + 3 + (cw - 8) * Math.min(1, 0.2 + pop[k] / atoms.length * 2), y)
        g.stroke()
        if (R.inset && ground(lv)) {
          const yy = Math.round(d.y + R.inset.y0(lv.E)) + 0.5
          g.beginPath()
          g.moveTo(d.x + R.inset.x + 6, yy)
          g.lineTo(d.x + R.inset.x + 6 + (R.inset.w * 0.45 - 6) * pop[k] / atoms.length, yy)
          g.stroke()
        }
      }
      g.restore()
      const lv = levels[atoms[0].lv]
      // The drawn atom's last jump: an arrow from the upper level to the
      // lower, in its light's colour, or grey and dashed outside the
      // visible, its wavelength written after the level's name.
      let arrow = null
      if (last && now - last.t < 3) {
        const ln = lines[last.k]
        const up = levels[ln.u]
        const low = levels[ln.l]
        const a = Math.max(0.3, 1 - (now - last.t) / 3)
        const same = colOf(up) === colOf(low)
        const x1 = d.x + colX(colOf(up)) + cw * (same ? 0.35 : 0.5)
        const y1 = d.y + yOf(up.E)
        const x2 = d.x + colX(colOf(low)) + cw * (same ? 0.35 : 0.5)
        const y2 = d.y + yOf(low.E)
        const vis = visible(ln)
        g.save()
        g.globalAlpha = a
        g.strokeStyle = vis ? ln.rgb : '#9aa3b5'
        g.fillStyle = g.strokeStyle
        g.lineWidth = vis ? 2.2 : 1.5
        if (!vis) g.setLineDash([5, 4])
        g.beginPath()
        g.moveTo(x1, y1)
        g.lineTo(x2, y2 - 1)
        g.stroke()
        g.setLineDash([])
        const ang = Math.atan2(y2 - y1, x2 - x1)
        g.beginPath()
        g.moveTo(x2, y2)
        g.lineTo(x2 - 8 * Math.cos(ang - 0.4), y2 - 8 * Math.sin(ang - 0.4))
        g.lineTo(x2 - 8 * Math.cos(ang + 0.4), y2 - 8 * Math.sin(ang + 0.4))
        g.fill()
        arrow = { t: wlText(wl(ln)), fill: g.fillStyle, a, x1, y1, x2, y2 }
        g.restore()
      }
      // The drawn atom's level, lit, and in the inset its J.
      const y = Math.round(d.y + yOf(lv.E)) + 0.5
      const x = d.x + colX(colOf(lv))
      g.strokeStyle = '#ffffff'
      g.lineWidth = 3
      g.beginPath()
      g.moveTo(x + 1, y)
      g.lineTo(x + cw - 3, y)
      g.stroke()
      if (R.inset && ground(lv)) {
        const ins = R.inset
        const yy = Math.round(d.y + ins.y0(lv.E)) + 0.5
        g.lineWidth = 2.5
        g.beginPath()
        g.moveTo(d.x + ins.x + 6, yy)
        g.lineTo(d.x + ins.x + ins.w * 0.45, yy)
        g.stroke()
      }
      g.lineWidth = 1
      g.font = font(10)
      g.textBaseline = 'middle'
      g.fillStyle = '#ffffff'
      const label = levelName(lv)
      const right = x + cw + g.measureText(label).width + 4 < d.x + d.w
      g.textAlign = right ? 'left' : 'right'
      place(g, label, [[right ? x + cw : x - 2, y - 7 * T], [right ? x + cw : x - 2, y + 8 * T]])
      if (arrow && !R.small) {
        const { t, x1, y1, x2, y2 } = arrow
        g.save()
        g.globalAlpha = arrow.a
        g.fillStyle = arrow.fill
        g.textAlign = 'left'
        const tw = g.measureText(t).width
        const at = []
        for (const f of [0.5, 0.35, 0.65, 0.2, 0.8]) {
          const mx = x1 + (x2 - x1) * f
          const my = y1 + (y2 - y1) * f
          at.push([Math.min(d.x + d.w - tw - 2, mx + 6), my], [mx - 6 - tw, my])
        }
        place(g, t, at)
        g.restore()
      }
    }

    function drawSpectrumNow (g, dt) {
      const s = R.spec
      g.drawImage(specC.c, s.x, s.y)
      let top = 1
      for (let k = 0; k < counts.length; k++) top = Math.max(top, counts[k])
      const room = R.base - 6
      g.save()
      for (let k = 0; k < counts.length; k++) {
        if (!counts[k]) continue
        const ln = lines[k]
        const vis = visible(ln)
        const x = Math.round(s.x + specX(wl(ln)))
        const hgt = 4 + (room - 4) * Math.sqrt(counts[k] / top) * 0.75
        g.globalAlpha = 0.6 + 0.4 * flash[k]
        g.fillStyle = vis ? ln.rgb : '#8a94a8'
        g.fillRect(x - 1, s.y + R.base - hgt, vis ? 3 : 2, hgt)
        if (flash[k] > 0.02) {
          g.globalAlpha = flash[k]
          g.fillRect(x - 1, s.y + 3, vis ? 3 : 2, R.base - 3)
        }
        flash[k] *= Math.exp(-dt / 0.4)
      }
      g.restore()
    }

    // The captions above the atom, measured first so that no other text
    // takes their place, and drawn last, over the fronts.
    function captions (g, w) {
      const out = []
      g.textAlign = 'left'
      g.textBaseline = 'middle'
      if (last) {
        const ln = lines[last.k]
        const t = levelName(levels[ln.u]) + TO + levelName(levels[ln.l]) + '  ' + wlText(wl(ln)) + (ln.type !== 'E1' ? ' ' + ln.type : '') + '  A ' + sci(ln.A) + ' s' + U(0x207b, 0xb9) + '  ' + TAU + ' ' + timeText(levels[ln.u].tau) + '  waited ' + timeText(last.waited)
        g.font = font(11)
        out.push([g.font, '#c9d3e6', box(g, clip(g, t, w - R.cap.x - 8), R.cap.x, R.cap.y)])
      }
      if (R.ens) {
        g.font = font(10)
        const room = w - R.ens.x - 8
        // A small pane writes nothing over its atom: the field goes with
        // the ensemble's caption, where it fits.
        const f = Larmor.rate(levels[atoms[0].lv], mag)
        const bt = 'B ' + mT(mag.T)
        const bs = !mag.T ? ['B 0'] : alongZ() ? [bt + ' along z: ' + (Math.abs(Larmor.axis(atoms[0], now, mag)[2]) > 1 - 1e-9 ? 'nothing turns' : 'tilted, turns'), bt + ' along z'] : !f ? [bt + ' ' + Math.abs(mag.deg) + DEG + ': J = 0, no turn', bt] : [bt + ' ' + Math.abs(mag.deg) + DEG + ': ' + hz(f) + ', ' + hz(f * EVENT) + ' real', bt + ': ' + hz(f) + ' (' + hz(f * EVENT) + ')', bt]
        const all = []
        for (const b of bs) for (const e of ENSEMBLE) all.push(e + '  ' + b)
        const t = all.concat(ENSEMBLE).find(t => g.measureText(t).width <= room) || ENSEMBLE[ENSEMBLE.length - 1]
        out.push([g.font, '#7d89a1', box(g, clip(g, t, room), R.ens.x, R.ens.y)])
      }
      for (const c of out) said.push(c[2])
      return out
    }

    function caption (g, out) {
      g.textAlign = 'left'
      g.textBaseline = 'middle'
      for (const [f, fill, b] of out) {
        g.font = f
        g.fillStyle = fill
        g.fillText(b.t, b.gx, b.gy)
      }
    }

    // A pointer at x, y on the dial sets the field.
    function dial (x, y) {
      const d = R.dial
      const dx = x - d.x
      const dy = d.y - y
      const s = Math.min(1, Math.hypot(dx, dy) / d.r)
      let deg = Math.round(Math.atan2(dx, dy) * 180 / Math.PI)
      if (Math.abs(deg) <= 2) deg = 0
      if (Math.abs(deg) >= 178) deg = 180
      const tesla = Math.round(B_MAX * s * s * 1e5) / 1e5
      setField(tesla, tesla ? deg : mag.deg)
    }

    cl = Cloud.make(levels[atoms[0].lv], atoms[0].M)

    return {
      draw (synth, dt) {
        const w = canvas.width
        const h = canvas.height
        if (w < 4 || h < 4) return
        const t = env && env.text ? env.text() : 1
        if (w !== ow || h !== oh || t !== T) {
          ow = w
          oh = h
          T = t
          resize(w, h)
        }
        const L = synth.level
        for (const e of synth.since(mark)) react(e)
        const from = now
        now += dt
        field = strength(L)
        Ensemble.step(atoms, dt, FIELD_MAX * field, (i, at) => excite(i, from + at), (i, k, at) => jump(i, k, from + at))
        sample(now)
        while (born.length && now - born[0] > 1) born.shift()
        Cloud.step(cl, dt)
        if (now - cam.held > 4) cam.yaw += dt * 0.25 * (1 - 0.7 * L.idle)
        frame(w, h)
        // Fronts that reached the pane's edge are detected.
        fronts = fronts.filter(f => {
          if (Front.radius(f, now) * F.k < F.edge) return true
          detect(f, F)
          return false
        })
        const g = layer.g
        said = []
        const caps = captions(g, w)
        g.globalCompositeOperation = 'source-over'
        g.globalAlpha = 1
        g.fillStyle = '#03050a'
        g.fillRect(0, 0, w, h)
        drawSpectrumNow(g, dt)
        drawDiagramNow(g)
        drawAtom(g, 1 - 0.3 * L.idle)
        labels(g)
        controls(g)
        caption(g, caps)
        out.drawImage(layer.c, 0, 0)
      },

      // A press or drag on the dial sets the field B: its angle from up is
      // B's angle from z, toward x, in whole degrees, within 2 of z taken
      // as z, and its distance from the centre over the radius, squared,
      // B's share of B_MAX, in steps of 0.01 mT. A click on the pulse
      // button fires a pulse. A drag across the atom turns the camera. A click on the atom
      // shines a lamp on the drawn atom: a photon absorbed from its
      // present level. A click on the level diagram lifts the drawn atom
      // to the level nearest it in that column by a collision.
      pointer (kind, x, y, down) {
        if (!R) return
        if (kind === 'down') {
          const d = R.dial
          press = { x0: x, y0: y, yaw: cam.yaw, pitch: cam.pitch, moved: false, dial: !!d && Math.hypot(x - d.x, y - d.y) <= d.r + 4 }
          if (press.dial) dial(x, y)
          return
        }
        if (!press) return
        if (press.dial) {
          if (kind === 'move' && down) dial(x, y)
          else if (kind === 'up') press = null
          return
        }
        const dx = x - press.x0
        const dy = y - press.y0
        if (kind === 'move' && down) {
          if (!press.moved && Math.hypot(dx, dy) >= 5 && inside(R.atom, press.x0, press.y0)) {
            press.moved = true
            tally.turns++
          }
          if (press.moved) {
            cam.yaw = press.yaw - dx * 0.01
            cam.pitch = Math.max(-1.4, Math.min(1.4, press.pitch + dy * 0.01))
            cam.held = now
          }
          return
        }
        if (kind !== 'up') return
        const p = press
        press = null
        if (p.moved || Math.hypot(dx, dy) >= 5) return
        tally.clicks++
        if (inside(R.pulse, x, y)) pulse()
        else if (inside(R.diag, x, y)) {
          const d = R.diag
          const c = Math.max(0, Math.min(4, Math.floor((x - d.x - R.dd.x0) / R.dd.cw)))
          let best = -1
          let gap = Infinity
          levels.forEach((lv, i) => {
            if (colOf(lv) !== c) return
            const e = Math.abs(d.y + yOf(lv.E) - y)
            if (e < gap) {
              gap = e
              best = i
            }
          })
          if (best >= 0 && gap < 30) lift(0, best, 'click: electron collision')
        } else if (inside(R.atom, x, y)) absorb(0, -1, 'click: a lamp')
      },

      // For the live checks: one front of the line nearest nm in vacuum,
      // component q about z, from the site now. Returns its line's
      // vacuum wavelength.
      send (nm, q = 0) {
        let k = 0
        lines.forEach((ln, j) => { if (Math.abs(ln.vac - nm) < Math.abs(lines[k].vac - nm)) k = j })
        fronts.push(Front.make(k, lines[k], q, now))
        return lines[k].vac
      },

      // For the live checks: the clicks, the camera's turns, the
      // collisions, photons emitted and detected, the drawn atom's level
      // and M_L, the lines lit, the fronts in flight by kind, whether a
      // source flashes, the field, the photons of the last second, and the
      // ink box of every text drawn, for the check of overlapping text.
      // The magnetic field B, the event clock's time, the drawn atom's
      // axis then and as last drawn on the pane, the time its axis was
      // last set, its g_J and Larmor rate, the dial's, pulse button's
      // and trace's places, and after a pulse the rate at the detector
      // over TRACE_T before and after it, as [seconds from the pulse,
      // rate] by emission time, with 2 f_L of the pulsed level. The
      // invisible fronts' mean change of the atom's pixels, last frame.
      probe () {
        const lv = levels[atoms[0].lv]
        const r4 = v => Math.round(v * 1e4) / 1e4
        const span = (a, z) => {
          const out = []
          for (let k = 0; k < trace.t.length; k++) if (trace.t[k] >= pulsed.t + a && trace.t[k] < pulsed.t + z) out.push([r4(trace.t[k] - pulsed.t), Number(trace.r[k].toPrecision(5))])
          return out
        }
        const zee = {
          B: { mT: mag.T * 1e3, deg: mag.deg },
          now,
          axis: Larmor.axis(atoms[0], now, mag),
          axisLine,
          t0: atoms[0].t0,
          lifted,
          gJ: lv.gJ,
          gJsrc: lv.gJsrc,
          larmor: Larmor.rate(lv, mag),
          dots: dots.filter(d => Number.isFinite(d.x) && Number.isFinite(d.y)).length,
          dial: R && R.dial ? { x: R.dial.x, y: R.dial.y, r: R.dial.r } : null,
          pulseButton: R ? R.pulse || null : null,
          trace: R ? R.trace || null : null,
          beat: pulsed ? { t: pulsed.t, n: pulsed.n, level: PULSE_LEVEL, f2: 2 * Larmor.rate(levels[pulseLevel], mag), before: span(-TRACE_T, 0), after: span(0, TRACE_T) } : null
        }
        const r1 = v => Math.round(v * 10) / 10
        let lit = 0
        for (let k = 0; k < counts.length; k++) if (counts[k]) lit++
        const by = b => fronts.filter(f => f.ln.band === b).length
        return Object.assign({ level: levels[atoms[0].lv].id, M: atoms[0].M, lit, fronts: fronts.length, visible: fronts.filter(f => f.vis).length, uv: fronts.filter(f => !f.vis && f.uv).length, ir: by('IR'), warp: Math.round(warped * 1e4) / 1e4, source: !!(src && src.sign && now - src.t < SOURCE_T), field: Math.round(field * 100) / 100, rate: born.length, texts: still.concat(said).map(b => ({ t: b.t, x: r1(b.x), y: r1(b.y), w: r1(b.w), h: r1(b.h) })) }, tally, zee)
      }
    }
  }

  const api = { TRAIL, BAND_MIN, SHARP, LIFT, HAZE, GRID_PX, barStep, gridStep, Clock, Ensemble, Cloud, Front, Warp, Larmor, emission, cg, turnAbout, rotation, MU_B_H, FIELD_MAX, SPIN_MAX, TRACE_DT, TRACE_T, B_MAX, B_START, occupations, targets, tauScreen, slater, laguerre, outerP, radialP, radialTable, drawR, meanR, table, shells, size, mover, pattern, patternMax, detectDir, legendre, mPair, sourceSign, sphere, roster, NELSON, U_MAX, MORPH, SMOOTH, PTS_CORE, PTS_OUTER, SOURCE_PTS, SOURCE_T, decay, thermal, absorptions, pick, levelName, wlText, ground, EVENT, LIGHT, N_ATOMS }
  if (typeof module === 'object' && module.exports) module.exports = api
  else (root.VizCanvas = root.VizCanvas || {}).carbon = create
})(this)
