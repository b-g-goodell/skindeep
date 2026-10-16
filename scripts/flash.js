'use strict'
// A flash counter after WCAG 2.2, success criterion 2.3.1, and its
// definition of the general flash and red flash thresholds (issue #164,
// decision 0015). Fed frames of RGBA pixels with their times, it counts
// flashes per second in every field of the frame and in every cell.
//
// A cell: a square of CELL pixels a side, 0.1 degree of the visual field
// at WCAG's 1024 by 768 (341 pixels to 10 degrees), the finest pattern
// the definition's exception lets flash. Its colour is the mean of its
// pixels' linear R, G and B, so a pattern finer than a cell, a stipple
// or a line a pixel wide, counts by its share of the cell.
//
// A cell's transitions: its relative luminance as a zigzag of threshold
// 0.1, so a transition is a change of 0.1 or more between a peak and
// the valley after it (Note 2), the darker of the two below 0.80. A
// slow fade counts once it has fallen far enough. A pair of opposing
// transitions is a general flash, completed by the second. A red flash
// likewise (Note 3): a change of more than 0.2 in CIE 1976 u'v' between
// two states, one of R / (R + G + B) >= 0.8, black taken at D65's white
// point.
//
// A field: 341 by 256 pixels, Note 1's estimate of a 10 degree visual
// field, clipped to the frame, placed every STEP pixels and at the far
// edges. A field flashes when the cells that complete a flash in it
// concurrently cover 0.006 steradian, a quarter of the field, 21 824
// pixels. The definition counts "the combined area of flashes occurring
// concurrently" and fixes no window, so concurrency is read twice: within
// one frame, the literal reading, and within a block of frames WINDOW
// seconds long, about the eye's integration time (Bloch's law), within
// which flashes read as one. A field counts at most one flash a block,
// so the second reading saturates at 10 a second. A field's count is
// the most of its flashes in any one second, as is a cell's, and the
// bound is 3.
;(function (root) {
  const FIELD_W = 341
  const FIELD_H = 256
  const AREA = 0.25 * FIELD_W * FIELD_H
  const STEP = 32
  const CELL = 4
  // The concurrency window, seconds, and a cell's last flashes kept, for
  // its count in any one second: a count of KEEP reads KEEP or more.
  const WINDOW = 0.1
  const KEEP = 32

  const LIN = new Float32Array(256)
  for (let i = 0; i < 256; i++) {
    const c = i / 255
    LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }

  // One zigzag per cell over values v: dir 0 before the first
  // transition, with lo and hi seen so far, then +1 or -1 and the
  // running extreme in that direction. feed returns 1 where a flash
  // completes: at every second transition.
  function Zigzag (n, thr, dark) {
    const z = { dir: new Int8Array(n), ext: new Float32Array(n), lo: new Float32Array(n), hi: new Float32Array(n), n: new Uint32Array(n), fresh: true }
    z.feed = (i, v) => {
      if (z.fresh) {
        z.lo[i] = z.hi[i] = z.ext[i] = v
        return 0
      }
      const d = z.dir[i]
      let up = false
      let down = false
      if (d === 0) {
        if (v - z.lo[i] >= thr && z.lo[i] < dark) up = true
        else if (z.hi[i] - v >= thr && v < dark) down = true
        else {
          if (v < z.lo[i]) z.lo[i] = v
          if (v > z.hi[i]) z.hi[i] = v
          return 0
        }
      } else if (d > 0) {
        if (v > z.ext[i]) z.ext[i] = v
        else if (z.ext[i] - v >= thr && v < dark) down = true
      } else {
        if (v < z.ext[i]) z.ext[i] = v
        else if (v - z.ext[i] >= thr && z.ext[i] < dark) up = true
      }
      if (!up && !down) return 0
      z.dir[i] = up ? 1 : -1
      z.ext[i] = v
      z.n[i]++
      return z.n[i] % 2 === 0 ? 1 : 0
    }
    return z
  }

  // A cell's red state, its chromaticity anchored at its last
  // transition: feed returns 1 where a red flash completes.
  function Red (n) {
    const u = new Float32Array(n)
    const v = new Float32Array(n)
    const sat = new Uint8Array(n)
    const k = new Uint32Array(n)
    let fresh = true
    return {
      end () { fresh = false },
      feed (i, r, g, b) {
        const X = 0.4124 * r + 0.3576 * g + 0.1805 * b
        const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b
        const Z = 0.0193 * r + 0.1192 * g + 0.9505 * b
        const den = X + 15 * Y + 3 * Z
        const s = r + g + b > 0 && r / (r + g + b) >= 0.8 ? 1 : 0
        const uu = den > 0 ? 4 * X / den : 0.1978
        const vv = den > 0 ? 9 * Y / den : 0.4683
        if (fresh) {
          u[i] = uu
          v[i] = vv
          sat[i] = s
          return 0
        }
        if (!(s || sat[i]) || Math.hypot(uu - u[i], vv - v[i]) <= 0.2) return 0
        u[i] = uu
        v[i] = vv
        sat[i] = s
        k[i]++
        return k[i] % 2 === 0 ? 1 : 0
      }
    }
  }

  // Integral image of a map of w by h, (w + 1) by (h + 1).
  function integral (m, w, h, s) {
    for (let x = 0; x <= w; x++) s[x] = 0
    for (let y = 0; y < h; y++) {
      let row = 0
      const o = (y + 1) * (w + 1)
      const p = y * (w + 1)
      s[o] = 0
      for (let x = 0; x < w; x++) {
        row += m[y * w + x]
        s[o + x + 1] = s[p + x + 1] + row
      }
    }
  }

  const starts = (n, f) => {
    const out = []
    for (let a = 0; a + f < n; a += STEP / CELL) out.push(a)
    out.push(Math.max(0, n - f))
    return [...new Set(out)]
  }

  // A counter for frames of w by h pixels, fps frames a second. It
  // counts each field twice: concurrent within one frame, and within a
  // block of frames window seconds long. push(data, t): one frame's
  // RGBA bytes at time t, seconds. report(): for each reading, frame and
  // window, general and red, the most flashes in any one second of any
  // field, with the field and when, and share, the largest share of AREA
  // one block's general flashes covered in a field. cell: the most
  // flashes in any one second of any one cell, with where, and the cells
  // over 3. heat(s): each cell's flashes a second over s seconds.
  function Counter (w, h, fps, window = WINDOW) {
    const modes = [['frame', 1], ['window', Math.max(1, Math.round(window * fps))]]
    const cw = Math.floor(w / CELL)
    const ch = Math.floor(h / CELL)
    const n = cw * ch
    const lum = Zigzag(n, 0.1, 0.8)
    const red = Red(n)
    const mapL = new Uint8Array(n)
    const mapR = new Uint8Array(n)
    const sum = new Int32Array((cw + 1) * (ch + 1))
    const times = new Float64Array(n * KEEP)
    const head = new Uint8Array(n)
    const filled = new Uint8Array(n)
    const top = new Uint8Array(n)
    // Each cell's flashes in all, for a picture of where.
    const all = new Uint32Array(n)
    const fw = Math.min(Math.round(FIELD_W / CELL), cw)
    const fh = Math.min(Math.round(FIELD_H / CELL), ch)
    const area = AREA / (CELL * CELL)
    const fields = []
    const fresh = () => Object.fromEntries(modes.map(([m]) => [m, { L: [], R: [], acc: { L: 0, R: 0 } }]))
    for (const y of starts(ch, fh)) for (const x of starts(cw, fw)) fields.push(Object.assign({ x, y }, fresh()))
    const best = { frames: 0, cell: { n: 0, x: null, y: null, t: null } }
    for (const [m] of modes) best[m] = { L: { n: 0, field: null, t: null }, R: { n: 0, field: null, t: null }, share: 0 }
    const box = f => ({ x: f.x * CELL, y: f.y * CELL, w: fw * CELL, h: fh * CELL })
    const count = (f, m, key, t) => {
      const list = f[m][key]
      list.push(t)
      while (list.length && t - list[0] >= 1 - 1e-9) list.shift()
      if (list.length > best[m][key].n) best[m][key] = { n: list.length, field: box(f), t }
    }
    const scan = (map, key, t) => {
      integral(map, cw, ch, sum)
      for (const f of fields) {
        const a = sum[(f.y + fh) * (cw + 1) + f.x + fw] - sum[f.y * (cw + 1) + f.x + fw] - sum[(f.y + fh) * (cw + 1) + f.x] + sum[f.y * (cw + 1) + f.x]
        for (const [m] of modes) f[m].acc[key] += a
      }
    }
    // Each field's flashes over the block of reading m just ended.
    const close = (m, t) => {
      for (const f of fields) {
        const acc = f[m].acc
        if (acc.L / area > best[m].share) best[m].share = acc.L / area
        for (const key of ['L', 'R']) {
          if (acc[key] >= area) count(f, m, key, t)
          acc[key] = 0
        }
      }
    }
    // Cell i flashed at t: its count over the last second.
    const flashed = (i, t) => {
      all[i]++
      const o = i * KEEP
      times[o + head[i]] = t
      head[i] = (head[i] + 1) % KEEP
      if (filled[i] < KEEP) filled[i]++
      let c = 0
      for (let j = 0; j < filled[i]; j++) if (t - times[o + j] < 1 - 1e-9) c++
      if (c > top[i]) top[i] = c
      if (c > best.cell.n) best.cell = { n: c, x: (i % cw) * CELL, y: Math.floor(i / cw) * CELL, t }
    }
    return {
      push (d, t) {
        let anyL = 0
        let anyR = 0
        const k = 1 / (CELL * CELL)
        for (let cy = 0; cy < ch; cy++) {
          for (let cx = 0; cx < cw; cx++) {
            let r = 0
            let g = 0
            let b = 0
            for (let y = cy * CELL; y < cy * CELL + CELL; y++) {
              for (let j = 4 * (y * w + cx * CELL), e = j + 4 * CELL; j < e; j += 4) {
                r += LIN[d[j]]
                g += LIN[d[j + 1]]
                b += LIN[d[j + 2]]
              }
            }
            r *= k
            g *= k
            b *= k
            const i = cy * cw + cx
            if ((mapL[i] = lum.feed(i, 0.2126 * r + 0.7152 * g + 0.0722 * b))) {
              anyL++
              flashed(i, t)
            }
            anyR += mapR[i] = red.feed(i, r, g, b)
          }
        }
        lum.fresh = false
        red.end()
        best.frames++
        if (anyL) scan(mapL, 'L', t)
        if (anyR) scan(mapR, 'R', t)
        for (const [m, k] of modes) if (best.frames % k === 0) close(m, t)
      },
      heat: s => ({ w: cw, h: ch, v: Array.from(all, x => x / s) }),
      report () {
        let over = 0
        for (let i = 0; i < n; i++) if (top[i] > 3) over++
        const read = m => ({ general: best[m].L, red: best[m].R, share: Math.round(best[m].share * 1000) / 1000 })
        return { frame: read('frame'), window: read('window'), cell: Object.assign({ over }, best.cell), frames: best.frames, fields: fields.length, area: AREA, field: [fw * CELL, fh * CELL] }
      }
    }
  }

  const api = { Counter, FIELD_W, FIELD_H, AREA, STEP, CELL, WINDOW, KEEP }
  if (typeof module === 'object' && module.exports) module.exports = api
  else root.Flash = api
})(this)
