'use strict'
// The Sunset clouds mode's subagent (decision 0015, issue #189): a
// cloudlet forms beside the newest cloud, at its depth, and on the
// pane, though draw sorts the clouds far to near every frame. The mode
// runs on stand-in canvases that record nothing, and the clock that
// budgets its marches jumps, so a draw marches a row at most. Seeded.
const test = require('node:test')
const assert = require('node:assert')
const { create } = require('../app/viz/sunset')

// mulberry32.
function rng (a) {
  return function () {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// A 2D context that accepts every call and draws nothing.
function context () {
  const data = (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(4 * w * h) })
  const known = {
    createImageData: data,
    getImageData: (x, y, w, h) => data(w, h),
    createRadialGradient: () => ({ addColorStop () {} }),
    createLinearGradient: () => ({ addColorStop () {} }),
    createPattern: () => ({})
  }
  return new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : known[k] || (() => {})),
    set: (t, k, v) => { t[k] = v; return true }
  })
}
const canvas = () => { const g = context(); return { width: 0, height: 0, getContext: () => g } }
// The mode makes its own canvases by the page's document.
global.document = { createElement: canvas }

// A session that brings the events given to the next draw.
function session () {
  return { queue: [], level: { bass: 0.5, busy: 0.5, idle: 0 }, since () { return this.queue.splice(0) } }
}

// One trial: a pane, a prompt's cloud or none, half a second, a
// subagent.
function trial (W, H, seed, prompt) {
  const random = Math.random
  const now = performance.now
  let t = 0
  Math.random = rng(seed)
  performance.now = () => (t += 1000)
  try {
    const c = canvas()
    c.width = W
    c.height = H
    const r = create(c)
    const s = session()
    const step = ev => { if (ev) s.queue.push(ev); r.draw(s, 1 / 60) }
    for (let i = 0; i < 30; i++) step()
    step(prompt ? { kind: 3, cls: 0 } : null)
    for (let i = 0; i < 30; i++) step()
    const before = r.list()
    const live = before.filter(x => !x.gone)
    const newest = live.reduce((a, x) => (x.born > a.born || (x.born === a.born && x.id > a.id) ? x : a))
    const nearest = live.reduce((a, x) => (x.Z < a.Z ? x : a))
    step({ kind: 5, cls: 0 })
    const ids = new Set(before.map(x => x.id))
    const formed = r.list().find(x => !ids.has(x.id))
    for (let i = 0; i < 30; i++) step()
    const later = formed && r.list().find(x => x.id === formed.id)
    return { newest, nearest, formed, later }
  } finally {
    Math.random = random
    performance.now = now
  }
}

for (const [W, H] of [[1200, 760], [400, 253]]) {
  test(`sunset: at ${W} by ${H} each subagent's cloudlet forms beside the newest cloud, on the pane`, () => {
    let apart = 0
    // Forty seeds, prompts in every other, and three without a prompt
    // whose newest cloud has its base above the pane's top edge.
    const seeds = []
    for (let k = 0; k < 40; k++) seeds.push([1000 + k, k % 2 === 0])
    for (const k of [5031, 5421, 5481]) seeds.push([k, false])
    for (const [seed, prompt] of seeds) {
      const { newest, nearest, formed, later } = trial(W, H, seed, prompt)
      assert.ok(formed, `seed ${seed}: no cloudlet after the frame it formed in`)
      assert.ok(later && !later.gone, `seed ${seed}: the cloudlet is gone half a second on`)
      assert.ok(Math.abs(formed.Z / newest.Z - 1) <= 0.051, `seed ${seed}: depth ${formed.Z.toFixed(0)} m, the newest cloud's ${newest.Z.toFixed(0)} m`)
      const b = formed.box
      // A pixel's grace: the frame it forms in drifts it on the wind.
      assert.ok(b[0] >= -1 && b[2] <= W + 1, `seed ${seed}: the cloudlet's box spans ${b[0].toFixed(0)} to ${b[2].toFixed(0)} across a pane ${W} wide`)
      assert.ok(b[1] < H && b[3] > 0 && Math.max(0, Math.min(b[3], H) - Math.max(b[1], 0)) >= 0.5 * (b[3] - b[1]), `seed ${seed}: the cloudlet's box spans ${b[1].toFixed(0)} to ${b[3].toFixed(0)} down a pane ${H} high`)
      if (Math.abs(nearest.Z / newest.Z - 1) > 0.11) apart++
    }
    // The test tells the newest cloud from the nearest in most trials.
    assert.ok(apart >= 20, `the newest and the nearest cloud lie apart in depth in only ${apart} of ${seeds.length} trials`)
  })
}
