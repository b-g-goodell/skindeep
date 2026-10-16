'use strict'
// Carbon mode (decision 0015, issue #144): the neutral carbon atom, C I,
// on NIST's levels and lines, from docs/research/carbon-atom.md and the
// slim copy of its data in carbon-data.js. On the left a side-on view of
// the atom in three dimensions: points sampled from its electron
// density, the core from the Roothaan-Hartree-Fock orbitals of Bunge,
// Barrientos and Bunge (1993), an excited electron from the research's
// quantum-defect model, which the pane labels a model. The density is
// the orientation-summed one, round. On the right the level diagram,
// every level at its energy, in columns by spin and parity, the present
// level lit, the last jump an arrow in its light's colour, and the
// ground term's fine structure magnified in an inset. Along the bottom
// the spectrum, each line lighting when a photon of it is detected.
// The photon follows docs/research/carbon-photon.md, section 4: the
// jump's transition density as its source, a shell about the atom
// painted by the radiation pattern of one M component about a chosen
// axis, and a detection in one direction drawn from that pattern when
// the shell reaches the pane's edge (see Photon).
// The session's events excite the atom, by collision or by a photon
// absorbed from the present level (see react), and it decays by NIST's
// branching ratios, each wait random about its level's lifetime on a
// stated clock. The clock of the events, the cloud and the photon each
// sit behind a small interface, Clock, Cloud and Photon, so each can be
// replaced alone. The pointer: see pointer.

