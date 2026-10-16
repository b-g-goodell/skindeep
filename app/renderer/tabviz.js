'use strict'
// Each tab's visualization in the tab strip (decision 0015, 2026-10-15):
// a small trace of its session, drawn from the numbers and events its
// pane in the visualization window gets, which main sends each frame
// whether that window is open or not. Not the pane's mode, which is
// unreadable at this size: the levels of the pane's synthesiser, eased
// as it eases them, as a band that scrolls right to left, a column every
// COL_MS, each event a bright column in the scope's colour for its kind
// or tool class. While the agent works the band moves, even through a
// silent tool call, and a quiet column is grey. When it is done, its
// busy state 0 and the terminal quiet for DONE_S, the band fades and a
// flat green line runs through it, the dashboard's colour for waiting.
// Canvas2D on a small canvas, drawn at most every DRAW_MS, and not at
// all while the strip is hidden.

window.TabViz = (function () {
  // The canvas in CSS pixels, a column per pixel. A crowded strip narrows
  // it, to half at most, and the columns narrow with it.
  const W = 44
  const H = 16
  const COL_MS = 125
  const DRAW_MS = 33
  const DONE_S = 2
  // A column below this height is drawn grey.
  const QUIET = 0.15
  const CLASS_HUE = [200, 120, 40, 0, 280, 320]
  const KIND_HUE = { 1: 160, 3: 60, 4: 190, 5: 300, 6: 0 }
  const tabs = new Map()

  function make (id) {
    const canvas = document.createElement('canvas')
    canvas.className = 'viz'
    const s = {
      id,
      canvas,
      g: canvas.getContext('2d'),
      level: { bass: 0, treble: 0, busy: 0 },
      target: { bass: 0, treble: 0, busy: 0 },
      done: 0,
      doneTarget: 0,
      amp: new Float32Array(W),
      hue: new Float32Array(W),
      lit: new Float32Array(W),
      cur: { amp: 0, hue: 150, lit: 0 },
      acc: 0,
      flash: 0
    }
    tabs.set(id, s)
    return s
  }

  // The tab's canvas, the same element across the strip's redraws.
  function canvas (id) {
    return (tabs.get(id) || make(id)).canvas
  }

  // Only these tabs keep a canvas.
  function keep (ids) {
    for (const id of tabs.keys()) if (!ids.has(id)) tabs.delete(id)
  }

  // One frame of numbers per tab, { k, n, e }, n as the pane's: out_bps,
  // in_kps, idle_s, out_rate, busy, cpu, ctx. The targets as Synth.input
  // sets them.
  function feed (list) {
    for (const f of list) {
      const s = tabs.get(f.k)
      if (!s) continue
      const [outBps, inKps, idle, outRate, busy] = f.n
      s.target.bass = Math.min(1, outBps / 2500) + Math.min(0.3, inKps / 30)
      s.target.treble = Math.min(1, outRate / 120)
      s.target.busy = busy === 1 ? 1 : 0
      s.doneTarget = busy !== 1 && idle >= DONE_S ? 1 : 0
      for (let i = 0; i + 1 < f.e.length; i += 2) {
        const kind = f.e[i]
        s.cur.hue = kind === 2 ? CLASS_HUE[f.e[i + 1]] ?? 200 : KIND_HUE[kind] ?? 160
        s.cur.lit = 1
        s.flash = 1
      }
    }
  }

  // Advance by dt seconds: ease the levels, add to the open column, and
  // close a column every COL_MS.
  function step (s, dt) {
    const k = 1 - Math.exp(-dt * 6)
    for (const key of Object.keys(s.level)) s.level[key] += (s.target[key] - s.level[key]) * k
    s.done += (s.doneTarget - s.done) * (1 - Math.exp(-dt * 5))
    s.flash *= Math.exp(-dt * 6)
    const L = s.level
    const quiet = 1 - s.done
    const a = 0.08 + quiet * (0.7 * Math.min(1, L.bass) + 0.3 * L.treble * Math.random() + L.busy * (0.2 + 0.35 * Math.random()) + 0.6 * s.flash)
    s.cur.amp = Math.max(s.cur.amp, Math.min(1, a))
    if (!s.cur.lit) s.cur.hue = 150 - 110 * L.treble + 40 * L.busy
    s.acc += dt * 1000
    while (s.acc >= COL_MS) {
      s.acc -= COL_MS
      s.amp.copyWithin(0, 1)
      s.hue.copyWithin(0, 1)
      s.lit.copyWithin(0, 1)
      s.amp[W - 1] = s.cur.amp
      s.hue[W - 1] = s.cur.hue
      s.lit[W - 1] = s.cur.lit
      s.cur = { amp: 0, hue: s.cur.hue, lit: 0 }
    }
  }

  function draw (s) {
    const c = s.canvas
    const r = window.devicePixelRatio || 1
    if (c.width !== Math.round(W * r)) {
      c.width = Math.round(W * r)
      c.height = Math.round(H * r)
    }
    const g = s.g
    g.setTransform(r, 0, 0, r, 0, 0)
    g.clearRect(0, 0, W, H)
    const mid = H / 2
    const fade = 1 - 0.75 * s.done
    for (let x = 0; x < W; x++) {
      const last = x === W - 1
      const amp = last ? Math.max(s.amp[x], s.cur.amp) : s.amp[x]
      const lit = last ? Math.max(s.lit[x], s.cur.lit) : s.lit[x]
      const h = Math.max(0.5, amp * (mid - 1))
      // A quiet column is grey, so colour means activity and green alone
      // means done.
      const quiet = amp < QUIET && !lit
      g.fillStyle = `hsla(${last ? s.cur.hue : s.hue[x]}, ${quiet ? 0 : 90 - 70 * s.done}%, ${quiet ? 38 : 48 + 22 * lit}%, ${fade})`
      g.fillRect(x, mid - h, 1, 2 * h)
    }
    if (s.done > 0.02) {
      g.fillStyle = `rgba(143, 209, 143, ${s.done})`
      g.fillRect(0, mid - 1, W, 2)
    }
  }

  let prev = performance.now()
  let drawn = 0
  const strip = document.getElementById('tabs')
  function loop (now) {
    const dt = Math.min(0.1, (now - prev) / 1000)
    prev = now
    if (!strip.hidden) {
      for (const s of tabs.values()) step(s, dt)
      if (now - drawn >= DRAW_MS) {
        drawn = now
        for (const s of tabs.values()) if (s.canvas.isConnected) draw(s)
      }
    }
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
  window.skinned.onTabViz(feed)

  // For the live checks: each tab's state.
  function state () {
    return [...tabs.values()].map(s => ({ id: s.id, done: s.done, busy: s.level.busy, shown: s.canvas.isConnected }))
  }

  return { canvas, keep, state }
})()
