'use strict'
// The optics of Gravity 3D (decision 0015): light traced backward from
// the camera past Schwarzschild holes, by one rule for every ray.
//
// A ray is straight but where it crosses a hole's lens plane, the plane
// through the hole across the camera's axis, in the order it crosses
// them. There it turns toward the hole by the exact Schwarzschild
// deflection alpha(b), b the impact parameter of its line, for any
// alpha, loops included. A ray of b at or below b_c = sqrt(27) / 2 r_s
// is captured. The shadow, the photon ring and the higher images follow
// from that, and the rule is the thin-lens equation with the exact
// alpha (Virbhadra and Ellis 2000), for several holes the multi-plane
// recursion. It holds for source and camera far from the hole next to
// the bend, and is an approximation for matter within a few b of it.
//
// The same rule, solved forward, finds where a point is seen: its
// images, each the frame's point whose ray meets it (image), and a
// curve's, followed along it as unbroken branches (curve).
//
// alpha(b) is tabulated once from the exact integral, as
// g(u) = alpha + ln(1 - u), u = b_c / b, which is smooth on [0, 1]:
// alpha diverges as -ln(b / b_c - 1) (Bozza 2002, a = 1).

;(function (root) {
  const RING = Math.sqrt(27) / 2
  // Bozza 2002, eq. 48: the strong-field coefficient b, the limit of g
  // at u = 1.
  const BBAR = Math.log(216 * (7 - 4 * Math.sqrt(3))) - Math.PI
  const N = 4096
  const G = new Float64Array(N + 1)

  // alpha + pi = 2 int_0^{1/r_0} du / sqrt(1/b^2 - u^2 (1 - r_s u)), in
  // x = u r_0 = 1 - t^2:
  //   int_0^1 4 dt / sqrt((2 - 3s) + (3s - 1) t^2 - s t^4), s = r_s / r_0.
  function exact (s) {
    const f = t => 4 / Math.sqrt((2 - 3 * s) + (3 * s - 1) * t * t - s * t * t * t * t)
    const simpson = (a, b, fa, fm, fb) => (b - a) / 6 * (fa + 4 * fm + fb)
    function step (a, b, fa, fm, fb, whole, tol, depth) {
      const m = (a + b) / 2
      const lm = f((a + m) / 2)
      const rm = f((m + b) / 2)
      const left = simpson(a, m, fa, lm, fm)
      const right = simpson(m, b, fm, rm, fb)
      if (depth <= 0 || Math.abs(left + right - whole) <= 15 * tol) return left + right + (left + right - whole) / 15
      return step(a, m, fa, lm, fm, left, tol / 2, depth - 1) + step(m, b, fm, rm, fb, right, tol / 2, depth - 1)
    }
    const fa = f(0)
    const fm = f(0.5)
    const fb = f(1)
    return step(0, 1, fa, fm, fb, simpson(0, 1, fa, fm, fb), 1e-12, 40) - Math.PI
  }

  // s = r_s / r_0 of the ray of u = b_c / b: u = RING s sqrt(1 - s),
  // increasing on [0, 2/3].
  function closest (u) {
    let lo = 0
    let hi = 2 / 3
    for (let i = 0; i < 60; i++) {
      const s = (lo + hi) / 2
      if (RING * s * Math.sqrt(1 - s) < u) lo = s
      else hi = s
    }
    return (lo + hi) / 2
  }

  for (let i = 0; i < N; i++) {
    const u = i / N
    G[i] = (i ? exact(closest(u)) : 0) + Math.log(1 - u)
  }
  G[N] = BBAR

  // The deflection of a ray of u = b_c / b, in radians.
  function deflection (u) {
    if (u <= 0) return 0
    if (u >= 1) return Infinity
    const x = u * N
    const i = x | 0
    return G[i] + (G[i + 1] - G[i]) * (x - i) - Math.log(1 - u)
  }

  // alpha, cos alpha and sin alpha tabulated below u = UTAB, where they
  // are smooth, for the trace: turn(u) leaves them in TA, TC and TS.
  const UTAB = 0.95
  const NT = Math.ceil(UTAB * N)
  const AT = new Float64Array(NT + 2)
  const CT = new Float64Array(NT + 2)
  const ST = new Float64Array(NT + 2)
  for (let i = 0; i < NT + 2; i++) {
    AT[i] = deflection(i / N)
    CT[i] = Math.cos(AT[i])
    ST[i] = Math.sin(AT[i])
  }
  let TA = 0
  let TC = 1
  let TS = 0
  function turn (u) {
    if (u < UTAB) {
      const x = u * N
      const i = x | 0
      const f = x - i
      TA = AT[i] + (AT[i + 1] - AT[i]) * f
      TC = CT[i] + (CT[i + 1] - CT[i]) * f
      TS = ST[i] + (ST[i + 1] - ST[i]) * f
    } else {
      TA = deflection(u)
      TC = Math.cos(TA)
      TS = Math.sin(TA)
    }
  }

  const MAXEV = 8
  const STRIDE = 7
  const MAXSEG = 1 + MAXEV

  // Trace the ray from (ox, oy, oz) along unit (dx, dy, dz) past the nh
  // holes of hs, a flat array of [x, y, z, b_c] each, z the depth along
  // the camera's axis. The ray is bent where it crosses a hole's lens
  // plane, the plane of the hole's depth, in the order it crosses them:
  // its direction turns by alpha(b) toward the hole, b the distance of
  // its line from the hole, in the plane of the line and the hole. For
  // one hole on the axis this is the lens equation of Virbhadra and
  // Ellis (2000, eqs. 1 and 2), which allows any alpha, and for several
  // the multi-plane recursion (McCully et al. 2014, eq. 16) with the
  // exact alpha. Its straight pieces go into seg, STRIDE each: origin,
  // unit direction and length, the last of length Infinity unless the
  // ray is captured. Returns the count of pieces, negative if the ray is
  // captured. ev, if given, gets each hole met, its b and its alpha, in
  // order.
  function trace (ox, oy, oz, dx, dy, dz, hs, nh, seg, ev) {
    let n = 0
    let last = -1
    if (ev) ev.length = 0
    for (let e = 0; e < MAXEV; e++) {
      let best = Infinity
      let bi = -1
      if (dz !== 0) {
        for (let i = 0; i < nh; i++) {
          if (i === last) continue
          const t = (hs[4 * i + 2] - oz) / dz
          if (t > 1e-9 && t < best) {
            best = t
            bi = i
          }
        }
      }
      if (bi < 0) break
      const k = STRIDE * n++
      seg[k] = ox
      seg[k + 1] = oy
      seg[k + 2] = oz
      seg[k + 3] = dx
      seg[k + 4] = dy
      seg[k + 5] = dz
      seg[k + 6] = best
      // The line's closest point to the hole, and its offset from it.
      const hx = hs[4 * bi]
      const hy = hs[4 * bi + 1]
      const hz = hs[4 * bi + 2]
      const bc = hs[4 * bi + 3]
      const tc = (hx - ox) * dx + (hy - oy) * dy + (hz - oz) * dz
      const px = ox + tc * dx - hx
      const py = oy + tc * dy - hy
      const pz = oz + tc * dz - hz
      const b = Math.sqrt(px * px + py * py + pz * pz)
      if (b <= bc) {
        if (ev) ev.push(bi, b, Infinity)
        return -n
      }
      turn(bc / b)
      if (ev) ev.push(bi, b, TA)
      const qx = px / b
      const qy = py / b
      const qz = pz / b
      ox += best * dx
      oy += best * dy
      oz = hz
      const ndx = TC * dx - TS * qx
      const ndy = TC * dy - TS * qy
      const ndz = TC * dz - TS * qz
      const l = Math.sqrt(ndx * ndx + ndy * ndy + ndz * ndz)
      dx = ndx / l
      dy = ndy / l
      dz = ndz / l
      last = bi
    }
    const k = STRIDE * n++
    seg[k] = ox
    seg[k + 1] = oy
    seg[k + 2] = oz
    seg[k + 3] = dx
    seg[k + 4] = dy
    seg[k + 5] = dz
    seg[k + 6] = Infinity
    return n
  }

  // A plane of the scene: its sources drawn flat at depth z, seen from
  // the camera, as RGBA, w by h, not premultiplied, at (ox, oy) in the
  // frame, k of its pixels to one of the frame's (1 but for an edge
  // plane), and which tiles of TILE pixels hold anything, as sums over
  // the tiles above and left. A screen plane holds what is drawn where
  // it is seen, already bent (image): a ray that reaches its depth reads
  // it at the ray's own pixel.
  const TILE = 8
  function plane (z, data, w, h, p, ox = 0, oy = 0) {
    const tw = Math.ceil(w / TILE)
    const th = Math.ceil(h / TILE)
    if (!p || p.occ.length < tw * th || p.sum.length < (tw + 1) * (th + 1)) p = { z: 0, data: null, w: 0, h: 0, tw: 0, th: 0, ox: 0, oy: 0, edge: false, add: false, smooth: false, screen: false, k: 1, dil: null, occ: new Uint8Array(tw * th), sum: new Int32Array((tw + 1) * (th + 1)) }
    p.z = z
    p.data = data
    p.w = w
    p.h = h
    p.tw = tw
    p.th = th
    p.ox = ox
    p.oy = oy
    p.k = 1
    const occ = p.occ
    occ.fill(0)
    for (let y = 0; y < h; y++) {
      const row = (y / TILE | 0) * tw
      let k = 4 * y * w + 3
      for (let x = 0; x < w; x++, k += 4) if (data[k]) occ[row + (x / TILE | 0)] = 1
    }
    // occ grown by a tile, so one look tells a crossing whether a pixel
    // about it may hold anything.
    const dil = p.dil && p.dil.length >= tw * th ? p.dil : (p.dil = new Uint8Array(tw * th))
    dil.fill(0)
    for (let j = 0; j < th; j++) {
      for (let i = 0; i < tw; i++) {
        if (!occ[j * tw + i]) continue
        for (let b = Math.max(0, j - 1); b <= Math.min(th - 1, j + 1); b++) for (let a = Math.max(0, i - 1); a <= Math.min(tw - 1, i + 1); a++) dil[b * tw + a] = 1
      }
    }
    const sum = p.sum
    sum.fill(0)
    for (let j = 0; j < th; j++) {
      let r = 0
      for (let i = 0; i < tw; i++) {
        r += occ[j * tw + i]
        sum[(j + 1) * (tw + 1) + i + 1] = sum[j * (tw + 1) + i + 1] + r
      }
    }
    return p
  }

  // Whether plane p holds anything in pixels x0 to x1 and y0 to y1 of
  // the frame, a pixel more round them.
  function held (p, x0, y0, x1, y1) {
    x0 -= p.ox
    x1 -= p.ox
    y0 -= p.oy
    y1 -= p.oy
    const tx0 = Math.max(0, Math.floor((x0 - 1) / TILE))
    const ty0 = Math.max(0, Math.floor((y0 - 1) / TILE))
    const tx1 = Math.min(p.tw - 1, Math.floor((x1 + 1) / TILE))
    const ty1 = Math.min(p.th - 1, Math.floor((y1 + 1) / TILE))
    if (tx0 > tx1 || ty0 > ty1) return false
    const W = p.tw + 1
    return p.sum[(ty1 + 1) * W + tx1 + 1] - p.sum[ty0 * W + tx1 + 1] - p.sum[(ty1 + 1) * W + tx0] + p.sum[ty0 * W + tx0] > 0
  }

  // The colour gathered along a ray, front to back, premultiplied, in
  // 0 to 255, and what is left of the light behind, T.
  let R = 0
  let Gc = 0
  let B = 0
  let T = 1

  // Plane p seen at (sx, sy), its pixels' centres at half integers,
  // bilinear, laid behind what the ray gathered: specific intensity is
  // carried along the ray unchanged (Liouville), so a plane's colour is
  // taken as it is, magnified or not. A plane that only emits (add)
  // hides nothing behind it, and one held at its edge (edge) is read at
  // its nearest pixel beyond it.
  function sample (p, sx, sy) {
    let x = (sx - p.ox) * p.k - 0.5
    let y = (sy - p.oy) * p.k - 0.5
    const w = p.w
    const h = p.h
    if (p.edge) {
      if (x < 0) x = 0
      else if (x > w - 1.001) x = w - 1.001
      if (y < 0) y = 0
      else if (y > h - 1.001) y = h - 1.001
    }
    const i = Math.floor(x)
    const j = Math.floor(y)
    if (i < -1 || j < -1 || i >= w || j >= h) return
    const fx = x - i
    const fy = y - j
    const d = p.data
    let r = 0
    let g = 0
    let b = 0
    let a = 0
    const i1 = i + 1
    const j1 = j + 1
    if (j >= 0) {
      if (i >= 0) {
        const k = 4 * (j * w + i)
        const q = d[k + 3] * (1 - fx) * (1 - fy)
        if (q) {
          r += d[k] * q
          g += d[k + 1] * q
          b += d[k + 2] * q
          a += q
        }
      }
      if (i1 < w) {
        const k = 4 * (j * w + i1)
        const q = d[k + 3] * fx * (1 - fy)
        if (q) {
          r += d[k] * q
          g += d[k + 1] * q
          b += d[k + 2] * q
          a += q
        }
      }
    }
    if (j1 < h) {
      if (i >= 0) {
        const k = 4 * (j1 * w + i)
        const q = d[k + 3] * (1 - fx) * fy
        if (q) {
          r += d[k] * q
          g += d[k + 1] * q
          b += d[k + 2] * q
          a += q
        }
      }
      if (i1 < w) {
        const k = 4 * (j1 * w + i1)
        const q = d[k + 3] * fx * fy
        if (q) {
          r += d[k] * q
          g += d[k + 1] * q
          b += d[k + 2] * q
          a += q
        }
      }
    }
    if (!a) return
    const t = T / 255
    R += r * t
    Gc += g * t
    B += b * t
    if (!p.add) T *= 1 - a / 255
  }

  // The sky: light from infinity on a cube of six faces F pixels square,
  // RGB(A), each face's place of a direction as onFace (gravity3d.js)
  // puts it, dimmed by dim, seen along unit (dx, dy, dz) of the camera's frame,
  // turned to the world's by m: the camera's right, up and forward.
  let FI = 0
  let FX = 0
  let FY = 0
  function skyPlace (sky, dx, dy, dz) {
    const m = sky.m
    const x = dx * m[0] + dy * m[3] + dz * m[6]
    const y = dx * m[1] + dy * m[4] + dz * m[7]
    const z = dx * m[2] + dy * m[5] + dz * m[8]
    const ax = Math.abs(x)
    const ay = Math.abs(y)
    const az = Math.abs(z)
    let a, b
    if (ax >= ay && ax >= az) {
      FI = x > 0 ? 0 : 1
      a = y / ax
      b = z / ax
    } else if (ay >= az) {
      FI = y > 0 ? 2 : 3
      a = x / ay
      b = z / ay
    } else {
      FI = z > 0 ? 4 : 5
      a = x / az
      b = y / az
    }
    FX = (a + 1) * sky.F / 2 - 0.5
    FY = (b + 1) * sky.F / 2 - 0.5
  }

  // Which tiles of 4 pixels of each face hold any light, a pixel round
  // them included: most of the sky is black, and read no further there.
  function skyTiles (faces, F) {
    const nt = Math.ceil(F / 4)
    return faces.map(d => {
      const m = new Uint8Array(nt * nt)
      for (let y = 0; y < F; y++) {
        for (let x = 0; x < F; x++) {
          const k = 4 * (y * F + x)
          if (!(d[k] | d[k + 1] | d[k + 2])) continue
          for (let b = Math.max(0, (y - 1) >> 2); b <= Math.min(nt - 1, (y + 1) >> 2); b++) {
            for (let a = Math.max(0, (x - 1) >> 2); a <= Math.min(nt - 1, (x + 1) >> 2); a++) m[b * nt + a] = 1
          }
        }
      }
      return m
    })
  }

  function skyAdd (sky, fi, x, y) {
    const F = sky.F
    if (x < 0) x = 0
    else if (x > F - 1.001) x = F - 1.001
    if (y < 0) y = 0
    else if (y > F - 1.001) y = F - 1.001
    const i = x | 0
    const j = y | 0
    if (!sky.lit[fi][(j >> 2) * sky.nt + (i >> 2)]) return
    const fx = x - i
    const fy = y - j
    const d = sky.faces[fi]
    const k = 4 * (j * F + i)
    const k2 = k + 4 * F
    const t = T * sky.dim
    const w00 = (1 - fx) * (1 - fy) * t
    const w10 = fx * (1 - fy) * t
    const w01 = (1 - fx) * fy * t
    const w11 = fx * fy * t
    R += d[k] * w00 + d[k + 4] * w10 + d[k2] * w01 + d[k2 + 4] * w11
    Gc += d[k + 1] * w00 + d[k + 5] * w10 + d[k2 + 1] * w01 + d[k2 + 5] * w11
    B += d[k + 2] * w00 + d[k + 6] * w10 + d[k2 + 2] * w01 + d[k2 + 6] * w11
  }

  // The gathered colour as a pixel, RGBA little end first, rounded.
  function pack () {
    return 0xff000000 | (B >= 254.5 ? 255 : B + 0.5) << 16 | (Gc >= 254.5 ? 255 : Gc + 0.5) << 8 | (R >= 254.5 ? 255 : R + 0.5)
  }

  const SEG = new Float64Array(STRIDE * MAXSEG)
  const EV = []

  // One ray from the camera along unit (dx, dy, dz), of the frame's
  // point (x, y): the planes it crosses, in the order it crosses them,
  // then, unless it is captured, the sky along its last direction.
  function ray (sc, dx, dy, dz, x, y) {
    R = Gc = B = 0
    T = 1
    let n = trace(0, 0, 0, dx, dy, dz, sc.hs, sc.nh, SEG)
    const cap = n < 0
    if (cap) n = -n
    const ps = sc.planes
    const np = ps.length
    const { cx, cy, f } = sc
    for (let s = 0; s < n && T > 0.004; s++) {
      const k = STRIDE * s
      const ox = SEG[k]
      const oy = SEG[k + 1]
      const oz = SEG[k + 2]
      const ex = SEG[k + 3]
      const ey = SEG[k + 4]
      const ez = SEG[k + 5]
      const l = SEG[k + 6]
      if (ez === 0) continue
      const z1 = l === Infinity ? (ez > 0 ? Infinity : -Infinity) : oz + l * ez
      if (ez > 0) {
        for (let q = 0; q < np; q++) {
          const p = ps[q]
          if (p.z <= oz) continue
          if (p.z > z1) break
          cross(p, ox, oy, oz, ex, ey, ez, cx, cy, f, x, y)
        }
      } else {
        for (let q = np - 1; q >= 0; q--) {
          const p = ps[q]
          if (p.z >= oz) continue
          if (p.z < z1) break
          cross(p, ox, oy, oz, ex, ey, ez, cx, cy, f, x, y)
        }
      }
    }
    if (!cap && T > 0.004 && sc.sky) {
      const k = STRIDE * (n - 1)
      skyPlace(sc.sky, SEG[k + 3], SEG[k + 4], SEG[k + 5])
      skyAdd(sc.sky, FI, FX, FY)
    }
    return cap
  }

  function cross (p, ox, oy, oz, ex, ey, ez, cx, cy, f, x, y) {
    const t = (p.z - oz) / ez
    const sx = p.screen ? x : cx + f * (ox + t * ex) / p.z
    const sy = p.screen ? y : cy - f * (oy + t * ey) / p.z
    if (p.edge) return sample(p, sx, sy)
    const tx = Math.floor((sx - p.ox) / TILE)
    const ty = Math.floor((sy - p.oy) / TILE)
    if (tx < 0 || ty < 0 || tx >= p.tw || ty >= p.th) {
      if (sx > p.ox - 1 && sy > p.oy - 1 && sx < p.ox + p.w + 1 && sy < p.oy + p.h + 1) sample(p, sx, sy)
      return
    }
    if (p.dil[ty * p.tw + tx]) sample(p, sx, sy)
  }

  // The frame's lens map, traced at nodes S pixels apart: per node its
  // signature (the holes met in order, whether it is captured and how
  // many planes it crosses, or a reason to trace each pixel of the cells
  // about it), where it crosses each plane and where its last direction
  // falls on the sky's cube.
  const M = { nn: 0, np: 0, sig: null, px: null, py: null, fi: null, fx: null, fy: null, fd: null, sc: null }

  // Render scene sc into out, RGBA w by h: sc = { w, h, cx, cy, f, S,
  // hs, nh, bref, planes, sky }, the camera at the origin looking along
  // +z, y up, the pixel (x, y) at (cx + f X / Z, cy - f Y / Z), planes
  // in increasing z. A cell of S by S pixels whose four corner rays have
  // one signature, met each hole no nearer than its bref but to be
  // captured, and none turned back, takes its rays' crossings and their
  // places on the sky bilinear from its corners. That map is smooth
  // there. Every other pixel is traced. Returns the count of pixels
  // traced.
  function render (sc, out) {
    const { w, h, S, cx, cy, f, planes, sky } = sc
    const np = planes.length
    const gw = Math.ceil(w / S)
    const gh = Math.ceil(h / S)
    const nn = (gw + 1) * (gh + 1)
    if (M.nn < nn || M.np < np) {
      M.nn = Math.max(nn, M.nn)
      M.np = Math.max(np, M.np)
      M.sig = new Float64Array(M.nn)
      M.px = new Float32Array(M.nn * M.np)
      M.py = new Float32Array(M.nn * M.np)
      M.fi = new Int8Array(M.nn)
      M.fx = new Float32Array(M.nn)
      M.fy = new Float32Array(M.nn)
      M.fd = new Float32Array(3 * M.nn)
      M.sc = new Float32Array(3 * M.nn)
    }
    const { sig, px, py, fi, fd } = M
    const mfx = M.fx
    const mfy = M.fy
    const NN = M.nn
    for (let j = 0; j <= gh; j++) {
      for (let i = 0; i <= gw; i++) {
        const node = j * (gw + 1) + i
        let dx = (i * S + 0.5 - cx) / f
        let dy = -(j * S + 0.5 - cy) / f
        const l = Math.sqrt(dx * dx + dy * dy + 1)
        dx /= l
        dy /= l
        const dz = 1 / l
        let n = trace(0, 0, 0, dx, dy, dz, sc.hs, sc.nh, SEG, EV)
        const cap = n < 0
        if (cap) n = -n
        let code = 1
        for (let e = 0; e < EV.length && code > 0; e += 3) {
          if (EV[e + 2] === Infinity) code = code * 16
          else if (EV[e + 1] < sc.bref[EV[e]]) code = -3
          else code = code * 16 + EV[e] + 1
        }
        for (let s = 0; s < n && code > 0; s++) if (SEG[STRIDE * s + 5] <= 0) code = -2
        if (code < 0) {
          sig[node] = code
          continue
        }
        // Where the ray crosses each plane, along its pieces in order of
        // depth, until it ends.
        let s = 0
        let crossed = 0
        const k1 = STRIDE * (n - 1)
        const end = SEG[k1 + 6] === Infinity ? Infinity : SEG[k1 + 2] + SEG[k1 + 6] * SEG[k1 + 5]
        for (let q = 0; q < np; q++) {
          const z = planes[q].z
          if (z > end) {
            px[q * NN + node] = NaN
            continue
          }
          while (s < n - 1 && SEG[STRIDE * s + 2] + SEG[STRIDE * s + 6] * SEG[STRIDE * s + 5] < z) s++
          const k = STRIDE * s
          const t = (z - SEG[k + 2]) / SEG[k + 5]
          px[q * NN + node] = planes[q].screen ? i * S + 0.5 : cx + f * (SEG[k] + t * SEG[k + 3]) / z
          py[q * NN + node] = planes[q].screen ? j * S + 0.5 : cy - f * (SEG[k + 1] + t * SEG[k + 4]) / z
          crossed++
          if (planes[q].smooth) {
            R = Gc = B = 0
            T = 1
            sample(planes[q], px[q * NN + node], py[q * NN + node])
            M.sc[3 * node] = R
            M.sc[3 * node + 1] = Gc
            M.sc[3 * node + 2] = B
          }
        }
        sig[node] = code * 64 + crossed + (cap ? 0.5 : 0)
        if (cap || !sky) continue
        fd[3 * node] = SEG[k1 + 3]
        fd[3 * node + 1] = SEG[k1 + 4]
        fd[3 * node + 2] = SEG[k1 + 5]
        skyPlace(sky, SEG[k1 + 3], SEG[k1 + 4], SEG[k1 + 5])
        fi[node] = FI
        mfx[node] = FX
        mfy[node] = FY
      }
    }
    let traced = 0
    const act = new Int32Array(np)
    const co = new Float64Array(8 * np)
    const rw = new Float64Array(4 * np)
    const gc = new Float64Array(12)
    const o32 = new Uint32Array(out.buffer, out.byteOffset, w * h)
    const iS = 1 / S
    for (let cj = 0; cj < gh; cj++) {
      for (let ci = 0; ci < gw; ci++) {
        const n00 = cj * (gw + 1) + ci
        const n10 = n00 + 1
        const n01 = n00 + gw + 1
        const n11 = n01 + 1
        const x0 = ci * S
        const y0 = cj * S
        const x1 = Math.min(w, x0 + S)
        const y1 = Math.min(h, y0 + S)
        const c = sig[n00]
        if (c < 0 || sig[n10] !== c || sig[n01] !== c || sig[n11] !== c) {
          for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
              let dx = (x + 0.5 - cx) / f
              let dy = -(y + 0.5 - cy) / f
              const l = Math.sqrt(dx * dx + dy * dy + 1)
              dx /= l
              dy /= l
              ray(sc, dx, dy, 1 / l, x + 0.5, y + 0.5)
              o32[y * w + x] = pack()
            }
          }
          traced += (x1 - x0) * (y1 - y0)
          continue
        }
        const cap = c % 1 !== 0
        // The planes the cell's rays cross and may meet anything on, and
        // the smooth plane, if any, after gp of them, bilinear in colour.
        let na = 0
        let gp = -1
        for (let q = 0; q < np; q++) {
          const o = q * NN
          const ax = px[o + n00]
          if (ax !== ax) continue
          const p = planes[q]
          if (p.smooth) {
            gp = na
            for (let ch = 0; ch < 3; ch++) {
              const A = M.sc[3 * n00 + ch]
              const Bq = M.sc[3 * n10 + ch]
              const Cq = M.sc[3 * n01 + ch]
              gc[4 * ch] = A
              gc[4 * ch + 1] = Bq - A
              gc[4 * ch + 2] = Cq - A
              gc[4 * ch + 3] = A - Bq - Cq + M.sc[3 * n11 + ch]
            }
            continue
          }
          const bx = px[o + n10]
          const cxq = px[o + n01]
          const dxq = px[o + n11]
          const ay = py[o + n00]
          const by = py[o + n10]
          const cyq = py[o + n01]
          const dyq = py[o + n11]
          if (!p.edge && !held(p, Math.min(ax, bx, cxq, dxq), Math.min(ay, by, cyq, dyq), Math.max(ax, bx, cxq, dxq), Math.max(ay, by, cyq, dyq))) continue
          const m = 8 * na
          co[m] = ax
          co[m + 1] = bx - ax
          co[m + 2] = cxq - ax
          co[m + 3] = ax - bx - cxq + dxq
          co[m + 4] = ay
          co[m + 5] = by - ay
          co[m + 6] = cyq - ay
          co[m + 7] = ay - by - cyq + dyq
          act[na++] = q
        }
        // The sky: on one face, its place bilinear, else its direction.
        const one = !cap && sky && fi[n00] === fi[n10] && fi[n00] === fi[n01] && fi[n00] === fi[n11]
        const face = fi[n00]
        // That face's lit tiles, read first: most of the sky is black.
        const tiles = one ? sky.lit[face] : null
        const nt = sky ? sky.nt : 0
        const Fm = sky ? sky.F - 1.001 : 0
        const lit = !cap && sky
        for (let y = y0; y < y1; y++) {
          const v = (y - y0) * iS
          // Along the row each value is base + slope u.
          for (let a = 0; a < na; a++) {
            const m = 8 * a
            rw[4 * a] = co[m] + co[m + 2] * v
            rw[4 * a + 1] = (co[m + 1] + co[m + 3] * v) * iS
            rw[4 * a + 2] = co[m + 4] + co[m + 6] * v
            rw[4 * a + 3] = (co[m + 5] + co[m + 7] * v) * iS
          }
          let g0 = 0
          let g1 = 0
          let g2 = 0
          let s0 = 0
          let s1 = 0
          let s2 = 0
          if (gp >= 0) {
            g0 = gc[0] + gc[2] * v
            s0 = (gc[1] + gc[3] * v) * iS
            g1 = gc[4] + gc[6] * v
            s1 = (gc[5] + gc[7] * v) * iS
            g2 = gc[8] + gc[10] * v
            s2 = (gc[9] + gc[11] * v) * iS
          }
          let ex, ey, ez, sx, sy, sz
          if (one) {
            ex = mfx[n00] + (mfx[n01] - mfx[n00]) * v
            ey = mfy[n00] + (mfy[n01] - mfy[n00]) * v
            sx = (mfx[n10] + (mfx[n11] - mfx[n10]) * v - ex) * iS
            sy = (mfy[n10] + (mfy[n11] - mfy[n10]) * v - ey) * iS
            ez = sz = 0
          } else {
            const a0 = 3 * n00
            const b0 = 3 * n10
            const c0 = 3 * n01
            const d0 = 3 * n11
            ex = fd[a0] + (fd[c0] - fd[a0]) * v
            ey = fd[a0 + 1] + (fd[c0 + 1] - fd[a0 + 1]) * v
            ez = fd[a0 + 2] + (fd[c0 + 2] - fd[a0 + 2]) * v
            sx = (fd[b0] + (fd[d0] - fd[b0]) * v - ex) * iS
            sy = (fd[b0 + 1] + (fd[d0 + 1] - fd[b0 + 1]) * v - ey) * iS
            sz = (fd[b0 + 2] + (fd[d0 + 2] - fd[b0 + 2]) * v - ez) * iS
          }
          let k = y * w + x0
          if (!na) {
            // Nothing drawn here: the ground and the sky.
            for (let x = x0; x < x1; x++, k++) {
              const du = x - x0
              R = g0 + s0 * du
              Gc = g1 + s1 * du
              B = g2 + s2 * du
              T = 1
              if (lit) {
                if (one) {
                  const qx = ex + sx * du
                  const qy = ey + sy * du
                  if (tiles[((qy <= 0 ? 0 : qy >= Fm ? Fm : qy) >> 2) * nt + ((qx <= 0 ? 0 : qx >= Fm ? Fm : qx) >> 2)]) skyAdd(sky, face, qx, qy)
                }
                else {
                  skyPlace(sky, ex + sx * du, ey + sy * du, ez + sz * du)
                  skyAdd(sky, FI, FX, FY)
                }
              }
              o32[k] = pack()
            }
            continue
          }
          for (let x = x0; x < x1; x++, k++) {
            const du = x - x0
            R = Gc = B = 0
            T = 1
            for (let a = 0; a < na && T > 0.004; a++) {
              if (a === gp) {
                R += T * (g0 + s0 * du)
                Gc += T * (g1 + s1 * du)
                B += T * (g2 + s2 * du)
              }
              sample(planes[act[a]], rw[4 * a] + rw[4 * a + 1] * du, rw[4 * a + 2] + rw[4 * a + 3] * du)
            }
            if (gp >= na && T > 0.004) {
              R += T * (g0 + s0 * du)
              Gc += T * (g1 + s1 * du)
              B += T * (g2 + s2 * du)
            }
            if (lit && T > 0.004) {
              if (one) {
                const qx = ex + sx * du
                const qy = ey + sy * du
                if (tiles[((qy <= 0 ? 0 : qy >= Fm ? Fm : qy) >> 2) * nt + ((qx <= 0 ? 0 : qx >= Fm ? Fm : qx) >> 2)]) skyAdd(sky, face, qx, qy)
              }
              else {
                skyPlace(sky, ex + sx * du, ey + sy * du, ez + sz * du)
                skyAdd(sky, FI, FX, FY)
              }
            }
            o32[k] = pack()
          }
        }
      }
    }
    return traced
  }

  // The forward map, for what is drawn where it is seen: the frame's
  // point (sx, sy) of scene sc ({ cx, cy, f, hs, nh }, as render takes
  // it) to where its ray crosses depth z, as the place on the frame of
  // that crossing seen along a straight line, into XY. False if
  // the ray is captured or turned back before it reaches z. Unbent, it
  // is the identity.
  const XY = new Float64Array(2)
  const SEEN = new Float64Array(STRIDE * MAXSEG)
  function seen (sc, sx, sy, z) {
    let dx = (sx - sc.cx) / sc.f
    let dy = -(sy - sc.cy) / sc.f
    const l = Math.sqrt(dx * dx + dy * dy + 1)
    const n = Math.abs(trace(0, 0, 0, dx / l, dy / l, 1 / l, sc.hs, sc.nh, SEEN))
    for (let s = 0; s < n; s++) {
      const k = STRIDE * s
      const ez = SEEN[k + 5]
      if (ez === 0) continue
      const t = (z - SEEN[k + 2]) / ez
      if (t <= 0 || t > SEEN[k + 6]) continue
      XY[0] = sc.cx + sc.f * (SEEN[k] + t * SEEN[k + 3]) / z
      XY[1] = sc.cy - sc.f * (SEEN[k + 1] + t * SEEN[k + 4]) / z
      return true
    }
    return false
  }

  // The image of a point at depth z that a straight ray would show at
  // (qx, qy): the frame's point whose ray crosses it, within IMG_TOL
  // pixels, found by Newton's method on seen from (sx, sy), each step at
  // most step pixels and halved until it brings the crossing nearer.
  // Into IM: the image, and J, the change of the crossing's place with
  // the image's, [x, y, J00, J01, J10, J11], J as found before the last
  // step, which is short. False if none is found from there.
  const IMG_TOL = 0.05
  const IMG_H = 1e-3
  const IM = new Float64Array(6)
  function image (sc, qx, qy, z, sx, sy, step = 4) {
    if (!seen(sc, sx, sy, z)) return false
    let rx = XY[0] - qx
    let ry = XY[1] - qy
    let r = Math.hypot(rx, ry)
    let a = 0
    let b = 0
    let c = 0
    let d = 0
    for (let it = 0; it < 24; it++) {
      if (it === 0 || r >= IMG_TOL) {
        // J by differences, one way or the other where a side is lost.
        let h = IMG_H
        if (!seen(sc, sx + h, sy, z)) {
          h = -h
          if (!seen(sc, sx + h, sy, z)) return false
        }
        a = (XY[0] - qx - rx) / h
        c = (XY[1] - qy - ry) / h
        h = IMG_H
        if (!seen(sc, sx, sy + h, z)) {
          h = -h
          if (!seen(sc, sx, sy + h, z)) return false
        }
        b = (XY[0] - qx - rx) / h
        d = (XY[1] - qy - ry) / h
      }
      if (r < IMG_TOL) {
        IM[0] = sx
        IM[1] = sy
        IM[2] = a
        IM[3] = b
        IM[4] = c
        IM[5] = d
        return true
      }
      const det = a * d - b * c
      if (!det) return false
      let ux = -(d * rx - b * ry) / det
      let uy = -(a * ry - c * rx) / det
      const ul = Math.hypot(ux, uy)
      if (ul > step) {
        ux *= step / ul
        uy *= step / ul
      }
      let ok = false
      for (let k = 0; k < 12; k++) {
        if (seen(sc, sx + ux, sy + uy, z)) {
          const nx = XY[0] - qx
          const ny = XY[1] - qy
          const nr = Math.hypot(nx, ny)
          if (nr < r) {
            sx += ux
            sy += uy
            rx = nx
            ry = ny
            r = nr
            ok = true
            break
          }
        }
        ux /= 2
        uy /= 2
      }
      if (!ok) return false
    }
    return false
  }

  // The images of a curve through the holes of scene sc: its n places,
  // [X, Y, Z] each in the camera's frame in pl, joined by straight
  // pieces. Each branch is an image followed along the curve, a list of
  // { u, x, y, a, b, c, d, qx, qy }: u the place, between places where a
  // piece is halved, (x, y) its image, a to d its J (image) and (qx, qy)
  // where a straight ray would show it. A branch takes the image of the
  // place before it, carried by its J, as the guess, and halves a piece,
  // at most DEPTH times, until the guess and the image lie within JUMP
  // pixels of the last, so it follows an image round a hole. It ends where the image is lost, in
  // the shadow or behind the camera, or squeezed thinner than FAINT of
  // the curve, |J| above 1 / FAINT, where a trace would not show it. One
  // starts at a place with fewer branches than images to look for: the
  // unbent place, and about each hole in front of it the weak field's
  // outer image and the inner one, looked for while the weak field puts
  // it at FAINT or more.
  const JUMP = 3
  const DEPTH = 6
  const FAINT = 0.05
  const CP = new Float64Array(3)
  function curve (sc, pl, n) {
    const where = u => {
      const i = Math.min(n - 2, Math.floor(u))
      const f = u - i
      for (let a = 0; a < 3; a++) CP[a] = pl[3 * i + a] + (pl[3 * i + 3 + a] - pl[3 * i + a]) * f
      return CP[2] >= 1
    }
    // |J|, its greater singular value.
    const big = m => {
      const s = m.a * m.a + m.b * m.b + m.c * m.c + m.d * m.d
      const det = m.a * m.d - m.b * m.c
      return Math.sqrt((s + Math.sqrt(Math.max(0, s * s - 4 * det * det))) / 2)
    }
    const solve = (u, sx, sy) => {
      if (!where(u)) return null
      const qx = sc.cx + sc.f * CP[0] / CP[2]
      const qy = sc.cy - sc.f * CP[1] / CP[2]
      if (!image(sc, qx, qy, CP[2], sx, sy)) return null
      const m = { u, x: IM[0], y: IM[1], a: IM[2], b: IM[3], c: IM[4], d: IM[5], qx, qy }
      return big(m) * FAINT > 1 ? null : m
    }
    const extend = (br, u1, depth) => {
      const s0 = br[br.length - 1]
      if (!where(u1)) return false
      const dx = sc.cx + sc.f * CP[0] / CP[2] - s0.qx
      const dy = sc.cy - sc.f * CP[1] / CP[2] - s0.qy
      const det = s0.a * s0.d - s0.b * s0.c
      const gx = s0.x + (det ? (s0.d * dx - s0.b * dy) / det : dx)
      const gy = s0.y + (det ? (s0.a * dy - s0.c * dx) / det : dy)
      // A guess farther than JUMP is halved before it is solved.
      const s1 = depth > 0 && Math.hypot(gx - s0.x, gy - s0.y) > JUMP ? null : solve(u1, gx, gy)
      if (s1 && Math.hypot(s1.x - s0.x, s1.y - s0.y) <= JUMP) {
        br.push(s1)
        return true
      }
      if (depth <= 0) return false
      const um = (s0.u + u1) / 2
      return extend(br, um, depth - 1) && extend(br, u1, depth - 1)
    }
    // The weak field's inner image is FAINT of the curve where its
    // radial magnification x^2 / (x^2 + 1) is, x its distance from the
    // hole over the Einstein radius.
    const xin = Math.sqrt(FAINT / (1 - FAINT))
    const live = []
    const done = []
    const guess = []
    for (let i = 0; i < n; i++) {
      for (let k = live.length - 1; k >= 0; k--) {
        if (extend(live[k], i, DEPTH)) continue
        done.push(live[k])
        live.splice(k, 1)
      }
      if (!where(i)) continue
      const Z = CP[2]
      const qx = sc.cx + sc.f * CP[0] / Z
      const qy = sc.cy - sc.f * CP[1] / Z
      guess.length = 0
      for (let h = 0; h < sc.nh; h++) {
        const Zh = sc.hs[4 * h + 2]
        if (Zh <= 0 || Zh >= Z) continue
        const hx = sc.cx + sc.f * sc.hs[4 * h] / Zh
        const hy = sc.cy - sc.f * sc.hs[4 * h + 1] / Zh
        const te = sc.f * Math.sqrt(2 * sc.hs[4 * h + 3] / RING * (Z - Zh) / (Zh * Z))
        const R = sc.f * sc.hs[4 * h + 3] / Zh
        let ex = qx - hx
        let ey = qy - hy
        const beta = Math.hypot(ex, ey)
        if (beta > 1e-9) {
          ex /= beta
          ey /= beta
        } else {
          ex = 1
          ey = 0
        }
        const root = Math.sqrt(beta * beta + 4 * te * te)
        guess.push(hx + ex * (beta + root) / 2, hy + ey * (beta + root) / 2)
        if ((root - beta) / 2 < xin * te) continue
        // The inner image, near the shadow, where the weak field is far
        // out: on the line through the hole, where this hole alone bends
        // a ray of the far side onto the place, by halving.
        let lo = R
        let hi = 2 * te
        for (let it = 0; it < 16; it++) {
          const r = (lo + hi) / 2
          if (!seen(sc, hx - ex * r, hy - ey * r, Z) || (XY[0] - hx) * ex + (XY[1] - hy) * ey > beta) lo = r
          else hi = r
        }
        guess.push(hx - ex * hi, hy - ey * hi)
      }
      if (!guess.length) guess.push(qx, qy)
      if (live.length >= guess.length / 2) continue
      const near = (x, y, d) => live.some(br => br[br.length - 1].u === i && Math.hypot(br[br.length - 1].x - x, br[br.length - 1].y - y) < d)
      for (let g = 0; g < guess.length; g += 2) {
        if (near(guess[g], guess[g + 1], 3)) continue
        const s1 = solve(i, guess[g], guess[g + 1])
        if (s1 && !near(s1.x, s1.y, 0.5)) live.push([s1])
      }
    }
    return done.concat(live).filter(br => br.length > 1)
  }

  const api = { RING, BBAR, deflection, trace, STRIDE, MAXSEG, plane, render, skyTiles, seen, XY, image, IM, curve }
  if (typeof module === 'object' && module.exports) module.exports = api
  else root.VizTrace = api
})(this)