;(function (root) {
  const D = typeof module === 'object' && module.exports ? require('./carbon-data') : root.CarbonData

  // The clock: an allowed decay's lifetime times SLOW, a slower one at
  // its real lifetime up to CAP seconds. The ground term 3P is where a
  // cascade rests: its months-long M1 decays are not run.
  const SLOW = 2e7
  const CAP = 8
  const ALLOWED = 1e-6
  // Boltzmann's constant over hc, cm^-1 per K (CODATA 2022), and the
  // gas's temperature for the ground term's thermal populations.
  const K_CM = 0.6950348004
  const T_GAS = 300
  // Points per electron, core and outer, and the share drawn afresh
  // each frame.
  const PTS_CORE = 230
  const PTS_OUTER = 1300
  const TWINKLE = 0.012
  // The photon: seconds from the atom to the pane's edge, points on its
  // front's face, the wavefronts drawn with the front, and the
  // points of its source region and how long that shows.
  const FLIGHT = 1.5
  const FRONT_PTS = 700
  const WAVES = 5
  const SOURCE_PTS = 900
  const SOURCE_T = 1.1
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

  // ---- The clock and the cascade ---------------------------------------

  // The mean wait on screen in level lv, in seconds: Infinity in the
  // ground term.
  function waitMean (lv) {
    if (ground(lv) || !lv.tau) return Infinity
    return lv.tau < ALLOWED ? lv.tau * SLOW : Math.min(lv.tau, CAP)
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

  // ---- The clock -------------------------------------------------------

  // The clock of the events: the mean wait on screen in a level, and a
  // wait drawn from the exponential about it for u uniform on [0, 1).
  const Clock = {
    mean: waitMean,
    wait (lv, u) {
      const m = waitMean(lv)
      return m === Infinity ? Infinity : -m * Math.log(1 - u)
    }
  }

  // ---- The cloud ---------------------------------------------------------

  // The electron density of a level as points drawn from it, in bohr:
  // each electron's radius from its orbital's table, its direction
  // uniform, the orientation-summed density. Cloud.make(lv) makes one,
  // Cloud.step(c, dt) draws a share afresh, TWINKLE of them each 60th of
  // a second, samples of where an electron would be found, none moving,
  // and Cloud.draw(c, fr, area, dim, rect) projects them in the atom's
  // frame, far points dimmer and smaller, the outer electron's in amber.
  const Cloud = {
    make (lv) {
      const sh = shells(lv)
      const n = sh.reduce((s, e) => s + e.count * (e.outer ? PTS_OUTER : PTS_CORE), 0)
      const c = { pts: new Float32Array(3 * n), kinds: [], outerFrom: n, debt: 0 }
      let k = 0
      for (const e of sh) {
        const m = e.count * (e.outer ? PTS_OUTER : PTS_CORE)
        if (e.outer) c.outerFrom = k
        for (let j = 0; j < m; j++, k++) {
          c.kinds.push(e)
          Cloud.place(c, k, e)
        }
      }
      return c
    },

    place (c, k, e) {
      const r = drawR(table(e.key), Math.random())
      const z = 2 * Math.random() - 1
      const ph = 2 * Math.PI * Math.random()
      const s = Math.sqrt(1 - z * z)
      c.pts[3 * k] = r * s * Math.cos(ph)
      c.pts[3 * k + 1] = r * s * Math.sin(ph)
      c.pts[3 * k + 2] = r * z
    },

    step (c, dt) {
      const m = c.kinds.length
      c.debt += m * TWINKLE * dt * 60
      for (; c.debt >= 1; c.debt--) {
        const k = Math.floor(Math.random() * m)
        Cloud.place(c, k, c.kinds[k])
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

  // ---- The photon --------------------------------------------------------

  // One emitted photon, as carbon-photon.md section 4 draws it, in the
  // atom's frame: its M component q, drawn at random, each of a
  // multipole's components carrying an equal share; its source region,
  // the jump's transition density, or none for a two-electron jump; and
  // the direction its detection will find, drawn from the pattern.
  // Photon.make(up, low, ln) makes it, Photon.draw(g, ph, fr, t) draws it
  // t seconds after the jump in the atom's frame fr: { cx, cy, k (pixels
  // per bohr), edge (pixels from the centre to the pane's nearest edge),
  // upZ (the z part of the camera's up), project(x, y, z) into { x, y,
  // s }, turn(x, y, z) into { x, y, z } seen from the camera }, its
  // points batched by rect(fill, alpha, x, y, side), and returns
  // 'flying', 'detected' (once) or 'done'.
  const FRONT = sphere(FRONT_PTS)
  const Photon = {
    make (up, low, ln) {
      const rank = ln.type === 'E2' ? 2 : 1
      const q = Math.floor(Math.random() * (2 * rank + 1)) - rank
      const mv = mover(up, low)
      // Wavefront spacing on screen grows as lambda^0.35, a symbol.
      const gap = 4.5 * Math.pow(wl(ln) / 119, 0.35)
      return { up, low, ln, q, mv, src: mv ? source(mv, q, SOURCE_PTS) : null, dir: detectDir(ln.type, q), gap, hit: null }
    },

    draw (g, ph, fr, t, rect) {
      const ln = ph.ln
      const vis = visible(ln)
      const fill = vis ? ln.rgb : '#aab3c5'
      const T = t / FLIGHT
      if (T >= 1) {
        if (!ph.hit) {
          const r = fr.edge
          const v = fr.turn(ph.dir[0], ph.dir[1], ph.dir[2])
          ph.hit = { x: fr.cx + v.x * r, y: fr.cy - v.y * r, z: v.z }
          return 'detected'
        }
        const a = 1 - (t - FLIGHT) / 1.4
        if (a <= 0) return 'done'
        const h = ph.hit
        const s = 1 + 0.6 * h.z
        g.save()
        g.globalAlpha = a
        g.fillStyle = fill
        g.beginPath()
        g.arc(h.x, h.y, 3.5 * s, 0, Math.PI * 2)
        g.fill()
        g.strokeStyle = fill
        g.lineWidth = 1.5
        g.globalAlpha = a * 0.7
        g.beginPath()
        g.arc(h.x, h.y, 4 + 14 * (1 - a), 0, Math.PI * 2)
        g.stroke()
        g.globalAlpha = a
        g.font = '10px ' + MONO
        g.textAlign = 'left'
        g.textBaseline = 'middle'
        g.fillText('detected ' + wlText(wl(ln)), h.x + 8, h.y - 10)
        g.restore()
        return 'flying'
      }
      // The source region, while the jump is fresh.
      if (ph.src && t < SOURCE_T) {
        const a = 1 - t / SOURCE_T
        const p = ph.src
        for (let i = 0; i < p.length; i += 4) {
          const v = fr.project(p[i], p[i + 1], p[i + 2])
          rect(p[i + 3] > 0 ? '#7dffd0' : '#ff8ad8', (0.45 + 0.4 * Math.max(0, Math.min(1, v.s - 0.8))) * a, v.x, v.y, 1.8)
        }
      }
      // The shell. A thin shell seen side on is brightest at its limb,
      // so the limb of its front and of each wavefront behind it is
      // drawn as arcs, each arc's brightness the pattern in its
      // direction, fainter behind the front, and the front's face as
      // faint points, nearer ones larger. Outside the visible, grey and
      // dashed.
      const R = fr.edge * T
      const top = patternMax(ln.type, ph.q)
      const fade0 = 1 - 0.35 * T
      for (let i = 0; i < FRONT.length; i += 3) {
        if (!vis && (Math.floor((Math.atan2(FRONT[i + 1], FRONT[i]) + Math.PI) * 6 / Math.PI) & 1)) continue
        const b = pattern(ln.type, ph.q, FRONT[i + 2]) / top
        if (b < 0.05) continue
        const v = fr.turn(FRONT[i], FRONT[i + 1], FRONT[i + 2])
        const near = 0.5 + 0.5 * v.z
        rect(fill, 0.3 * b * fade0 * (0.4 + 0.6 * near), fr.cx + v.x * R, fr.cy - v.y * R, 1 + near)
      }
      const N = 72
      const bins = []
      for (let w = 0; w < WAVES; w++) {
        const r = R - w * ph.gap
        if (r <= 2) break
        const fade = Math.exp(-w / 1.6) * fade0
        for (let j = 0; j < N; j++) {
          const p0 = 2 * Math.PI * j / N
          const p1 = 2 * Math.PI * (j + 1) / N
          const b = pattern(ln.type, ph.q, Math.sin((p0 + p1) / 2) * fr.upZ) / top
          const k = Math.round(10 * b * fade * (vis ? 1 : 0.8))
          if (k <= 0) continue
          const path = bins[k] || (bins[k] = new Path2D())
          path.moveTo(fr.cx + r * Math.cos(p0), fr.cy - r * Math.sin(p0))
          path.arc(fr.cx, fr.cy, r, -p0, -p1, true)
        }
      }
      g.save()
      g.strokeStyle = fill
      g.lineWidth = vis ? 1.7 : 1.3
      if (!vis) g.setLineDash([5, 4])
      bins.forEach((path, k) => {
        if (!path) return
        g.globalAlpha = k / 10
        g.stroke(path)
      })
      g.restore()
      return 'flying'
    }
  }

  // ---- The pane --------------------------------------------------------

  // The pane's parts, in pixels: the atom, the level diagram, the
  // spectrum and the caption's place. The top 24 pixels hold the mode's
  // drop-down at the left, the bottom 18 its label.
  function regions (w, h) {
    const narrow = w < 480
    const top = narrow ? 44 : 26
    const bottom = 18
    const sh = Math.round(Math.max(34, Math.min(84, h * 0.17)))
    const spec = { x: 8, y: h - bottom - sh, w: w - 16, h: sh }
    const body = { x: 0, y: top, w, h: spec.y - top - 6 }
    let atom
    let diag
    if (w >= 1.15 * body.h) {
      const aw = Math.round(Math.min(w * 0.52, body.h * 1.25))
      atom = { x: 0, y: body.y, w: aw, h: body.h }
      diag = { x: aw, y: body.y, w: w - aw - 6, h: body.h }
    } else {
      const ah = Math.round(body.h * 0.55)
      atom = { x: 0, y: body.y, w, h: ah }
      diag = { x: 0, y: body.y + ah, w: w - 6, h: body.h - ah }
    }
    return { atom, diag, spec, cap: narrow ? { x: 8, y: 36 } : { x: 162, y: 14 }, narrow }
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
    let R = null
    let ow = 0
    let oh = 0
    const mark = {}
    const levels = D.levels
    const lines = D.lines
    graph()
    const counts = new Float64Array(lines.length)
    const flash = new Float64Array(lines.length)
    let level = levels.findIndex(l => l.id === '2p2_3P_2')
    let due = Infinity
    let shown = 0
    let now = 0
    let last = null
    let cause = { text: 'at rest in the ground term', t: -10 }
    let photons = []
    let cl = null
    let view = 6
    // The camera's turn about the vertical and its height, the time the
    // pointer last turned it, and the press while the pointer is down.
    const cam = { yaw: 0.4, pitch: 0.32, held: -1e9 }
    let press = null
    const tally = { clicks: 0, turns: 0, excitations: 0, photons: 0, detected: 0 }

    // ---- The atom's state ----

    function enter (i, why) {
      level = i
      shown = Clock.wait(levels[i], Math.random())
      due = now + shown
      if (why) cause = { text: why, t: now }
      cl = Cloud.make(levels[i])
    }

    function excite (i, why) {
      if (i < 0 || i === level) return
      tally.excitations++
      enter(i, why)
    }

    // Collision onto a level among those of confs, by statistical weight.
    function collide (confs, why) {
      const set = levels.map((l, i) => i).filter(i => confs.includes(levels[i].conf))
      excite(pick(set, i => levels[i].g, Math.random()), why)
    }

    // A photon absorbed from the present level, from a lamp of flat
    // spectral energy density: among the absorptions in fifth band of
    // five by the upper level's energy, or among all for band -1.
    function absorb (band, why) {
      const all = absorptions(level)
      if (!all.length) {
        cause = { text: why + ': no E1 line up from ' + levelName(levels[level]), t: now }
        return
      }
      let set = all
      if (band >= 0 && band < 5) {
        const a = Math.floor(band * all.length / 5)
        const b = Math.floor((band + 1) * all.length / 5)
        if (b > a) set = all.slice(a, b)
      }
      const k = pick(set, k => lines[k].f * wl(lines[k]), Math.random())
      excite(lines[k].u, why + ': absorbed ' + wlText(wl(lines[k])))
    }

    function emit () {
      const k = decay(level, Math.random())
      const ln = lines[k]
      tally.photons++
      photons.push({ k, t: now, ph: Photon.make(levels[ln.u], levels[ln.l], ln) })
      if (photons.length > 6) photons.shift()
      last = { k, waited: shown, t: now, ph: photons[photons.length - 1].ph }
      enter(ln.l, null)
    }

    // The session's events: see decision 0015's table.
    function react (e) {
      if (e.kind === 3) collide(['2s2.2p.4d', '2s2.2p.5s'], 'prompt: electron collision')
      else if (e.kind === 4) collide(['2s2.2p.4p'], 'stop: electron collision')
      else if (e.kind === 2) absorb(e.cls >= 0 && e.cls < 5 ? e.cls : -1, 'tool call')
      else if (e.kind === 5) excite(levels.findIndex(l => l.id === '2s2p3_5So_2'), 'subagent: spin-exchange collision')
      else if (e.kind === 6) excite(thermal(Math.random()), 'compaction: quenched by a collision, no light')
      else if (e.kind === 1 && ground(levels[level])) {
        const i = thermal(Math.random())
        if (i !== level) {
          tally.excitations++
          enter(i, 'output: a thermal collision, J=' + levels[i].J)
        }
      }
    }

    // ---- Drawing ----

    function yOf (E) {
      const d = R.dd
      return d.bot - (d.bot - d.top) * E / D.limit
    }

    const colX = c => R.dd.x0 + c * R.dd.cw

    function drawDiagram () {
      const { diag } = R
      diagC = cpu(diag.w, diag.h)
      const g = diagC.g
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
      g.fillText((small ? 'limit ' : 'ionization limit ') + D.limitEV.toFixed(2) + ' eV', diag.w - 6, dd.top - 8)
      // The energy axis in eV.
      g.strokeStyle = '#1f2838'
      g.beginPath()
      g.moveTo(dd.x0 - 6, dd.top)
      g.lineTo(dd.x0 - 6, dd.bot)
      g.stroke()
      const perEV = D.limit / D.limitEV
      for (let e = 0; e <= 10; e += small ? 5 : 2) g.fillText(e + (small ? '' : ' eV'), dd.x0 - 9, yOf(e * perEV))
      g.textAlign = 'center'
      if (!small) COL_NAME.forEach((n, c) => g.fillText(n, colX(c) + dd.cw / 2, dd.bot + 13))
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
      // columns' empty band between 1.2 and 6 eV.
      R.inset = null
      if (diag.h >= 140) {
        const ix = Math.round(colX(2) + 4)
        const iw = Math.round(Math.min(dd.cw * 2 - 8, 130))
        const iy = Math.round(yOf(6 * perEV))
        const ih = Math.round(Math.min(yOf(1.2 * perEV) - iy, 96))
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
        g.fillText(SUP[3] + 'P ' + TIMES + Math.round(mag), ix + 4, iy + 9)
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
          g.fillText('J=' + lv.J + (iw > 90 ? '  ' + lv.E.toFixed(1) + ' cm' + U(0x207b, 0xb9) : ''), ix + iw * 0.45 + 4, y)
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
        g.fillText(t, specX(nm), base + 3)
      }
      g.fillText('far IR', specX(370000), base + 3)
      g.strokeStyle = '#33405a'
      g.strokeRect(Math.round(specX(370000)) - 16.5, 2.5, 33, base - 3)
      if (s.w >= 330) {
        g.textAlign = 'left'
        g.fillText('visible', specX(380) + 2, 3)
      }
      lines.forEach(ln => {
        g.fillStyle = visible(ln) ? ln.rgb : '#3d4860'
        g.globalAlpha = visible(ln) ? 0.6 : 0.8
        g.fillRect(Math.round(specX(wl(ln))), base - 4, 1, 4)
      })
      g.globalAlpha = 1
    }

    function resize (w, h) {
      layer = cpu(w, h)
      R = regions(w, h)
      drawDiagram()
      drawSpectrum()
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

    // The atom's frame on screen this frame. Its z axis is the axis the
    // photons' M components are taken about.
    const F = { cx: 0, cy: 0, k: 1, edge: 1, project: null, turn: null }
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

    function drawAtom (g, dim, w, h) {
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
      // A faint equator and meridian, for depth, and the photons' axis.
      g.save()
      g.beginPath()
      g.rect(a.x, a.y, a.w, a.h)
      g.clip()
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
      g.restore()
      g.save()
      g.globalCompositeOperation = 'lighter'
      // The cloud, far points dimmer and smaller, dimmed further while a
      // jump's source shows over it.
      if (photons.some(p => p.ph.src && now - p.t < SOURCE_T)) dim *= 0.45
      Cloud.draw(cl, F, a, dim, rect)
      const c = F.project(0, 0, 0)
      rect('#ffffff', 1, c.x, c.y, 2)
      flush(g)
      // The photons, over the whole pane: a shell reaches its nearest
      // edge, and its detection lights the spectrum.
      photons = photons.filter(p => {
        const st = Photon.draw(g, p.ph, F, now - p.t, rect)
        if (st === 'detected') {
          counts[p.k]++
          flash[p.k] = 1
          tally.detected++
        }
        return st !== 'done'
      })
      flush(g)
      g.restore()
      // The axis, dashed through the atom, while a photon flies.
      const flying = photons.find(p => now - p.t < FLIGHT)
      g.font = '10px ' + MONO
      if (flying) {
        const top = F.project(0, 0, 1.15 * view)
        const tx = top.x
        const ty = top.y
        const bot = F.project(0, 0, -1.15 * view)
        g.strokeStyle = '#8a94a8'
        g.setLineDash([2, 4])
        g.beginPath()
        g.moveTo(tx, ty)
        g.lineTo(bot.x, bot.y)
        g.stroke()
        g.setLineDash([])
        g.fillStyle = '#8a94a8'
        g.textAlign = 'left'
        g.textBaseline = 'alphabetic'
        g.fillText('z, chosen', tx + 4, Math.max(a.y + 10, ty))
      }
      // A scale bar and the labels.
      g.textBaseline = 'alphabetic'
      g.textAlign = 'left'
      const step = [1, 2, 5, 10, 20, 50].find(s => s * F.k >= a.w * 0.1) || 50
      const bx = a.x + 10
      const by = a.y + a.h - 6
      g.fillStyle = '#7d89a1'
      g.fillRect(bx, by, step * F.k, 1)
      g.fillText(step + ' ' + A0 + ' = ' + (step * D.bohrNm).toFixed(2) + ' nm', bx, by - 4)
      const lv = levels[level]
      const o = shells(lv).find(e => e.outer)
      const rows = [['#e8eefc', levelName(lv)]]
      if (ground(lv)) rows.push(['#8c97ad', 'ground term, at rest'])
      else {
        rows.push(['#8c97ad', TAU + ' ' + timeText(lv.tau) + (lv.tau < ALLOWED ? ', ' + TIMES + sci(SLOW) + ' on screen' : lv.tau > CAP ? ', capped at ' + CAP + ' s' : ', real time')])
        rows.push(['#8c97ad', 'next jump in ' + Math.max(0, due - now).toFixed(1) + ' s'])
      }
      if (o) rows.push(['#ffcf7a', o.nl + ' cloud: a model, <r> ' + D.outer[o.key].meanR.toFixed(1) + ' ' + A0])
      if (now - cause.t < 6) rows.push(['#9fb7e0', cause.text])
      if (flying) {
        const p = flying.ph
        const ln = p.ln
        rows.push(['#c9d3e6', 'photon ' + DELTA + 'M=' + (p.q > 0 ? '+' : '') + p.q + ' ' + ln.type + ', ' + patternName(ln.type, p.q), visible(ln) ? ln.rgb : '#aab3c5'])
        rows.push(['#8c97ad', p.mv ? 'source: ' + PSI + 'f*' + PSI + 'i of the jump, + mint, - pink' : 'source: a two-electron jump, not drawn'])
        rows.push(['#8c97ad', wlText(wl(ln)) + ' = ' + Math.round(wl(ln) / (size(p.up) * D.bohrNm)) + TIMES + ' this atom: fronts, shell, speed are symbols'])
      }
      const fit = a.w - 14
      // A small pane keeps the level, its clock and the photon.
      if (a.w < 320) rows.splice(2, rows.length, ...rows.filter(r => r[2]))
      rows.forEach(([col, t, swatch], j) => {
        const y = a.y + 11 + 12 * j
        let x = a.x + 8
        if (swatch) {
          g.fillStyle = swatch
          g.fillRect(x, y - 7, 7, 7)
          x += 11
        }
        g.fillStyle = col
        g.fillText(clip(g, t, fit - (x - a.x - 8)), x, y)
      })
    }

    function clip (g, t, w) {
      if (g.measureText(t).width <= w) return t
      while (t.length > 4 && g.measureText(t + DOTS).width > w) t = t.slice(0, -1)
      return t + DOTS
    }

    function drawDiagramNow (g) {
      const d = R.diag
      g.drawImage(diagC.c, d.x, d.y)
      const lv = levels[level]
      const cw = R.dd.cw
      // The last jump: an arrow from the upper level to the lower, in its
      // light's colour, or grey and dashed outside the visible.
      if (last && now - last.t < 8) {
        const ln = lines[last.k]
        const up = levels[ln.u]
        const low = levels[ln.l]
        const a = Math.max(0.3, 1 - (now - last.t) / 8)
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
        g.font = '10px ' + MONO
        g.textAlign = 'left'
        g.textBaseline = 'middle'
        const t = wlText(wl(ln))
        g.fillText(t, Math.min(d.x + d.w - g.measureText(t).width - 2, (x1 + x2) / 2 + 6), (y1 + y2) / 2)
        g.restore()
      }
      // The present level, lit, and in the inset its J.
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
      g.fillText(label, right ? x + cw : x - 2, y - 7)
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
          g.globalAlpha = 0.3 * flash[k]
          g.fillRect(x - 5, s.y + 3, 11, R.base - 3)
        }
        flash[k] *= Math.exp(-dt / 0.6)
      }
      g.restore()
    }

    function caption (g, w) {
      if (!last) return
      const ln = lines[last.k]
      const t = levelName(levels[ln.u]) + TO + levelName(levels[ln.l]) + '  ' + wlText(wl(ln)) + (ln.type !== 'E1' ? ' ' + ln.type : '') + '  A ' + sci(ln.A) + ' s' + U(0x207b, 0xb9) + '  ' + TAU + ' ' + timeText(levels[ln.u].tau) + '  waited ' + timeText(last.waited)
      g.font = '11px ' + MONO
      g.textAlign = 'left'
      g.textBaseline = 'middle'
      g.fillStyle = '#c9d3e6'
      g.fillText(clip(g, t, w - R.cap.x - 8), R.cap.x, R.cap.y)
    }

    enter(level, null)

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
        let n = 0
        while (now >= due && n++ < 8) emit()
        // The zoom eases toward the present level's size, or a fresh
        // jump's upper level's while its source shows.
        let big = size(levels[level])
        for (const p of photons) if (p.ph.src && now - p.t < SOURCE_T) big = Math.max(big, size(p.ph.up))
        const want = Math.max(5, Math.min(60, 2.5 * big))
        view += (want - view) * (1 - Math.exp(-dt / 0.35))
        Cloud.step(cl, dt)
        if (now - cam.held > 4) cam.yaw += dt * 0.25 * (1 - 0.7 * L.idle)
        const g = layer.g
        g.globalCompositeOperation = 'source-over'
        g.globalAlpha = 1
        g.fillStyle = '#03050a'
        g.fillRect(0, 0, w, h)
        drawSpectrumNow(g, dt)
        drawDiagramNow(g)
        drawAtom(g, 1 - 0.3 * L.idle, w, h)
        caption(g, w)
        out.drawImage(layer.c, 0, 0)
      },

      // A drag across the atom turns the camera. A click on the atom
      // shines a lamp on it: a photon absorbed from the present level. A
      // click on the level diagram excites the level nearest it in that
      // column by a collision.
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
          if (best >= 0 && gap < 30) excite(best, 'click: electron collision')
        } else if (inside(R.atom, x, y)) absorb(-1, 'click: a lamp')
      },

      // For the live checks: the clicks, the camera's turns, the
      // excitations, photons emitted and detected, the present level, the
      // lines lit so far, and each photon in flight.
      probe () {
        let lit = 0
        for (let k = 0; k < counts.length; k++) if (counts[k]) lit++
        const flying = photons.map(p => ({ nm: wl(p.ph.ln), band: p.ph.ln.band, type: p.ph.ln.type, q: p.ph.q, source: !!p.ph.src, age: Math.round((now - p.t) * 100) / 100, detected: !!p.ph.hit }))
        return Object.assign({ level: levels[level].id, lit, flying }, tally)
      }
    }
  }

  const api = { Clock, Cloud, Photon, slater, laguerre, outerP, radialP, radialTable, drawR, meanR, table, shells, size, mover, pattern, patternMax, detectDir, legendre, mPair, source, sphere, waitMean, decay, thermal, absorptions, pick, levelName, wlText, ground, SLOW, CAP }
  if (typeof module === 'object' && module.exports) module.exports = api
  else (root.VizCanvas = root.VizCanvas || {}).carbon = create
})(this)
