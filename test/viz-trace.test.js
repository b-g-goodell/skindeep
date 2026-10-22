'use strict'
// Gravity 3D's optics (decision 0015, issue #170): the exact
// Schwarzschild deflection against published values, the shadow and the
// Einstein ring as the trace draws them, the lens equation of one hole
// and the multi-plane recursion of two, the specific intensity kept
// along a ray, and a curve's images found forward, unbroken (issue
// #182).
const test = require('node:test')
const assert = require('node:assert')
const T = require('../app/viz/trace')

const SEG = new Float64Array(T.STRIDE * T.MAXSEG)

// Carlson's R_F, for the elliptic integrals of the first kind.
function rf (x, y, z) {
  for (let i = 0; i < 60; i++) {
    const l = Math.sqrt(x * y) + Math.sqrt(y * z) + Math.sqrt(z * x)
    x = (x + l) / 4
    y = (y + l) / 4
    z = (z + l) / 4
  }
  return 1 / Math.sqrt((x + y + z) / 3)
}
const K = k => rf(0, 1 - k * k, 1)
const F = (psi, k) => Math.sin(psi) * rf(Math.cos(psi) ** 2, 1 - k * k * Math.sin(psi) ** 2, 1)

// The deflection of a ray of impact parameter b about a hole of r_s.
const alpha = (b, rs) => T.deflection(T.RING * rs / b)

// Where the ray from the origin along unit d crosses the plane z = Z,
// or null if it does not.
function at (d, hs, nh, Z) {
  const n = Math.abs(T.trace(0, 0, 0, d[0], d[1], d[2], hs, nh, SEG))
  for (let s = 0; s < n; s++) {
    const k = T.STRIDE * s
    const z0 = SEG[k + 2]
    const ez = SEG[k + 5]
    const z1 = SEG[k + 6] === Infinity ? (ez > 0 ? Infinity : -Infinity) : z0 + SEG[k + 6] * ez
    if ((ez > 0 && Z > z0 && Z <= z1) || (ez < 0 && Z < z0 && Z >= z1)) {
      const t = (Z - z0) / ez
      return [SEG[k] + t * SEG[k + 3], SEG[k + 1] + t * SEG[k + 4]]
    }
  }
  return null
}

const unit = (x, y, z) => {
  const l = Math.hypot(x, y, z)
  return [x / l, y / l, z / l]
}

test('trace: the deflection matches the weak-field series of Keeton and Petters far out', () => {
  // Keeton and Petters 2005, eqs. 24 and 25, m = r_s / 2.
  const A = [4, 15 * Math.PI / 4, 128 / 3, 3465 * Math.PI / 64, 3584 / 5, 255255 * Math.PI / 256]
  for (const bm of [50, 200, 1000]) {
    const series = A.reduce((s, a, i) => s + a / bm ** (i + 1), 0)
    const got = alpha(bm, 2)
    assert.ok(Math.abs(got - series) / series < 2e-5, `b = ${bm} m: ${got} against ${series}`)
  }
  assert.ok(Math.abs(alpha(1e4, 2) - 4e-4) / 4e-4 < 1e-3, 'alpha tends to 2 r_s / b')
})

test('trace: the deflection matches the exact closed form of Iyer and Petters between', () => {
  // Iyer and Petters 2007, eq. 8, m = 1: alpha = 4 sqrt(r_0 / Q) (K(k) - F(psi, k)) - pi.
  for (const r0 of [3.2, 3.5, 4, 6, 10, 30]) {
    const Q = Math.sqrt((r0 - 2) * (r0 + 6))
    const k = Math.sqrt((Q - r0 + 6) / (2 * Q))
    const psi = Math.asin(Math.sqrt((Q + 2 - r0) / (Q + 6 - r0)))
    const want = 4 * Math.sqrt(r0 / Q) * (K(k) - F(psi, k)) - Math.PI
    const b = r0 / Math.sqrt(1 - 2 / r0)
    const got = alpha(b, 2)
    assert.ok(Math.abs(got - want) < 2e-5 * Math.max(1, want), `r_0 = ${r0} m: ${got} against ${want}`)
  }
})

