'use strict'
// The user's settings: one definition for every skin. A skin
// cannot add, remove or rename a setting. The terminal's font size
// overrides the manifest's, and the three text sizes scale the text of
// the skin, of the window's own parts and of the visualization window
// (decision 0036). The visualization's frame rate caps the frames its
// window draws (decision 0036), and Gravity 3D's sharpness is the pixels
// it traces a pane (decision 0015). null returns to the skin's or the
// app's own. Beside them,
// `panels` keeps the sizes the user dragged each skin's splits to,
// by skin name and split id (decision 0035). Kept in
// $XDG_STATE_HOME/claude-skins/settings.json, written by write and
// rename, read at launch.

const fs = require('fs')
const os = require('os')
const path = require('path')

const FONT_SIZES = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28, 30, 32]
// The text sizes of decision 0036, in percent of the size the skin or
// the app draws. The window's strips hold their text up to 150.
const TEXT_SCALES = [70, 80, 90, 110, 125, 150]
// The visualization's frame rate caps, in frames a second. null: no cap,
// the display's own rate.
const FRAME_RATES = [15, 20, 24, 30, 60]
// Gravity 3D's traced pixels a pane, a window three times as many.
// null: the mode's own PANE, TRACE_OWN.
const TRACES = [15000, 45000, 60000, 90000, 135000]
const TRACE_OWN = 30000
// How the Gravity modes draw their gravitational waves. null: the
// colour field, WAVES_OWN.
const WAVES = ['smoke']
const WAVES_OWN = 'colour'

// own: the value null stands for, own(skin). show: a value as the menu
// writes it.
const SETTINGS = [
  {
    id: 'terminal.fontSize',
    label: 'Terminal font size',
    values: FONT_SIZES,
    own: skin => (skin && skin.terminal && skin.terminal.fontSize) || 14,
    show: v => `${v} px`,
    none: 'Skin default'
  },
  {
    id: 'text.skin',
    label: 'Skin text size',
    values: TEXT_SCALES,
    own: () => 100,
    show: v => `${v}%`,
    none: 'Skin default'
  },
  {
    id: 'text.window',
    label: 'Window text size',
    values: TEXT_SCALES,
    own: () => 100,
    show: v => `${v}%`,
    none: 'Default'
  },
  {
    id: 'text.viz',
    label: 'Visualization text size',
    values: TEXT_SCALES,
    own: () => 100,
    show: v => `${v}%`,
    none: 'Default'
  },
  {
    id: 'viz.fps',
    label: 'Visualization frame rate',
    values: FRAME_RATES,
    own: () => null,
    show: v => v === null ? 'display rate' : `${v} fps`,
    none: 'Uncapped'
  },
  {
    id: 'viz.trace',
    label: 'Gravity 3D sharpness',
    values: TRACES,
    own: () => TRACE_OWN,
    show: v => `${v} px a pane`,
    none: 'Default'
  },
  {
    id: 'viz.waves',
    label: 'Gravitational waves',
    values: WAVES,
    own: () => WAVES_OWN,
    show: v => v,
    none: 'Default'
  }
]

const byId = new Map(SETTINGS.map(s => [s.id, s]))

function file (env = process.env) {
  return path.join(env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state'), 'claude-skins', 'settings.json')
}

const valid = (id, v) => byId.has(id) && (v === null || byId.get(id).values.includes(v))

// A split's size: a number of pixels. The skin clamps it to its range.
const size = v => typeof v === 'number' && isFinite(v) && v >= 0

// The panel sizes kept: names and ids as a skin's, sizes as above.
function panelsOf (raw) {
  const out = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [skin, ids] of Object.entries(raw)) {
    if (!/^[a-z0-9-]+$/.test(skin) || !ids || typeof ids !== 'object' || Array.isArray(ids)) continue
    const kept = Object.fromEntries(Object.entries(ids).filter(([id, v]) => /^[a-z0-9-]+$/.test(id) && size(v)))
    if (Object.keys(kept).length) out[skin] = kept
  }
  return out
}

// Every setting, null where the file has no valid value, and the panel
// sizes.
function load (f) {
  let raw = {}
  try { raw = JSON.parse(fs.readFileSync(f, 'utf8')) } catch (e) {}
  const out = {}
  for (const s of SETTINGS) out[s.id] = raw && valid(s.id, raw[s.id]) ? raw[s.id] : null
  out.panels = panelsOf(raw && raw.panels)
  return out
}

// The settings with one split of one skin at a size, or, with id null,
// every split of that skin back to the skin's own.
function setPanel (values, skin, id, v) {
  const panels = Object.assign({}, values.panels)
  if (id === null) delete panels[skin]
  else panels[skin] = Object.assign({}, panels[skin], { [id]: v })
  return Object.assign({}, values, { panels })
}

function save (f, values) {
  fs.mkdirSync(path.dirname(f), { recursive: true })
  const tmp = `${f}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(values, null, 1) + '\n')
  fs.renameSync(tmp, f)
}

// The menu's rows: each setting with its choices, the skin's own first,
// the current one marked.
function menu (values, skin) {
  return SETTINGS.map(s => {
    const cur = values[s.id]
    return {
      id: s.id,
      label: s.label,
      choices: [{ value: null, label: `${s.none} (${s.show(s.own(skin))})`, current: cur === null }]
        .concat(s.values.map(v => ({ value: v, label: s.show(v), current: cur === v })))
    }
  })
}

// A text size of decision 0036 as a factor: 1 for the default.
const scale = (values, id) => (values && byId.has(id) && byId.get(id).values.includes(values[id]) ? values[id] : 100) / 100

// A setting's value in effect: the one chosen, else the app's own, null
// for a setting whose own is no value (viz.fps: no cap).
const value = (values, id) => {
  const s = byId.get(id)
  if (!s) return null
  return values && s.values.includes(values[id]) ? values[id] : s.own(null)
}

module.exports = { SETTINGS, TEXT_SCALES, FRAME_RATES, TRACES, TRACE_OWN, WAVES, WAVES_OWN, file, load, save, valid, menu, scale, value, setPanel, panelsOf }
