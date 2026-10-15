'use strict'
// The fuzz harness's generator and prediction model. Pure: no app,
// no files. From a seed, a sequence of user actions, and for each the
// state the app should show after it, as the README and the decisions
// describe the app, never as a run of it showed. A prediction holds
// claims a script checks and a sentence for the screenshot's reviewer.

const { MODES } = require('../../app/viz/modes')
const { SETTINGS } = require('../../app/settings')

const SKINS = ['deck', 'phosphor', 'coffee', 'library']
const FONT_SIZES = SETTINGS.find(s => s.id === 'terminal.fontSize').values
const SKIN_FONT = { deck: 14, phosphor: 19, coffee: 14, library: 14 }
const MIN_WIDTH = { deck: 1200, phosphor: 1180, coffee: 1100, library: 1100 }
const FLOOR = { deck: 600, phosphor: 654, coffee: 550, library: 550 }

// mulberry32: the same seed gives the same sequence on every machine.
function rng (seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// The launch: one tab, id 1, the given skin, the viz open (decisions 0015,
// 0023), sounds on, the skin's own font size.
function initial (skin = 'deck') {
  return { tabs: [1], active: 1, nextId: 2, closed: 0, skin, viz: true, modes: {}, muted: false, font: null, width: null }
}

const clone = s => JSON.parse(JSON.stringify(s))
const idx = s => s.tabs.indexOf(s.active)

// Each action: when it may be drawn, and what it does to the predicted
// state. A move of the pane's mode records 'step' when its mode before
// is not predicted: the claim is then that it changed.
const ACTIONS = {
  chordNew: { ok: s => s.tabs.length < 6, run: s => addTab(s) },
  menuNew: { ok: s => s.tabs.length < 6, run: s => addTab(s) },
  chordClose: { ok: s => s.tabs.length > 1, run: s => closeTab(s) },
  menuClose: { ok: s => s.tabs.length > 1, run: s => closeTab(s) },
  chordNext: { ok: () => true, run: s => step(s, 1) },
  chordPrev: { ok: () => true, run: s => step(s, -1) },
  menuNext: { ok: () => true, run: s => step(s, 1) },
  menuPrev: { ok: () => true, run: s => step(s, -1) },
  reopen: { ok: s => s.closed > 0 && s.tabs.length < 6, run: s => { s.closed--; addTab(s) } },
  duplicate: { ok: s => s.tabs.length < 6, run: s => addTab(s, idx(s) + 1) },
  drag: {
    ok: s => s.tabs.length > 2,
    arg: (s, r) => { const from = Math.floor(r() * s.tabs.length); let to = Math.floor(r() * (s.tabs.length - 1)); if (to >= from) to++; return { from, to } },
    run: (s, a) => {
      const id = s.tabs[a.from]
      s.tabs.splice(a.from, 1)
      s.tabs.splice(a.from < a.to ? a.to - 1 : a.to, 0, id)
      s.active = id
    }
  },
  skin: { ok: () => true, arg: (s, r) => ({ skin: SKINS[Math.floor(r() * SKINS.length)] }), run: (s, a) => { s.skin = a.skin } },
  vizToggle: { ok: () => true, run: s => { s.viz = !s.viz } },
  vizMode: { ok: () => true, arg: (s, r) => ({ mode: MODES[Math.floor(r() * MODES.length)].id }), run: (s, a) => { s.viz = true; s.modes[s.active] = a.mode } },
  vizClick: { ok: s => s.viz, run: s => stepMode(s) },
  vizSpace: { ok: s => s.viz, run: s => stepMode(s) },
  mute: { ok: () => true, run: s => { s.muted = !s.muted } },
  font: { ok: () => true, arg: (s, r) => ({ size: r() < 0.2 ? null : FONT_SIZES[Math.floor(r() * FONT_SIZES.length)] }), run: (s, a) => { s.font = a.size } },
  type: { ok: () => true, arg: (s, r) => ({ text: Array.from({ length: 3 + Math.floor(r() * 8) }, () => 'abcdefghij klmnop'[Math.floor(r() * 17)]).join('') }), run: () => {} },
  resize: { ok: () => true, arg: (s, r) => ({ width: 400 + Math.floor(r() * 1300) }), run: (s, a) => { s.width = a.width } },
  wait: { ok: () => true, arg: (s, r) => ({ ms: 500 + Math.floor(r() * 2500) }), run: () => {} }
}

function addTab (s, at = s.tabs.length) {
  const id = s.nextId++
  s.tabs.splice(at, 0, id)
  s.active = id
}

// A closed active tab passes to its right neighbour, else its left.
function closeTab (s) {
  const i = idx(s)
  s.tabs.splice(i, 1)
  delete s.modes[s.active]
  s.active = s.tabs[Math.min(i, s.tabs.length - 1)]
  s.closed++
}

function step (s, d) {
  const n = s.tabs.length
  s.active = s.tabs[(idx(s) + d + n) % n]
}

function stepMode (s) {
  const m = s.modes[s.active]
  if (m === undefined || m === 'step') return void (s.modes[s.active] = 'step')
  s.modes[s.active] = MODES[(MODES.findIndex(x => x.id === m) + 1) % MODES.length].id
}

// The claims a script checks against what the app shows after a step.
function claims (s) {
  const w = s.width === null ? null : Math.max(s.width, FLOOR[s.skin])
  const c = {
    tabs: s.tabs.slice(),
    active: s.active,
    windows: 1,
    skin: s.skin,
    viz: s.viz,
    panes: s.viz ? s.tabs.length : null,
    muted: s.muted,
    fontSize: s.font || SKIN_FONT[s.skin],
    width: w,
    scale: w === null ? null : Math.min(1, w / MIN_WIDTH[s.skin]),
    errors: 0
  }
  const m = s.modes[s.active]
  if (s.viz && m === 'step') c.modeChanged = true
  else if (s.viz && m !== undefined) c.mode = m
  return c
}

function sentence (s, c) {
  const strip = s.tabs.length > 1 ? `the tab strip with ${s.tabs.length} tabs, tab ${s.active} active` : 'no tab strip'
  const viz = s.viz ? `, and a visualization window of ${c.panes} pane${c.panes === 1 ? '' : 's'}` : ', and no visualization window'
  const size = c.width === null ? '' : ` The window is ${c.width} px wide, the skin drawn at ${c.scale.toFixed(2)} of its size.`
  return `The ${s.skin} skin with ${strip}, its terminal at ${c.fontSize} px${viz}.${size}`
}

// n actions from seed, each with its prediction made before any run.
function generate (seed, n, skin = 'deck') {
  const r = rng(seed)
  let s = initial(skin)
  const steps = []
  const names = Object.keys(ACTIONS)
  for (let k = 1; k <= n; k++) {
    let name
    do name = names[Math.floor(r() * names.length)]
    while (!ACTIONS[name].ok(s))
    const a = ACTIONS[name]
    const arg = a.arg ? a.arg(s, r) : {}
    s = clone(s)
    a.run(s, arg)
    const c = claims(s)
    steps.push({ k, action: name, arg, claims: c, says: sentence(s, c) })
    // A stepped mode not predicted before stays unpredicted after.
    for (const id of Object.keys(s.modes)) if (s.modes[id] === 'step') delete s.modes[id]
  }
  return steps
}

module.exports = { rng, initial, generate, claims, ACTIONS, SKINS, MIN_WIDTH, FLOOR, SKIN_FONT }