test('trace: the deflection diverges at b_c as Bozza\'s strong-field limit', () => {
  // Bozza 2002, eq. 50: alpha = -ln(b / b_c - 1) + ln(216 (7 - 4 sqrt 3)) - pi.
  const bozza = x => -Math.log(x) + Math.log(216 * (7 - 4 * Math.sqrt(3))) - Math.PI
  for (const x of [1e-4, 1e-5, 1e-6]) {
    const got = T.deflection(1 / (1 + x))
    assert.ok(Math.abs(got - bozza(x)) < 2e-3, `b / b_c - 1 = ${x}: ${got} against ${bozza(x)}`)
  }
  // Bozza: where alpha falls below 2 pi, u - u_m = 0.003264 in units of
  // r_s, the limit is off the exact value by about 0.06 %.
  const x = 0.003264 / T.RING
  const got = T.deflection(1 / (1 + x))
  assert.ok(Math.abs(got - 2 * Math.PI) < 0.01, `alpha ${got} there, near 2 pi`)
  const off = Math.abs(bozza(x) - got) / got
  assert.ok(off > 0.0004 && off < 0.0008, `the limit is off by ${off * 100} %`)
})

test('trace: the shadow is the capture of rays of b below sqrt(27) / 2 r_s', () => {
  const rs = 10
  const D = 600
  const hs = new Float64Array([0, 0, D, T.RING * rs])
  const captured = th => T.trace(0, 0, 0, Math.sin(th), 0, Math.cos(th), hs, 1, SEG) < 0
  let lo = 0
  let hi = 0.2
  assert.ok(captured(lo) && !captured(hi))
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2
    if (captured(m)) lo = m
    else hi = m
  }
  const want = Math.asin(Math.sqrt(27) / 2 * rs / D)
  assert.ok(Math.abs(lo - want) < 1e-9, `the shadow's edge at ${lo} rad, want ${want}`)
  // Just outside, the ray loops the hole: more than 2 pi.
  const ev = []
  T.trace(0, 0, 0, Math.sin(want * 1.00001), 0, Math.cos(want * 1.00001), hs, 1, SEG, ev)
  assert.ok(ev[2] > 2 * Math.PI, `alpha ${ev[2]} at the edge`)
})

test('trace: one hole bends a ray by the lens equation of Virbhadra and Ellis', () => {
  const rs = 13.6
  const Dd = 620
  const Ds = 900
  const hs = new Float64Array([0, 0, Dd, T.RING * rs])
  for (const th of [0.075, 0.09, 0.12, 0.3]) {
    const p = at([Math.sin(th), 0, Math.cos(th)], hs, 1, Ds)
    const a = alpha(Dd * Math.sin(th), rs)
    // Eqs. 1 to 3: tan beta = tan theta - D_ds / D_s (tan theta + tan(alpha - theta)).
    const want = Math.tan(th) - (Ds - Dd) / Ds * (Math.tan(th) + Math.tan(a - th))
    assert.ok(Math.abs(p[0] / Ds - want) < 1e-5, `theta ${th}: tan beta ${p[0] / Ds} against ${want}`)
  }
})

test('trace: a source right behind a hole is drawn as a ring at the Einstein radius', () => {
  // The weak field: theta_E^2 = 2 r_s D_ls / (D_l D_s), far outside the shadow.
  const rs = 0.01
  const Dl = 620
  const Ds = 2000
  const W = 241
  const f = 15000
  const te = f * Math.sqrt(2 * rs * (Ds - Dl) / (Dl * Ds))
  assert.ok(te > 8 * f * T.RING * rs / Dl, 'the ring far outside the shadow')
  // A dot of radius 1.5 px seen unlensed at the centre of a plane at D_s.
  const data = new Uint8ClampedArray(W * W * 4)
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      if ((x + 0.5 - W / 2) ** 2 + (y + 0.5 - W / 2) ** 2 > 2.25) continue
      data.set([255, 255, 255, 255], 4 * (y * W + x))
    }
  }
  const sc = { w: W, h: W, cx: W / 2, cy: W / 2, f, S: 6, hs: new Float64Array([0, 0, Dl, T.RING * rs]), nh: 1, bref: new Float64Array([Infinity]), planes: [T.plane(Ds, data, W, W)], sky: null }
  const out = new Uint8ClampedArray(W * W * 4)
  T.render(sc, out)
  const deg = new Set()
  let n = 0
  let sum = 0
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      if (out[4 * (y * W + x)] < 64) continue
      const dx = x + 0.5 - W / 2
      const dy = y + 0.5 - W / 2
      const r = Math.hypot(dx, dy)
      n++
      sum += r
      deg.add(Math.floor((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI) * 36) % 36)
      assert.ok(Math.abs(r - te) < 4, `a lit pixel at ${r} px, the ring at ${te}`)
    }
  }
  assert.ok(n > 0, 'the source is not seen')
  assert.ok(Math.abs(sum / n - te) / te < 0.01, `the ring's mean radius ${sum / n} px against ${te}`)
  assert.strictEqual(deg.size, 36, 'a ring all round')
})

