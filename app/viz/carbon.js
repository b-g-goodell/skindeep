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
// hue, ultraviolet ones sharpen the picture and infrared ones refract it
// as heat haze, by one pass over the atom's pixels (see Warp). One atom
// of the ensemble is drawn: its cloud, Monte Carlo stippling of |psi|^2
// for its M_L about the chosen axis z, flowing about the axis as
// Madelung's probability current says for m != 0, the core from the
// Bunge 1993 orbitals, the outer electron from the research's
// quantum-defect model, labelled a model; its jumps snap the cloud and
// flash the jump's transition density as the source. Beside it the level
// diagram, every level at its energy, the ensemble's populations, the
// drawn atom's level lit and its last jump an arrow, the ground term's
// fine structure in an inset. Along the bottom the spectrum. The two
// clocks, the ensemble, the cloud and the fronts sit behind small
// interfaces: Clock, Ensemble, Cloud, Front and Warp. Signals: see
// react. The pointer: see pointer.

;(function (root) {
  const D = typeof module === 'object' && module.exports ? require('./carbon-data') : root.CarbonData

  // The event clock: every NIST rate divided by EVENT, one factor, so
  // the ratios between levels stay true. The light clock: light at
  // c / LIGHT. The ground term 3P is where a cascade rests.
  const EVENT = 1e6
  const LIGHT = 1e17
  // The speed of light (exact, SI) and the atomic unit of time (CODATA
  // 2022), seconds.
  const C_LIGHT = 299792458
  const AU_TIME = 2.4188843265864e-17
  // The ensemble, and its field: a hot discharge's electron collisions
  // into any radiating level above the present one, by statistical
  // weight, at up to FIELD_MAX a second per atom at full activity, a few
  // times below the slowest allowed decay on the event clock (2p4p 3D,
  // 4.1 a second), so the visible lines still leave.
  const N_ATOMS = 160
  const FIELD_MAX = 1.2
  // The ensemble's caption, longest first, for a pane's width.
  const ENSEMBLE = ['one site, ' + N_ATOMS + ' atoms: cloud of 1, fronts of all', N_ATOMS + ' atoms: cloud of 1, fronts of all', N_ATOMS + ' atoms, cloud of 1']
  // Boltzmann's constant over hc, cm^-1 per K (CODATA 2022), and the
  // gas's temperature for the ground term's thermal populations.
  const K_CM = 0.6950348004
  const T_GAS = 300
  // Points per electron, core and outer, and the share drawn afresh
  // each 60th of a second.
  const PTS_CORE = 230
  const PTS_OUTER = 1300
  const SEETHE = 0.012
  // A Madelung angular velocity above this, radians a second on screen,
  // is clipped: m / rho^2 grows without bound near the axis, where the
  // density of m != 0 vanishes.
  const SPIN_MAX = 3
  // The fronts: at most FRONTS in flight, the drawn amplitude 1 at R0
  // bohr for a 538 nm front in its pattern's brightest direction, the
  // trailing crests drawn behind a visible front, and the points and
  // seconds of the source's flash.
  const FRONTS = 500
  const R0 = 8
  const NU_REF = 1 / 538.18
  const CRESTS = 3
  const SOURCE_PTS = 700
  const SOURCE_T = 0.4
  // The view's radius, bohr: fixed, so every front keeps the light
  // clock's pace, about 1.6 times a 2p4p cloud's mean radius: a front
  // crosses that cloud's diameter in about half a second.
  const VIEW = 24
  const MONO = '"DejaVu Sans Mono", monospace'

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

  // A level is in the ground term.
  const ground = l => l.conf === '2s2.2p2' && l.term === '3P'

  // ---- Orbitals --------------------------------------------------------

  const fact = n => n <= 1 ? 1 : n * fact(n - 1)

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

  // Points of the transition density psi_f* psi_i of a jump, its source
  // (carbon-photon.md, sections 1 and 4): the radial part |P_f P_i| as a
  // table, the angular part P_lf^|m|(cos theta) P_lt^|m'|(cos theta)
  // cos(q phi), the real part at one instant, by rejection. Each point
  // carries its sign. Tables are kept by the pair of orbitals.
  const sources = new Map()
  function source (mv, q, n, rand = Math.random) {
    const key = mv.from + '|' + mv.to
    let q0 = sources.get(key)
    if (!q0) {
      q0 = radialTable(r => Math.abs(radialP(mv.from, r) * radialP(mv.to, r)), Math.max(reach(mv.from), reach(mv.to)))
      sources.set(key, q0)
    }
    const [m, mt] = mPair(mv.lf, mv.lt, q)
    const ang = (c, ph) => legendre(mv.lf, Math.abs(m), c) * legendre(mv.lt, Math.abs(mt), c) * Math.cos(q * ph)
    let top = 0
    for (let i = 0; i <= 200; i++) top = Math.max(top, Math.abs(legendre(mv.lf, Math.abs(m), -1 + i / 100) * legendre(mv.lt, Math.abs(mt), -1 + i / 100)))
    const pts = new Float32Array(4 * n)
    for (let k = 0; k < n; k++) {
      let c = 0
      let ph = 0
      let a = 0
      for (let i = 0; i < 200; i++) {
        c = 2 * rand() - 1
        ph = 2 * Math.PI * rand()
        a = ang(c, ph)
        if (rand() * top <= Math.abs(a)) break
      }
      const r = drawR(q0, rand())
      const s = Math.sqrt(1 - c * c)
      pts[4 * k] = r * s * Math.cos(ph)
      pts[4 * k + 1] = r * s * Math.sin(ph)
      pts[4 * k + 2] = r * c
      pts[4 * k + 3] = Math.sign(a * radialP(mv.from, r) * radialP(mv.to, r)) || 1
    }
    return pts
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

  // N atoms at one site, each { lv, M }: its level and its M_L about z.
  // Ensemble.step runs each for dt seconds of the event clock by
  // Gillespie's method, its decay at 1 / tau on screen competing with the
  // field's collisions at rate, calling excite(i) or jump(i, line).
  // Ensemble.q draws a jump's component q = M_upper - M_lower, uniform
  // among those the multipole's rank and the lower level's L allow.
  const Ensemble = {
    make (n, lv) {
      return Array.from({ length: n }, () => ({ lv: typeof lv === 'function' ? lv() : lv, M: 0 }))
    },

    q (a, ln) {
      const rank = ln.type === 'E2' ? 2 : 1
      const L = Lof(D.levels[ln.l])
      const ok = []
      for (let q = -rank; q <= rank; q++) if (Math.abs(a.M - q) <= L) ok.push(q)
      return ok.length ? ok[Math.floor(Math.random() * ok.length)] : 0
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
          if (Math.random() * total < down) jump(i, decay(a.lv, Math.random()))
          else excite(i)
        }
      }
    }
  }

  // ---- The cloud ---------------------------------------------------------

  // The largest of P_l^m(cos theta)^2, for rejection.
  const tops = new Map()
  function legTop (l, m) {
    const key = l * 8 + m
    let t = tops.get(key)
    if (t === undefined) {
      t = 0
      for (let i = 0; i <= 400; i++) t = Math.max(t, legendre(l, m, -1 + i / 200) ** 2)
      tops.set(key, t)
    }
    return t
  }

  // The electron density of a level's M_L component as points, in bohr:
  // Monte Carlo stippling of |psi|^2. Each electron's radius from its
  // orbital's table. A subshell with occupations draws each point's m by
  // n_m and its direction from |Y_lm|^2, else uniformly. Cloud.make(lv,
  // M) makes one, Cloud.step(c, dt) draws SEETHE of the points afresh
  // each 60th of a second, so it seethes and keeps its shape, and turns
  // each point of m != 0 about z at Madelung's m / rho^2 (atomic units)
  // on the light clock, and Cloud.draw(c, fr, area, dim, rect) projects
  // them, far points dimmer and smaller, the outer electron's in amber.
  const Cloud = {
    make (lv, M) {
      const occ = occupations(lv, M)
      const sh = shells(lv).map(e => Object.assign({}, e, {
        l: e.outer ? e.l : e.key === '2p' ? 1 : 0,
        occ: occ ? (e.outer ? occ.o : e.key === '2p' ? occ.p : null) : null
      }))
      const n = sh.reduce((s, e) => s + e.count * (e.outer ? PTS_OUTER : PTS_CORE), 0)
      const c = { pts: new Float32Array(3 * n), m: new Int8Array(n), kinds: [], outerFrom: n, debt: 0, round: !occ }
      let k = 0
      for (const e of sh) {
        const m = e.count * (e.outer ? PTS_OUTER : PTS_CORE)
        if (e.outer) c.outerFrom = k
        for (let j = 0; j < m; j++, k++) {
          c.kinds.push(e)
          Cloud.place(c, k)
        }
      }
      return c
    },

    place (c, k) {
      const e = c.kinds[k]
      const r = drawR(table(e.key), Math.random())
      let z = 2 * Math.random() - 1
      let m = 0
      if (e.occ) {
        m = pick(e.occ.map((_, i) => i), i => e.occ[i], Math.random()) - e.l
        const top = legTop(e.l, Math.abs(m))
        for (let i = 0; i < 200; i++) {
          z = 2 * Math.random() - 1
          if (Math.random() * top <= legendre(e.l, Math.abs(m), z) ** 2) break
        }
      }
      const ph = 2 * Math.PI * Math.random()
      const s = Math.sqrt(1 - z * z)
      c.pts[3 * k] = r * s * Math.cos(ph)
      c.pts[3 * k + 1] = r * s * Math.sin(ph)
      c.pts[3 * k + 2] = r * z
      c.m[k] = m
    },

    step (c, dt) {
      const n = c.kinds.length
      c.debt += n * SEETHE * dt * 60
      for (; c.debt >= 1; c.debt--) Cloud.place(c, Math.floor(Math.random() * n))
      const p = c.pts
      for (let k = 0; k < n; k++) {
        const m = c.m[k]
        if (!m) continue
        const x = p[3 * k]
        const y = p[3 * k + 1]
        const w = Math.max(-SPIN_MAX, Math.min(SPIN_MAX, m / Math.max(1e-6, x * x + y * y) / Clock.au)) * dt
        const cs = Math.cos(w)
        const sn = Math.sin(w)
        p[3 * k] = x * cs - y * sn
        p[3 * k + 1] = x * sn + y * cs
      }
    },

    draw (c, fr, a, dim, rect) {
      const p = c.pts
      for (let i = 0; i < c.kinds.length; i++) {
        const v = fr.project(p[3 * i], p[3 * i + 1], p[3 * i + 2])
        if (v.x < a.x || v.x >= a.x + a.w || v.y < a.y || v.y >= a.y + a.h) continue
        const near = Math.max(0, Math.min(1, (v.s - 0.8) / 0.45))
        const outer = i >= c.outerFrom
        rect(outer ? '#ffcf7a' : '#a9c8ff', (outer ? 0.4 + 0.5 * near : 0.3 + 0.45 * near) * dim, v.x, v.y, 1 + 1.6 * near)
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
  // component q, born at t. Its amplitude follows the physics: intensity
  // h nu times the pattern over r^2, drawn as its square root, so
  // sqrt(nu / nu_538) sqrt(pattern) R0 / r, 1 at most. Its crests'
  // spacing on screen grows as lambda^0.35, a symbol.
  const Front = {
    make (k, ln, q, t) {
      return { k, ln, q, t, kind: kindOf(ln.type, q), amp: Math.sqrt((1 / wl(ln)) / NU_REF), vis: visible(ln), uv: wl(ln) < 380, gap: 4.5 * Math.pow(wl(ln) / 119, 0.35) }
    },

    // Its radius, bohr, at time now.
    radius: (f, now) => Clock.light * (now - f.t),

    // The visible fronts, in their hue: each the limb of its sphere and
    // of CRESTS - 1 crests behind it, as arcs whose brightness is the
    // drawn amplitude in the arc's direction, cos(Theta) = sin(phi) upZ
    // on the limb. Arcs batched by colour and brightness.
    draw (g, fronts, fr, now) {
      const N = 36
      const bins = new Map()
      for (const f of fronts) {
        if (!f.vis) continue
        const Rb = Front.radius(f, now)
        const R = Rb * fr.k
        const a0 = Math.min(1, f.amp * R0 / Math.max(Rb, 0.1))
        let list = bins.get(f.ln.rgb)
        if (!list) bins.set(f.ln.rgb, list = [])
        for (let w = 0; w < CRESTS; w++) {
          const r = R - w * f.gap
          if (r <= 1) break
          const fade = a0 * Math.exp(-w / 1.2)
          for (let j = 0; j < N; j++) {
            const p0 = 2 * Math.PI * j / N
            const p1 = 2 * Math.PI * (j + 1) / N
            const b = Math.round(10 * fade * shape(f.kind, Math.sin((p0 + p1) / 2) * fr.upZ))
            if (b <= 0) continue
            const path = list[b] || (list[b] = new Path2D())
            path.moveTo(fr.cx + r * Math.cos(p0), fr.cy - r * Math.sin(p0))
            path.arc(fr.cx, fr.cy, r, -p0, -p1, true)
          }
        }
      }
      g.save()
      g.lineWidth = 1.6
      for (const [rgb, list] of bins) {
        g.strokeStyle = rgb
        list.forEach((path, b) => {
          if (!path) return
          g.globalAlpha = b / 10
          g.stroke(path)
        })
      }
      g.restore()
    }
  }

  // The invisible fronts as image transforms over the atom's pixels, in
  // one pass, since every front shares one centre: each front adds to a
  // table by integer radius, per pattern kind, and a pixel takes the
  // tables at its radius times each kind's shape in its direction.
  // Ultraviolet fronts sharpen the picture and lift its contrast across a
  // band as wide as the front's crest spacing. Infrared fronts refract
  // it, shifting pixels along the radius by a ripple of that spacing, as
  // heat haze does. Radii with no front are skipped.
  const Warp = {
    tables: null,
    apply (g, fronts, fr, box, now) {
      const some = fronts.filter(f => !f.vis)
      if (!some.length || box.w < 4 || box.h < 4) return 0
      const rmax = Math.ceil(Math.hypot(box.w, box.h)) + 4
      if (!Warp.tables || Warp.tables.n < rmax) Warp.tables = { n: rmax, S: KINDS.map(() => new Float32Array(rmax)), Dp: KINDS.map(() => new Float32Array(rmax)), on: new Uint8Array(rmax) }
      const T = Warp.tables
      for (let k = 0; k < KINDS.length; k++) {
        T.S[k].fill(0)
        T.Dp[k].fill(0)
      }
      T.on.fill(0)
      let used = 0
      for (const f of some) {
        const Rb = Front.radius(f, now)
        const R = Rb * fr.k
        const a = Math.min(1.5, f.amp * R0 / Math.max(Rb, 0.1))
        const w = f.uv ? 0.8 * f.gap : 1.5 * f.gap
        const lo = Math.max(0, Math.floor(R - 2.5 * w))
        const hi = Math.min(rmax - 1, Math.ceil(R + w))
        if (hi < lo) continue
        used++
        for (let r = lo; r <= hi; r++) {
          const x = (r - R) / w
          const env = Math.exp(-x * x)
          if (f.uv) T.S[f.kind][r] += a * env
          else T.Dp[f.kind][r] += 4 * a * env * Math.sin(2 * Math.PI * (r - R) / f.gap)
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
      for (let y = 1; y < H - 1; y++) {
        const dy = y - oy
        for (let x = 1; x < W - 1; x++) {
          const dx = x - ox
          const rr = Math.sqrt(dx * dx + dy * dy)
          const ri = rr | 0
          if (ri >= rmax || !T.on[ri]) continue
          const ci = Math.round(((rr > 0 ? -dy / rr * fr.upZ : 0) + 1) * 128)
          let s = 0
          let disp = 0
          for (let k = 0; k < KINDS.length; k++) {
            const a = T.S[k][ri]
            const b = T.Dp[k][ri]
            if (!a && !b) continue
            const f = SHAPES[k][ci]
            s += a * f
            disp += b * f
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
          if (s) {
            s = Math.min(1, s)
            for (let ch = 0; ch < 3; ch++) {
              const p = src[i + ch]
              const lap = 4 * p - src[i + ch - 4] - src[i + ch + 4] - src[i + ch - 4 * W] - src[i + ch + 4 * W]
              d[i + ch] = d[i + ch] + s * (0.5 * lap + 0.35 * p)
            }
          }
        }
      }
      g.putImageData(img, box.x, box.y)
      return used
    }
  }

  // ---- The pane --------------------------------------------------------

  // The pane's parts, in pixels: the atom, the level diagram, the
  // spectrum and the captions' places. The top 24 pixels hold the mode's
  // drop-down at the left, the bottom 18 its label. An atom smaller than
  // SMALL a side has no room for captions over its cloud: the pane is
  // small, and a band of two rows above the atom holds the jump's
  // caption and the ensemble's, with nothing written over the atom.
  const SMALL = 240
  function regions (w, h) {
    const narrow = w < 480
    const bottom = 18
    const sh = Math.round(Math.max(34, Math.min(84, h * 0.17)))
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
    const top = narrow ? 44 : 26
    let r = parts(top)
    const small = Math.min(r.atom.w, r.atom.h) < SMALL
    if (small) r = parts(top + 12)
    const cap = narrow ? { x: 8, y: 36 } : { x: 162, y: 14 }
    const ens = small ? { x: 8, y: narrow ? 48 : 32 } : null
    return { atom: r.atom, diag: r.diag, spec, cap, ens, narrow, small }
  }

  const inside = (b, x, y) => b && x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h

  function cpu (w, h) {
    const c = document.createElement('canvas')
    c.width = Math.max(1, w)
    c.height = Math.max(1, h)
    return { c, g: c.getContext('2d', { willReadFrequently: true }) }
  }

  const COLS = ['1even', '1odd', '3even', '3odd', '5odd']
  const COL_NAME = ['singlet', 'singlet' + ODD, 'triplet', 'triplet' + ODD, 'quintet' + ODD]
  const colOf = lv => COLS.indexOf(lv.term[0] + lv.parity)

  function create (canvas) {
    // Composed on a canvas of the CPU and blitted once, as the other
    // procedural modes are.
    const out = canvas.getContext('2d')
    let layer = null
    let diagC = null
    let specC = null
    let grain = null
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
    let entered = 0
    let last = null
    let cause = { text: 'at rest in the ground term', t: -10 }
    let fronts = []
    let dots = []
    let src = null
    let cl = null
    const view = VIEW
    let field = 0
    const born = []
    // The camera's turn about the vertical and its height, the time the
    // pointer last turned it, and the press while the pointer is down.
    const cam = { yaw: 0.4, pitch: 0.32, held: -1e9 }
    let press = null
    const tally = { clicks: 0, turns: 0, excitations: 0, photons: 0, detected: 0 }

    // ---- The ensemble's state ----

    // The drawn atom changed: its cloud snaps to the new level's.
    function redraw (why) {
      const a = atoms[0]
      cl = Cloud.make(levels[a.lv], a.M)
      entered = now
      if (why) cause = { text: why, t: now }
    }

    // Atom i to level k by a collision, its M_L drawn anew.
    function lift (i, k, why) {
      const a = atoms[i]
      if (k < 0 || k === a.lv) return
      const L = Lof(levels[k])
      a.lv = k
      a.M = Math.floor(Math.random() * (2 * L + 1)) - L
      tally.excitations++
      if (i === 0) redraw(why)
    }

    // The field's collision: any radiating level above, by weight g.
    function excite (i) {
      const t = targets(atoms[i].lv)
      if (t.length) lift(i, pick(t, k => levels[k].g, Math.random()), 'the field: electron collision')
    }

    // Atom i jumps down by line k, and its front leaves.
    function jump (i, k) {
      const a = atoms[i]
      const ln = lines[k]
      const q = Ensemble.q(a, ln)
      a.M -= q
      a.lv = ln.l
      tally.photons++
      born.push(now)
      fronts.push(Front.make(k, ln, q, now))
      if (fronts.length > FRONTS) detect(fronts.shift(), null)
      if (i === 0) {
        const mv = mover(levels[ln.u], levels[ln.l])
        src = { pts: mv ? source(mv, q, SOURCE_PTS) : null, t: now, k, q }
        last = { k, q, waited: now - entered, t: now }
        redraw(null)
      }
    }

    // A front reaches the pane's edge: it is found in one direction,
    // drawn from its pattern, and its line lights.
    function detect (f, F) {
      counts[f.k]++
      flash[f.k] = 1
      tally.detected++
      if (!F) return
      const dir = detectDir(f.ln.type, f.q)
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
      const put = (t, x, y) => say(g, t, x, y, diag.x, diag.y, still)
      const small = diag.w < 260 || diag.h < 200
      const left = small ? 30 : 46
      const dd = { top: 16, bot: diag.h - (small ? 14 : 26), x0: left, cw: (diag.w - left - 6) / 5 }
      R.dd = dd
      g.font = '10px ' + MONO
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
      put((small ? 'limit ' : 'ionization limit ') + D.limitEV.toFixed(2) + ' eV', diag.w - 6, dd.top - 8)
      // The energy axis in eV.
      g.strokeStyle = '#1f2838'
      g.beginPath()
      g.moveTo(dd.x0 - 6, dd.top)
      g.lineTo(dd.x0 - 6, dd.bot)
      g.stroke()
      const perEV = D.limit / D.limitEV
      for (let e = 0; e <= 10; e += small ? 5 : 2) put(e + (small ? '' : ' eV'), dd.x0 - 9, yOf(e * perEV))
      g.textAlign = 'center'
      if (!small) COL_NAME.forEach((n, c) => put(n, colX(c) + dd.cw / 2, dd.bot + 13))
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
      const ih = Math.round(Math.min(yOf(1.2 * perEV) - iy, 96))
      if (diag.h >= 140 && ih >= 64) {
        const ix = Math.round(colX(2) + 4)
        const iw = Math.round(Math.min(dd.cw * 2 - 8, 130))
        const gl = levels.filter(ground)
        const span = gl[gl.length - 1].E
        const inner = ih - 30
        R.inset = { x: ix, y: iy, w: iw, h: ih, y0: E => iy + ih - 10 - inner * E / span }
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
        put(SUP[3] + 'P ' + TIMES + Math.round(mag), ix + 4, iy + 9)
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
          put('J=' + lv.J + (iw > 90 ? '  ' + lv.E.toFixed(1) + ' cm' + U(0x207b, 0xb9) : ''), ix + iw * 0.45 + 4, y)
        }
      }
    }

    // The spectrum's axis: log wavelength from LO to HI nm, the visible
    // band marked, every line a faint tick in its colour or grey, and an
    // off-scale bin at the right for the ground term's far-infrared lines.
    const LO = 110
    const HI = 10000
    function specX (nm) {
      const x1 = R.spec.w - 46
      if (nm > HI) return x1 + 26 + (Math.log10(nm) - 5.5) * 24
      return 6 + (x1 - 6) * Math.log(nm / LO) / Math.log(HI / LO)
    }

    function drawSpectrum () {
      const s = R.spec
      specC = cpu(s.w, s.h)
      const g = specC.g
      const put = (t, x, y) => say(g, t, x, y, s.x, s.y, still)
      const base = s.h - 14
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
      g.font = '9px ' + MONO
      g.fillStyle = '#7d89a1'
      g.textBaseline = 'top'
      g.textAlign = 'center'
      const marks = s.w < 330 ? [[200, '200 nm'], [1000, '1 ' + MU + 'm']] : [[120, '120 nm'], [200, '200'], [380, '380'], [780, '780'], [2000, '2 ' + MU + 'm'], [5000, '5'], [10000, '10']]
      for (const [nm, t] of marks) {
        g.fillRect(specX(nm), base, 1, 3)
        put(t, specX(nm), base + 3)
      }
      put('far IR', specX(370000), base + 3)
      g.strokeStyle = '#33405a'
      g.strokeRect(Math.round(specX(370000)) - 16.5, 2.5, 33, base - 3)
      if (s.w >= 330) {
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

    // A faint fixed grain under the atom: the picture the invisible
    // fronts sharpen and refract, which on black would show nothing.
    function drawGrain () {
      const a = R.atom
      grain = cpu(a.w, a.h)
      const img = grain.g.createImageData(a.w, a.h)
      const d = img.data
      for (let i = 0; i < d.length; i += 4) {
        const v = Math.random() < 0.25 ? 8 + 16 * Math.random() : 4 * Math.random()
        d[i] = v * 0.8
        d[i + 1] = v * 0.9
        d[i + 2] = v * 1.2
        d[i + 3] = 255
      }
      grain.g.putImageData(img, 0, 0)
    }

    function resize (w, h) {
      layer = cpu(w, h)
      R = regions(w, h)
      still = []
      drawDiagram()
      drawSpectrum()
      drawGrain()
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
      F.k = Math.max(10, Math.min(a.w, a.h) / 2 - 6) / view
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
      g.drawImage(grain.c, a.x, a.y)
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
      const flashing = src && src.pts && now - src.t < SOURCE_T
      Cloud.draw(cl, F, a, flashing ? 0.45 * dim : dim, rect)
      if (flashing) {
        const s = 1 - (now - src.t) / SOURCE_T
        const p = src.pts
        for (let i = 0; i < p.length; i += 4) {
          const v = F.project(p[i], p[i + 1], p[i + 2])
          rect(p[i + 3] > 0 ? '#7dffd0' : '#ff8ad8', (0.5 + 0.4 * Math.max(0, Math.min(1, v.s - 0.8))) * s, v.x, v.y, 1.8)
        }
      }
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
      g.font = '10px ' + MONO
      g.textAlign = 'left'
      g.textBaseline = 'alphabetic'
      if (R.small) return
      const o = shells(lv).find(e => e.outer)
      const rows = [['#e8eefc', levelName(lv) + '  M_L=' + ax.M + (cl.round ? ', round' : '')]]
      const tau = tauScreen(lv)
      rows.push(['#8c97ad', ground(lv) ? 'ground term, at rest' : TAU + ' ' + timeText(lv.tau) + ', ' + timeText(tau) + ' on the event clock'])
      if (o) rows.push(['#ffcf7a', o.nl + ' cloud: a model, <r> ' + D.outer[o.key].meanR.toFixed(1) + ' ' + A0])
      if (now - cause.t < 4) rows.push(['#9fb7e0', cause.text])
      if (last && now - last.t < 3) {
        const ln = lines[last.k]
        rows.push(['#c9d3e6', 'its photon ' + DELTA + 'M=' + (last.q > 0 ? '+' : '') + last.q + ' ' + ln.type + ', ' + patternName(ln.type, last.q), visible(ln) ? ln.rgb : '#aab3c5'])
        rows.push(['#8c97ad', src && src.pts ? 'source: ' + PSI + 'f*' + PSI + 'i, + mint, - pink' : 'source: a two-electron jump, not drawn'])
        rows.push(['#8c97ad', wlText(wl(ln)) + ' = ' + Math.round(wl(ln) / (size(levels[ln.u]) * D.bohrNm)) + TIMES + ' this atom: crest spacing a symbol'])
      }
      const rate = born.length
      const rest = [
        ['#7d89a1', ENSEMBLE[0]],
        ['#7d89a1', 'events: NIST rates / ' + sci(EVENT) + ', light: c / ' + sci(LIGHT) + ' = ' + Clock.light.toFixed(1) + ' ' + A0 + '/s'],
        ['#7d89a1', 'field ' + Math.round(100 * field) + '%, ' + rate + ' photons/s, ' + fronts.length + ' fronts']
      ]
      const fit = a.w - 14
      // A narrower atom keeps the level, its clock, its photon and the
      // rate. Each row, then the axis's name, then the scale bar, is
      // written where it overlaps no text before it, or left out.
      const keep = a.w < 320 ? [rows[0], rows[1], ...rows.filter(r => r[2]), rest[2]] : rows.concat(rest)
      let j = 0
      for (const [col, t, swatch] of keep) {
        const y = a.y + 11 + 12 * j
        const x = a.x + 8 + (swatch ? 11 : 0)
        const b = box(g, clip(g, t, fit - (x - a.x - 8)), x, y)
        if (!fits(b)) continue
        if (swatch) {
          g.fillStyle = swatch
          g.fillRect(a.x + 8, y - 7, 7, 7)
        }
        g.fillStyle = col
        write(g, b)
        j++
      }
      g.fillStyle = '#7d89a1'
      place(g, 'z, chosen', [[tx + 4, Math.max(a.y + 10, ty)]])
      // A scale bar, drawn only with its label.
      const step = [1, 2, 5, 10, 20, 50].find(s => s * F.k >= a.w * 0.1) || 50
      const bx = a.x + 10
      const by = a.y + a.h - 6
      if (place(g, step + ' ' + A0 + ' = ' + (step * D.bohrNm).toFixed(2) + ' nm', [[bx, by - 4]])) g.fillRect(bx, by, step * F.k, 1)
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
      g.font = '10px ' + MONO
      g.textBaseline = 'middle'
      g.fillStyle = '#ffffff'
      const label = levelName(lv)
      const right = x + cw + g.measureText(label).width + 4 < d.x + d.w
      g.textAlign = right ? 'left' : 'right'
      place(g, label, [[right ? x + cw : x - 2, y - 7], [right ? x + cw : x - 2, y + 8]])
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
        g.font = '11px ' + MONO
        out.push(['11px', '#c9d3e6', box(g, clip(g, t, w - R.cap.x - 8), R.cap.x, R.cap.y)])
      }
      if (R.ens) {
        g.font = '10px ' + MONO
        const room = w - R.ens.x - 8
        const t = ENSEMBLE.find(t => g.measureText(t).width <= room) || ENSEMBLE[ENSEMBLE.length - 1]
        out.push(['10px', '#7d89a1', box(g, clip(g, t, room), R.ens.x, R.ens.y)])
      }
      for (const c of out) said.push(c[2])
      return out
    }

    function caption (g, out) {
      g.textAlign = 'left'
      g.textBaseline = 'middle'
      for (const [px, fill, b] of out) {
        g.font = px + ' ' + MONO
        g.fillStyle = fill
        g.fillText(b.t, b.gx, b.gy)
      }
    }

    redraw(null)

    return {
      draw (synth, dt) {
        const w = canvas.width
        const h = canvas.height
        if (w < 4 || h < 4) return
        if (w !== ow || h !== oh) {
          ow = w
          oh = h
          resize(w, h)
        }
        const L = synth.level
        now += dt
        for (const e of synth.since(mark)) react(e)
        field = strength(L)
        Ensemble.step(atoms, dt, FIELD_MAX * field, excite, jump)
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
        caption(g, caps)
        out.drawImage(layer.c, 0, 0)
      },

      // A drag across the atom turns the camera. A click on the atom
      // shines a lamp on the drawn atom: a photon absorbed from its
      // present level. A click on the level diagram lifts the drawn atom
      // to the level nearest it in that column by a collision.
      pointer (kind, x, y, down) {
        if (!R) return
        if (kind === 'down') {
          press = { x0: x, y0: y, yaw: cam.yaw, pitch: cam.pitch, moved: false }
          return
        }
        if (!press) return
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
        if (inside(R.diag, x, y)) {
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

      // For the live checks: the clicks, the camera's turns, the
      // collisions, photons emitted and detected, the drawn atom's level
      // and M_L, the lines lit, the fronts in flight by kind, whether a
      // source flashes, the field, the photons of the last second, and the
      // ink box of every text drawn, for the check of overlapping text.
      probe () {
        const r1 = v => Math.round(v * 10) / 10
        let lit = 0
        for (let k = 0; k < counts.length; k++) if (counts[k]) lit++
        const by = b => fronts.filter(f => f.ln.band === b).length
        return Object.assign({ level: levels[atoms[0].lv].id, M: atoms[0].M, lit, fronts: fronts.length, visible: fronts.filter(f => f.vis).length, uv: fronts.filter(f => !f.vis && f.uv).length, ir: by('IR'), source: !!(src && src.pts && now - src.t < SOURCE_T), field: Math.round(field * 100) / 100, rate: born.length, texts: still.concat(said).map(b => ({ t: b.t, x: r1(b.x), y: r1(b.y), w: r1(b.w), h: r1(b.h) })) }, tally)
      }
    }
  }

  const api = { Clock, Ensemble, Cloud, Front, Warp, occupations, targets, tauScreen, slater, laguerre, outerP, radialP, radialTable, drawR, meanR, table, shells, size, mover, pattern, patternMax, detectDir, legendre, mPair, source, sphere, decay, thermal, absorptions, pick, levelName, wlText, ground, EVENT, LIGHT, N_ATOMS }
  if (typeof module === 'object' && module.exports) module.exports = api
  else (root.VizCanvas = root.VizCanvas || {}).carbon = create
})(this)
