'use strict'
// The user's settings: one definition for every skin. A skin
// cannot add, remove or rename a setting. Each setting overrides one
// manifest value, and null returns to the skin's own. Beside them,
// `panels` keeps the sizes the user dragged each skin's splits to,
// by skin name and split id (decision 0035). Kept in
// $XDG_STATE_HOME/claude-skins/settings.json, written by write and
// rename, read at launch.

const fs = require('fs')
const os = require('os')
const path = require('path')

const FONT_SIZES = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28, 30, 32]

const SETTINGS = [
  {
    id: 'terminal.fontSize',
    label: 'Terminal font size',
    overrides: 'terminal.fontSize',
    values: FONT_SIZES,
    unit: 'px',
    skinValue: skin => (skin && skin.terminal && skin.terminal.fontSize) || 14
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
    const own = s.skinValue(skin)
    const cur = values[s.id]
    return {
      id: s.id,
      label: s.label,
      choices: [{ value: null, label: `Skin default (${own} ${s.unit})`, current: cur === null }]
        .concat(s.values.map(v => ({ value: v, label: `${v} ${s.unit}`, current: cur === v })))
    }
  })
}

module.exports = { SETTINGS, file, load, save, valid, menu, setPanel, panelsOf }