test('trace: two holes compose by the multi-plane recursion', () => {
  // McCully et al. 2014, eq. 16, in the positions on each plane: the
  // second hole bends the ray where the first sent it.
  const hs = new Float64Array([10, 0, 500, T.RING * 0.4, -15, 25, 800, T.RING * 0.8])
  const Ds = 1500
  for (const [tx, ty] of [[0.05, 0.02], [0.03, 0.06], [0.06, -0.01]]) {
    const d = unit(tx, ty, 1)
    const got = at(d, hs, 2, Ds)
    let p = [500 * d[0] / d[2], 500 * d[1] / d[2]]
    let th = [d[0] / d[2], d[1] / d[2]]
    let z = 500
    for (let i = 0; i < 2; i++) {
      if (i) {
        p = [p[0] + (800 - z) * th[0], p[1] + (800 - z) * th[1]]
        z = 800
      }
      const xi = [p[0] - hs[4 * i], p[1] - hs[4 * i + 1]]
      const b = Math.hypot(xi[0], xi[1])
      const a = T.deflection(hs[4 * i + 3] / b)
      th = [th[0] - a * xi[0] / b, th[1] - a * xi[1] / b]
    }
    const want = [p[0] + (Ds - z) * th[0], p[1] + (Ds - z) * th[1]]
    // The unlensed place, to show the bend is large against the test.
    const free = [Ds * d[0] / d[2], Ds * d[1] / d[2]]
    const bend = Math.hypot(want[0] - free[0], want[1] - free[1])
    const err = Math.hypot(got[0] - want[0], got[1] - want[1])
    assert.ok(bend > 15, `the bend ${bend}`)
    assert.ok(err < 0.01 * bend, `ray ${tx}, ${ty}: off the recursion by ${err} of a bend of ${bend}`)
  }
})

test('trace: a ray turned back by one hole is bent by a hole it then meets', () => {
  // Past the photon sphere a ray turns by more than pi / 2 and comes back
  // toward the camera, across the lens plane of a hole in front of the
  // first, which it crossed once already on its way in.
  const rs = 10
  const hs = new Float64Array([0, 0, 600, T.RING * rs, 0, 0, 0, 0])
  const th = Math.asin(T.RING * rs * 1.02 / 600)
  const d = [Math.sin(th), 0, Math.cos(th)]
  const ev = []
  T.trace(0, 0, 0, d[0], d[1], d[2], hs, 1, SEG, ev)
  assert.ok(ev[2] > Math.PI / 2 && ev[2] < 3 * Math.PI / 2, `alpha ${ev[2]} turns it back`)
  // Its outgoing line from the first lens plane, and a second hole, of
  // too little mass to bend the ray on its way in, put at depth 300, 20
  // beside where that line crosses it.
  const k0 = [600 * d[0] / d[2], 0, 600]
  // The ray's offset from the hole at its closest point: q, across d.
  const q = [Math.cos(th), 0, -Math.sin(th)]
  const o = unit(Math.cos(ev[2]) * d[0] - Math.sin(ev[2]) * q[0], 0, Math.cos(ev[2]) * d[2] - Math.sin(ev[2]) * q[2])
  const t = (300 - 600) / o[2]
  const hx = k0[0] + t * o[0] + 20
  hs.set([hx, 0, 300, T.RING * 1e-12], 4)
  const n = T.trace(0, 0, 0, d[0], d[1], d[2], hs, 2, SEG, ev)
  assert.strictEqual(n, 4, 'in, past the second hole, back from the first and past the second again')
  assert.deepStrictEqual([ev[0], ev[3], ev[6]], [1, 0, 1], 'the second hole, the first, the second')
  assert.ok(ev[8] > 0, 'the second hole bends it')
  // There the second hole's b is the distance of the outgoing line from it.
  const w = [hx - k0[0], 0, 300 - 600]
  const along = w[0] * o[0] + w[2] * o[2]
  const want = Math.hypot(w[0] - along * o[0], w[2] - along * o[2])
  assert.ok(Math.abs(ev[7] - want) < 1e-3, `b ${ev[7]} against ${want}`)
})

test('trace: a uniform sky keeps its brightness wherever it is seen', () => {
  // Specific intensity is constant along a ray: lensing moves light, and
  // magnifies a source by its area, not its surface brightness. Only the
  // shadow is dark.
  const W = 121
  const face = new Uint8ClampedArray(4 * 4 * 4)
  for (let i = 0; i < face.length; i += 4) face.set([100, 150, 200, 255], i)
  const faces = [0, 1, 2, 3, 4, 5].map(() => face)
  const sky = { F: 4, faces, lit: T.skyTiles(faces, 4), nt: 1, dim: 1, m: [1, 0, 0, 0, 1, 0, 0, 0, 1] }
  const hs = new Float64Array([0, 0, 600, T.RING * 13.6])
  const sc = { w: W, h: W, cx: W / 2, cy: W / 2, f: 200, S: 4, hs, nh: 1, bref: new Float64Array([60]), planes: [], sky }
  const out = new Uint8ClampedArray(W * W * 4)
  T.render(sc, out)
  const R = 200 * Math.tan(Math.asin(T.RING * 13.6 / 600))
  let dark = 0
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const k = 4 * (y * W + x)
      const r = Math.hypot(x + 0.5 - W / 2, y + 0.5 - W / 2)
      if (r < R - 0.75) {
        assert.deepStrictEqual([out[k], out[k + 1], out[k + 2]], [0, 0, 0], `the shadow at ${x}, ${y}`)
        dark++
      } else if (r > R + 0.75) assert.deepStrictEqual([out[k], out[k + 1], out[k + 2]], [100, 150, 200], `${x}, ${y}, ${r} px out`)
    }
  }
  assert.ok(Math.abs(dark - Math.PI * R * R) < 2 * Math.PI * R, `the shadow's ${dark} pixels`)
})

// The scene of Gravity 3D's pane of 1200 by 760 at its trace's scale, a
// hole of 900 at depth 620, for the forward map.
const KT = 377 / 1200
const LENS = { cx: 600 * KT, cy: 380 * KT, f: 380 / Math.tan(0.42) * KT, hs: new Float64Array([0, 0, 620, T.RING * 2 * 900 / 11.5 ** 2]), nh: 1 }
const unbent = (X, Y, Z) => [LENS.cx + LENS.f * X / Z, LENS.cy - LENS.f * Y / Z]

test('trace: a point\'s images, found forward, are where their rays meet it', () => {
  // In front of the hole, its one image is where a straight ray shows
  // it. Behind it, off its line and near it, each image's ray crosses
  // the point's depth at the point, the outer one beyond the weak
  // field's Einstein radius on the point's side, the inner one nearer
  // the hole on the other.
  const [qx, qy] = unbent(40, 25, 500)
  assert.ok(T.image(LENS, qx, qy, 500, qx + 3, qy - 2))
  assert.ok(Math.hypot(T.IM[0] - qx, T.IM[1] - qy) < 0.05, 'in front: unbent')
  const hx = LENS.cx
  const hy = LENS.cy
  for (const [X, Y, Z] of [[60, 30, 900], [6, 9, 820]]) {
    const [px, py] = unbent(X, Y, Z)
    const te = LENS.f * Math.sqrt(2 * (LENS.hs[3] / T.RING) * (Z - 620) / (620 * Z))
    const beta = Math.hypot(px - hx, py - hy)
    const ex = (px - hx) / beta
    const ey = (py - hy) / beta
    const found = []
    for (const r of [(beta + Math.sqrt(beta * beta + 4 * te * te)) / 2, -0.8 * te]) {
      assert.ok(T.image(LENS, px, py, Z, hx + ex * r, hy + ey * r), `an image of ${X}, ${Y}, ${Z} from ${r}`)
      found.push([T.IM[0], T.IM[1]])
      assert.ok(T.seen(LENS, T.IM[0], T.IM[1], Z))
      assert.ok(Math.hypot(T.XY[0] - px, T.XY[1] - py) < 0.05, 'its ray meets the point')
    }
    const side = ([x, y]) => (x - hx) * ex + (y - hy) * ey
    assert.ok(side(found[0]) > te, `the outer image beyond the Einstein radius ${te}`)
    assert.ok(side(found[1]) < 0 && -side(found[1]) < side(found[0]), `the inner image at ${side(found[1])}, across the hole and nearer it`)
  }
})

test('trace: a curve\'s images are unbroken through any depth and lensing', () => {
  // The live check's trail: a line of 64 places from 40 to 360 behind
  // the hole, passing above the hole's line, and the same line nearer
  // it, down to 0.3, where the images swing round the hole within a
  // fraction of a piece: about 3 and 1 percent of the Einstein radius
  // there. The same behind a hole of 3000 at 400, whose arcs are longer.
  // Each has an outer image along all of it and an inner one, each a
  // chain of images 3 px apart or less, each image's ray meeting its
  // place.
  const HEAVY = { ...LENS, hs: new Float64Array([0, 0, 400, T.RING * 2 * 3000 / 11.5 ** 2]) }
  for (const [sc, Ys] of [[LENS, [28, 14, 3, 1, 0.3]], [HEAVY, [28, 3, 1, 0.3]]]) {
    const Zh = sc.hs[2]
    for (const Y of Ys) {
      const at = `hole at ${Zh}, Y ${Y}`
      const pl = new Float64Array(3 * 64)
      for (let i = 0; i < 64; i++) pl.set([-220 + 440 * i / 63, Y, Zh + 40 + 320 * i / 63], 3 * i)
      const br = T.curve(sc, pl, 64)
      assert.strictEqual(br.length, 2, `${at}: an outer and an inner image, saw ${br.map(b => b[0].u + '-' + b[b.length - 1].u)}`)
      const outer = br.find(b => b[0].u === 0)
      assert.ok(outer && outer[outer.length - 1].u === 63, `${at}: the outer image along the whole line`)
      for (const b of br) {
        for (let k = 0; k < b.length; k++) {
          const s = b[k]
          if (k) assert.ok(Math.hypot(s.x - b[k - 1].x, s.y - b[k - 1].y) <= 3, `${at}: a step of ${Math.hypot(s.x - b[k - 1].x, s.y - b[k - 1].y)} px at ${s.u}`)
          const i = Math.min(62, Math.floor(s.u))
          const f = s.u - i
          const Z = pl[3 * i + 2] + (pl[3 * i + 5] - pl[3 * i + 2]) * f
          assert.ok(T.seen(sc, s.x, s.y, Z) && Math.hypot(T.XY[0] - s.qx, T.XY[1] - s.qy) < 0.05, `${at}: the image at ${s.u} meets its place`)
        }
      }
    }
  }
  // A curve that runs behind the camera has one image, unbroken across
  // the trace's frame, 377 by 239, which ends past its edge, before the
  // curve's depth falls below 1.
  const pl = new Float64Array(3 * 32)
  for (let i = 0; i < 32; i++) pl.set([60 - 200 * i / 31, -40 + 120 * i / 31, 600 - 700 * i / 31], 3 * i)
  const br = T.curve(LENS, pl, 32)
  assert.strictEqual(br.length, 1, 'one image')
  const last = br[0][br[0].length - 1]
  assert.ok(br[0][0].u === 0 && last.u < 31 * 599 / 700, `from the first place to ${last.u}, before the camera`)
  assert.ok(last.x < 0 || last.y < 0 || last.x > 377 || last.y > 239, `it ends at ${last.x}, ${last.y}, past the frame's edge`)
  for (let k = 1; k < br[0].length; k++) assert.ok(Math.hypot(br[0][k].x - br[0][k - 1].x, br[0][k].y - br[0][k - 1].y) <= 3)
})

test('trace: a screen plane is read where it is drawn, a plane where its rays meet it', () => {
  // One dot drawn at the same place on a plane and on a screen plane, both
  // behind the hole: the plane's dot is bent away from where it is drawn,
  // the screen plane's stays.
  const W = 121
  const dot = new Uint8ClampedArray(W * W * 4)
  const at = [80, 60]
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) if ((x + 0.5 - at[0]) ** 2 + (y + 0.5 - at[1]) ** 2 <= 4) dot.set([255, 255, 255, 255], 4 * (y * W + x))
  }
  const centre = (planes) => {
    const sc = { w: W, h: W, cx: W / 2, cy: W / 2, f: 200, S: 6, hs: new Float64Array([0, 0, 600, T.RING * 13.6]), nh: 1, bref: new Float64Array([60]), planes, sky: null }
    const out = new Uint8ClampedArray(W * W * 4)
    T.render(sc, out)
    let n = 0
    let sx = 0
    let sy = 0
    for (let y = 0; y < W; y++) {
      for (let x = 0; x < W; x++) {
        const v = out[4 * (y * W + x)]
        if (v < 64) continue
        n++
        sx += x + 0.5
        sy += y + 0.5
      }
    }
    return [sx / n, sy / n]
  }
  const screen = T.plane(900, dot, W, W)
  screen.screen = true
  const s = centre([screen])
  assert.ok(Math.hypot(s[0] - at[0], s[1] - at[1]) < 0.3, `the screen plane's dot at ${s}`)
  const p = centre([T.plane(900, dot, W, W)])
  assert.ok(Math.hypot(p[0] - at[0], p[1] - at[1]) > 3, `the plane's dot bent, at ${p}`)
})
