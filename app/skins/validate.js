'use strict'
// Skin validator (decisions 0005, 0006, 0008). validate(dir) returns
// { skin, errors }, each error `<file>: <field path>: <message>`.

const fs = require('fs')
const path = require('path')
const names = require('../metrics/names')
const splitsLib = require('../renderer/splits')
const textscale = require('./textscale')

const REPO = path.join(__dirname, '..', '..')
const STRIP = 22
const IMAGE = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']
const FONT = ['.ttf', '.otf', '.woff', '.woff2']
const AUDIO = ['.ogg', '.opus', '.mp3', '.wav']
const ALLOWED_FILES = ['.json', '.css', '.txt', '.md', ...IMAGE, ...FONT, ...AUDIO]
// Skin sounds (decision 0024): how many, and the longest random interval.
const MAX_SOUNDS = 16
const MAX_INTERVAL = 3600
const PLAIN_NAMES = /^(LICENSE|LICENCE|COPYING|README|NOTICE|AUTHORS|OFL)([._-].*)?$/i
const THEME_KEYS = ['foreground', 'background', 'cursor', 'cursorAccent', 'selectionBackground', 'selectionForeground',
  'selectionInactiveBackground', 'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white', 'brightBlack',
  'brightRed', 'brightGreen', 'brightYellow', 'brightBlue', 'brightMagenta', 'brightCyan', 'brightWhite']
const COMMON = ['id', 'type', 'bind', 'rect', 'follow', 'class', 'label', 'min', 'max', 'format', 'damping']
const TYPES = {
  gauge: ['startAngle', 'endAngle', 'thickness', 'ticks', 'marks'],
  needle: ['startAngle', 'endAngle', 'face', 'ticks', 'resets'],
  knob: ['image', 'startAngle', 'endAngle'],
  bar: ['orientation', 'segments', 'gap', 'resets', 'fallback'],
  led: ['on', 'pulse', 'pulseMs', 'blink'],
  readout: ['prefix', 'suffix', 'resets', 'fallback'],
  sprite: ['sheet', 'frames', 'frameWidth', 'frameHeight', 'layout', 'mode', 'fps'],
  list: ['rows', 'toggle'],
  limits: ['meter', 'direction', 'suffix', 'itemClass', 'orientation', 'segments', 'gap', 'startAngle', 'endAngle', 'ticks', 'face']
}
// The list-valued metric each list-showing type binds (decisions 0034,
// 0011).
const LIST_OF = { list: 'checklist.items', limits: 'limits.items' }
const FORMAT = /^(int|fixed:[0-4]|pct|usd|tokens|duration|until|bytes|text)$/
const CLASS = /^[a-z0-9-]+( [a-z0-9-]+)*$/
const ID = /^[a-z0-9-]+$/
const COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

function rel (p) {
  const r = path.relative(REPO, p)
  return r.startsWith('..') ? p : r
}

function luminance (hex) {
  let h = hex.slice(1)
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const ch = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
    .map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}

function contrast (a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

function pngSize (file) {
  const fd = fs.openSync(file, 'r')
  try {
    const b = Buffer.alloc(24)
    fs.readSync(fd, b, 0, 24, 0)
    if (b.readUInt32BE(0) !== 0x89504e47 || b.toString('ascii', 12, 16) !== 'IHDR') return null
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }
  } finally {
    fs.closeSync(fd)
  }
}

// A rect's box in an area W x H, from two of left, right, width and two
// of top, bottom, height (decision 0006).
function box (r, W, H) {
  const axis = (s, e, n, L) => s in r ? (n in r ? [r[s], r[s] + r[n]] : [r[s], L - r[e]]) : [L - r[e] - r[n], L - r[e]]
  const [x0, x1] = axis('left', 'right', 'width', W)
  const [y0, y1] = axis('top', 'bottom', 'height', H)
  return { x0, x1, y0, y1 }
}

const num = v => typeof v === 'number' && isFinite(v)
const sized = w => !!w && ['width', 'height', 'minWidth', 'minHeight'].every(k => num(w[k]))

// A rect the box can be computed from: well formed, every value a number.
function placed (r, stretch) {
  if (!r || typeof r !== 'object' || !Object.values(r).every(num)) return false
  if (stretch) return ['left', 'right', 'top', 'bottom'].every(k => k in r)
  return ['left', 'right', 'width'].filter(k => k in r).length === 2 && ['top', 'bottom', 'height'].filter(k => k in r).length === 2
}

function validate (dir) {
  const errors = []
  const root = path.resolve(dir)
  const manifestPath = path.join(root, 'skin.json')
  const mf = rel(manifestPath)
  const err = (field, msg, file = mf) => errors.push(`${file}: ${field}: ${msg}`)
  let realRoot
  try { realRoot = fs.realpathSync(root) } catch (e) {
    return { skin: null, errors: [`${rel(root)}: skin: directory not found`] }
  }
  let skin
  try {
    skin = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  } catch (e) {
    return { skin: null, errors: [`${mf}: (file): ${e.code === 'ENOENT' ? 'missing' : 'not valid JSON: ' + e.message}`] }
  }
  if (!skin || typeof skin !== 'object' || Array.isArray(skin)) return { skin: null, errors: [`${mf}: (root): must be an object`] }

  const isNum = v => typeof v === 'number' && isFinite(v)
  const isStr = v => typeof v === 'string' && v.length > 0
  const keys = (obj, field, allowed) => {
    for (const k of Object.keys(obj)) if (!allowed.includes(k)) err(`${field}${field ? '.' : ''}${k}`, 'unknown field')
  }

  // A file the manifest or CSS names: inside the skin by realpath, of an
  // allowed kind, present.
  const file = (p, field, exts, from = root, errFile = mf) => {
    if (!isStr(p)) return err(field, 'must be a relative file path', errFile)
    if (path.isAbsolute(p) || /^[a-z][a-z0-9+.-]*:/i.test(p)) return err(field, `"${p}": must be a path relative to the skin`, errFile)
    const full = path.resolve(from, p)
    if (!exts.includes(path.extname(full).toLowerCase())) return err(field, `"${p}": file type not allowed here (${exts.join(' ')})`, errFile)
    let real
    try { real = fs.realpathSync(full) } catch (e) { return err(field, `"${p}": file not found`, errFile) }
    if (real !== realRoot && !real.startsWith(realRoot + path.sep)) return err(field, `"${p}": outside the skin directory`, errFile)
    if (!fs.statSync(real).isFile()) return err(field, `"${p}": not a file`, errFile)
    return real
  }

  const rect = (r, field, stretch) => {
    if (!r || typeof r !== 'object') return err(field, 'missing rect')
    keys(r, field, ['left', 'right', 'width', 'top', 'bottom', 'height'])
    for (const [k, v] of Object.entries(r)) if (!isNum(v)) err(`${field}.${k}`, 'must be a number of pixels')
    const h = ['left', 'right', 'width'].filter(k => k in r).length
    const v = ['top', 'bottom', 'height'].filter(k => k in r).length
    if (stretch) {
      for (const k of ['left', 'right', 'top', 'bottom']) if (!(k in r)) err(field, `needs ${k}: the terminal stretches with the window`)
    } else {
      if (h !== 2) err(field, 'needs exactly two of left, right, width')
      if (v !== 2) err(field, 'needs exactly two of top, bottom, height')
    }
  }

  keys(skin, '', ['name', 'version', 'author', 'description', 'license', 'window', 'terminal', 'menu', 'fonts', 'stylesheet', 'panels', 'widgets', 'sounds', 'splits'])
  if (!isStr(skin.name) || !ID.test(skin.name)) err('name', 'must be lowercase letters, digits and dashes')
  for (const k of ['version', 'author', 'description', 'license']) if (k in skin && typeof skin[k] !== 'string') err(k, 'must be a string')

  const win = skin.window
  if (!win || typeof win !== 'object') err('window', 'missing')
  else {
    keys(win, 'window', ['width', 'height', 'minWidth', 'minHeight'])
    for (const k of ['width', 'height', 'minWidth', 'minHeight']) if (!isNum(win[k]) || win[k] < 200) err(`window.${k}`, 'must be a number of pixels, at least 200')
    if (win.minWidth > win.width) err('window.minWidth', 'larger than width')
    if (win.minHeight > win.height) err('window.minHeight', 'larger than height')
  }

  const t = skin.terminal
  if (!t || typeof t !== 'object') err('terminal', 'missing')
  else {
    keys(t, 'terminal', ['rect', 'theme', 'fontFamily', 'fontSize'])
    rect(t.rect, 'terminal.rect', true)
    if ('fontFamily' in t && !isStr(t.fontFamily)) err('terminal.fontFamily', 'must be a string')
    const fs_ = 'fontSize' in t ? t.fontSize : 14
    if (!isNum(fs_) || fs_ < 8 || fs_ > 32) err('terminal.fontSize', 'must be a number from 8 to 32')
    const th = t.theme
    if (!th || typeof th !== 'object') err('terminal.theme', 'missing')
    else {
      keys(th, 'terminal.theme', THEME_KEYS)
      for (const [k, v] of Object.entries(th)) if (typeof v !== 'string' || !COLOR.test(v)) err(`terminal.theme.${k}`, `"${v}": must be a #rgb, #rrggbb or #rrggbbaa colour`)
      for (const k of ['foreground', 'background']) if (!th[k] || !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(th[k])) err(`terminal.theme.${k}`, 'required as an opaque #rgb or #rrggbb colour')
      if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(th.foreground || '') && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(th.background || '')) {
        const c = contrast(th.foreground, th.background)
        if (c < 4.5) err('terminal.theme.foreground', `contrast with background is ${c.toFixed(2)}, needs at least 4.5`)
      }
    }
    if (win && t.rect && isNum(win.minWidth) && isNum(win.minHeight) && isNum(fs_)) {
      const r = t.rect
      const cols = Math.floor((win.minWidth - (r.left || 0) - (r.right || 0)) / (fs_ * 0.6))
      const rows = Math.floor((win.minHeight - STRIP - (r.top || 0) - (r.bottom || 0)) / (fs_ * 1.2))
      if (cols < 40 || rows < 10) err('terminal.rect', `leaves about ${cols} x ${rows} cells at the minimum window, needs 40 x 10`)
    }
  }

  // Draggable boundaries (decision 0035): at most one on each edge of
  // the terminal, whose offset on that edge lies from min to max.
  const splitIds = new Map()
  if ('splits' in skin) {
    if (!Array.isArray(skin.splits)) err('splits', 'must be an array')
    else {
      const edges = new Set()
      skin.splits.forEach((s, i) => {
        const fld = `splits[${i}]`
        if (!s || typeof s !== 'object' || Array.isArray(s)) return err(fld, 'must be an object')
        keys(s, fld, ['id', 'edge', 'min', 'max'])
        let ok = true
        if (!isStr(s.id) || !ID.test(s.id)) { ok = false; err(`${fld}.id`, 'must be lowercase letters, digits and dashes') } else if (splitIds.has(s.id)) { ok = false; err(`${fld}.id`, `duplicate id "${s.id}"`) }
        if (!splitsLib.EDGES.includes(s.edge)) { ok = false; err(`${fld}.edge`, 'must be left, right, top or bottom') } else if (edges.has(s.edge)) { ok = false; err(`${fld}.edge`, `a second split on the terminal's ${s.edge} edge`) } else edges.add(s.edge)
        for (const k of ['min', 'max']) if (!isNum(s[k]) || s[k] < 0) { ok = false; err(`${fld}.${k}`, 'must be a number of pixels, at least 0') }
        const def = t && t.rect && t.rect[s.edge]
        if (ok && isNum(def) && !(s.min <= def && def <= s.max)) err(fld, `the terminal's ${s.edge} of ${def} must lie from min to max`)
        if (ok) splitIds.set(s.id, s)
      })
    }
  }

  // An element's follow: rect keys, each moved by a split's change, its
  // own edge or the size of a rect anchored there (decision 0035).
  const follow = (o, r, fld) => {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return err(`${fld}.follow`, 'must be an object of rect keys and split ids')
    for (const [key, id] of Object.entries(o)) {
      const f = `${fld}.follow.${key}`
      const s = splitIds.get(id)
      if (!['left', 'right', 'width', 'top', 'bottom', 'height'].includes(key)) err(f, 'not a rect key')
      else if (!s) err(f, `unknown split "${id}"`)
      else if (r && typeof r === 'object' && !splitsLib.movable(s.edge, key, r)) err(f, `the ${s.edge} split "${id}" moves ${s.edge}, or ${splitsLib.SIZE[s.edge]} on a rect with ${s.edge}`)
    }
  }

  // The menu button (decision 0022): required, drawn by the app above the
  // skin, inside the skin area and clear of the terminal at the minimum
  // and the initial window size.
  const m = skin.menu
  if (!m || typeof m !== 'object' || Array.isArray(m)) err('menu', 'missing: every skin places the menu button')
  else {
    keys(m, 'menu', ['rect', 'image', 'hover', 'pressed'])
    rect(m.rect, 'menu.rect', false)
    file(m.image, 'menu.image', IMAGE)
    for (const k of ['hover', 'pressed']) if (k in m) file(m[k], `menu.${k}`, IMAGE)
    if (sized(win) && placed(m.rect, false) && t && placed(t.rect, true)) {
      const said = new Set()
      for (const [W, H, at] of [[win.minWidth, win.minHeight, 'minimum'], [win.width, win.height, 'initial']]) {
        const b = box(m.rect, W, H - STRIP)
        const tb = box(t.rect, W, H - STRIP)
        const w = b.x1 - b.x0
        const h = b.y1 - b.y0
        const fault = [
          ['size', w < 16 || h < 16, `is ${w} x ${h} px at the ${at} window, needs at least 16 x 16`],
          ['outside', b.x0 < 0 || b.y0 < 0 || b.x1 > W || b.y1 > H - STRIP, `lies outside the skin area at the ${at} window`],
          ['terminal', b.x0 < tb.x1 && tb.x0 < b.x1 && b.y0 < tb.y1 && tb.y0 < b.y1, `overlaps the terminal at the ${at} window`]
        ]
        for (const [kind, bad, msg] of fault) {
          if (bad && !said.has(kind)) { said.add(kind); err('menu.rect', msg) }
        }
      }
    }
  }

  if ('fonts' in skin) {
    if (!Array.isArray(skin.fonts)) err('fonts', 'must be an array')
    else {
      skin.fonts.forEach((f, i) => {
        const fld = `fonts[${i}]`
        if (!f || typeof f !== 'object') return err(fld, 'must be an object')
        keys(f, fld, ['family', 'file', 'weight', 'style'])
        if (!isStr(f.family) || !/^[A-Za-z0-9 _-]+$/.test(f.family)) err(`${fld}.family`, 'must be letters, digits, spaces, dashes')
        file(f.file, `${fld}.file`, FONT)
        if ('style' in f && !['normal', 'italic'].includes(f.style)) err(`${fld}.style`, 'must be normal or italic')
      })
    }
  }

  if ('stylesheet' in skin) {
    const css = file(skin.stylesheet, 'stylesheet', ['.css'])
    if (css) {
      const cf = rel(css)
      const text = fs.readFileSync(css, 'utf8').replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
      const lineOf = i => text.slice(0, i).split('\n').length
      for (const m of text.matchAll(/@import\b/gi)) err(`line ${lineOf(m.index)}`, '@import is not allowed', cf)
      // Text sized in px, or in em or % of a px size, follows the user's
      // skin text size (decision 0036). Any other unit escapes it.
      for (const m of textscale.strays(text)) err(`line ${lineOf(m.index)}`, `a text size in ${m.what} does not follow the user's text size, use px, em or %`, cf)
      for (const m of text.matchAll(/url\(\s*(['"]?)([^'")]*)\1\s*\)/gi)) {
        const target = m[2].trim()
        if (/^data:image\//i.test(target)) continue
        file(target, `line ${lineOf(m.index)}: url(${target})`, [...IMAGE, ...FONT], path.dirname(css), cf)
      }
    }
  }

  if ('panels' in skin) {
    if (!Array.isArray(skin.panels)) err('panels', 'must be an array')
    else {
      skin.panels.forEach((p, i) => {
        const fld = `panels[${i}]`
        if (!p || typeof p !== 'object') return err(fld, 'must be an object')
        keys(p, fld, ['class', 'rect', 'follow'])
        if (!isStr(p.class) || !CLASS.test(p.class)) err(`${fld}.class`, 'must be lowercase class names')
        rect(p.rect, `${fld}.rect`, false)
        if ('follow' in p) follow(p.follow, p.rect, fld)
      })
    }
  }

  // A list's toggle (decision 0034): a button of two options, the list
  // and what it replaces, clear of the list and the terminal at the
  // minimum and the initial window, so it hides no row of the list.
  const toggle = (w, fld) => {
    const g = w.toggle
    const tf = `${fld}.toggle`
    if (!g || typeof g !== 'object' || Array.isArray(g)) return err(tf, 'must be an object of rect, labels and class')
    keys(g, tf, ['rect', 'labels', 'class', 'follow'])
    rect(g.rect, `${tf}.rect`, false)
    if ('follow' in g) follow(g.follow, g.rect, tf)
    if ('labels' in g && (!Array.isArray(g.labels) || g.labels.length !== 2 || !g.labels.every(isStr))) err(`${tf}.labels`, 'must be two strings, the list\'s and what it replaces')
    if ('class' in g && (!isStr(g.class) || !CLASS.test(g.class))) err(`${tf}.class`, 'must be lowercase class names')
    if (!sized(win) || !placed(g.rect, false) || !placed(w.rect, false)) return
    const said = new Set()
    for (const [W, H, at] of [[win.minWidth, win.minHeight, 'minimum'], [win.width, win.height, 'initial']]) {
      const b = box(g.rect, W, H - STRIP)
      const over = o => b.x0 < o.x1 && o.x0 < b.x1 && b.y0 < o.y1 && o.y0 < b.y1
      const fault = [
        ['list', over(box(w.rect, W, H - STRIP)), `overlaps the list at the ${at} window`],
        ['terminal', t && placed(t.rect, true) && over(box(t.rect, W, H - STRIP)), `overlaps the terminal at the ${at} window`]
      ]
      for (const [kind, bad, msg] of fault) {
        if (bad && !said.has(kind)) { said.add(kind); err(`${tf}.rect`, msg) }
      }
    }
  }

  if ('widgets' in skin) {
    if (!Array.isArray(skin.widgets)) err('widgets', 'must be an array')
    else {
      const ids = new Set()
      skin.widgets.forEach((w, i) => {
        const fld = `widgets[${i}]`
        if (!w || typeof w !== 'object') return err(fld, 'must be an object')
        if (!TYPES[w.type]) return err(`${fld}.type`, `unknown widget type "${w.type}", one of ${Object.keys(TYPES).join(', ')}`)
        keys(w, fld, [...COMMON, ...TYPES[w.type]])
        if (!isStr(w.id) || !ID.test(w.id)) err(`${fld}.id`, 'must be lowercase letters, digits and dashes')
        else if (ids.has(w.id)) err(`${fld}.id`, `duplicate id "${w.id}"`)
        else ids.add(w.id)
        if (!isStr(w.bind)) err(`${fld}.bind`, 'missing metric name')
        else if (!names.known(w.bind)) err(`${fld}.bind`, `unknown metric "${w.bind}"`)
        else if (LIST_OF[w.type] && w.bind !== LIST_OF[w.type]) err(`${fld}.bind`, `"${w.bind}": a ${w.type} widget shows ${LIST_OF[w.type]}`)
        else if (!LIST_OF[w.type] && names.isList(w.bind)) err(`${fld}.bind`, `"${w.bind}": a list-valued metric needs a ${Object.keys(LIST_OF).find(k => LIST_OF[k] === w.bind)} widget`)
        if (w.type === 'limits') {
          if ('meter' in w && !['bar', 'needle'].includes(w.meter)) err(`${fld}.meter`, 'must be bar or needle')
          if ('direction' in w && !['row', 'column'].includes(w.direction)) err(`${fld}.direction`, 'must be row or column')
          if ('itemClass' in w && (!isStr(w.itemClass) || !CLASS.test(w.itemClass))) err(`${fld}.itemClass`, 'must be lowercase class names')
        }
        if ('resets' in w && (!isStr(w.resets) || !names.known(w.resets))) err(`${fld}.resets`, `unknown metric "${w.resets}"`)
        if ('fallback' in w) {
          const f = w.fallback
          if (!f || typeof f !== 'object' || Array.isArray(f)) err(`${fld}.fallback`, 'must be an object of bind, label and resets')
          else {
            keys(f, `${fld}.fallback`, ['bind', 'label', 'resets'])
            for (const k of ['bind', 'resets']) if (k in f && (!isStr(f[k]) || !names.known(f[k]))) err(`${fld}.fallback.${k}`, `unknown metric "${f[k]}"`)
            if (!('bind' in f)) err(`${fld}.fallback.bind`, 'missing metric name')
            if ('label' in f && typeof f.label !== 'string') err(`${fld}.fallback.label`, 'must be a string')
          }
        }
        rect(w.rect, `${fld}.rect`, false)
        if ('follow' in w) follow(w.follow, w.rect, fld)
        if ('class' in w && (!isStr(w.class) || !CLASS.test(w.class))) err(`${fld}.class`, 'must be lowercase class names')
        if ('label' in w && typeof w.label !== 'string') err(`${fld}.label`, 'must be a string')
        for (const k of ['min', 'max', 'startAngle', 'endAngle', 'thickness', 'ticks', 'segments', 'gap', 'on', 'pulseMs', 'blink', 'fps', 'damping', 'rows']) {
          if (k in w && !isNum(w[k])) err(`${fld}.${k}`, 'must be a number')
        }
        if (isNum(w.min) && isNum(w.max) && w.max <= w.min) err(`${fld}.max`, 'must be larger than min')
        if ('format' in w && (typeof w.format !== 'string' || !FORMAT.test(w.format))) err(`${fld}.format`, `"${w.format}": one of int, fixed:N, pct, usd, tokens, duration, until, bytes, text`)
        for (const k of ['prefix', 'suffix']) if (k in w && typeof w[k] !== 'string') err(`${fld}.${k}`, 'must be a string')
        if ('orientation' in w && !['horizontal', 'vertical'].includes(w.orientation)) err(`${fld}.orientation`, 'must be horizontal or vertical')
        if ('pulse' in w && typeof w.pulse !== 'boolean') err(`${fld}.pulse`, 'must be true or false')
        if (w.type === 'led' && !('on' in w) && !w.pulse) err(fld, 'a led needs on (a threshold) or pulse: true')
        if ('face' in w) file(w.face, `${fld}.face`, IMAGE)
        if ('image' in w) file(w.image, `${fld}.image`, IMAGE)
        if ('marks' in w) {
          if (!Array.isArray(w.marks)) err(`${fld}.marks`, 'must be an array')
          else {
            w.marks.forEach((m, j) => {
              const mf_ = `${fld}.marks[${j}]`
              if (!m || typeof m !== 'object') return err(mf_, 'must be an object')
              keys(m, mf_, ['bind', 'value', 'class'])
              if (('bind' in m) === ('value' in m)) err(mf_, 'needs exactly one of bind, value')
              if ('bind' in m && !names.known(m.bind)) err(`${mf_}.bind`, `unknown metric "${m.bind}"`)
              if ('value' in m && !isNum(m.value)) err(`${mf_}.value`, 'must be a number')
              if ('class' in m && (!isStr(m.class) || !CLASS.test(m.class))) err(`${mf_}.class`, 'must be lowercase class names')
            })
          }
        }
        if (w.type === 'list' && 'toggle' in w) toggle(w, fld)
        if (w.type === 'sprite') {
          for (const k of ['frames', 'frameWidth', 'frameHeight']) if (!isNum(w[k]) || w[k] < 1) err(`${fld}.${k}`, 'required, a positive number')
          if ('layout' in w && !['row', 'column'].includes(w.layout)) err(`${fld}.layout`, 'must be row or column')
          if ('mode' in w && !['value', 'run'].includes(w.mode)) err(`${fld}.mode`, 'must be value or run')
          const sheet = file(w.sheet, `${fld}.sheet`, ['.png'])
          if (sheet && isNum(w.frames) && isNum(w.frameWidth) && isNum(w.frameHeight)) {
            const sz = pngSize(sheet)
            const col = w.layout === 'column'
            const want = col ? { width: w.frameWidth, height: w.frameHeight * w.frames } : { width: w.frameWidth * w.frames, height: w.frameHeight }
            if (!sz) err(`${fld}.sheet`, 'not a PNG file')
            else if (sz.width !== want.width || sz.height !== want.height) {
              err(`${fld}.sheet`, `is ${sz.width} x ${sz.height} px, ${w.frames} frames of ${w.frameWidth} x ${w.frameHeight} in a ${col ? 'column' : 'row'} need ${want.width} x ${want.height}`)
            }
          }
        }
      })
    }
  }

  // Sounds (decision 0024): files of the skin, played on a loop or one at
  // a time after a random wait of interval [min, max] seconds.
  if ('sounds' in skin) {
    if (!Array.isArray(skin.sounds)) err('sounds', 'must be an array')
    else {
      if (skin.sounds.length > MAX_SOUNDS) err('sounds', `has ${skin.sounds.length} sounds, at most ${MAX_SOUNDS}`)
      skin.sounds.forEach((s, i) => {
        const fld = `sounds[${i}]`
        if (!s || typeof s !== 'object' || Array.isArray(s)) return err(fld, 'must be an object')
        keys(s, fld, ['file', 'mode', 'volume', 'interval'])
        file(s.file, `${fld}.file`, AUDIO)
        if (!['loop', 'random'].includes(s.mode)) err(`${fld}.mode`, 'must be loop or random')
        if ('volume' in s && (!isNum(s.volume) || s.volume < 0 || s.volume > 1)) err(`${fld}.volume`, 'must be a number from 0 to 1')
        if (s.mode === 'random') {
          const iv = s.interval
          if (!Array.isArray(iv) || iv.length !== 2 || !iv.every(isNum)) err(`${fld}.interval`, 'required for a random sound: [min, max] in seconds')
          else if (iv[0] < 1 || iv[1] < iv[0] || iv[1] > MAX_INTERVAL) err(`${fld}.interval`, `needs 1 <= min <= max <= ${MAX_INTERVAL} seconds`)
        } else if ('interval' in s) {
          err(`${fld}.interval`, 'only a random sound has an interval')
        }
      })
    }
  }

  // The splits at their min at the minimum window and at their max at
  // the initial window (decision 0035): the terminal keeps 40 x 10, an
  // element that follows keeps a size, and no two boxes apart with the
  // splits at their default meet, the terminal's among them.
  if (!errors.length && splitIds.size) {
    const els = [{ fld: 'menu', rect: m.rect }]
    for (const [i, p] of (skin.panels || []).entries()) els.push({ fld: `panels[${i}]`, rect: p.rect, follow: p.follow })
    for (const [i, w] of (skin.widgets || []).entries()) {
      els.push({ fld: `widgets[${i}]`, rect: w.rect, follow: w.follow })
      if (w.toggle) els.push({ fld: `widgets[${i}].toggle`, rect: w.toggle.rect, follow: w.toggle.follow })
    }
    const over = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1
    const fs_ = t.fontSize || 14
    for (const [W, H, at, end] of [[win.minWidth, win.minHeight - STRIP, 'minimum', 'min'], [win.width, win.height - STRIP, 'initial', 'max']]) {
      const where = `with the splits at their ${end} at the ${at} window`
      const now = splitsLib.sizes(skin, Object.fromEntries([...splitIds.values()].map(s => [s.id, s[end]])), W, H)
      const tr = splitsLib.terminal(skin, now)
      const cols = Math.floor((W - tr.left - tr.right) / (fs_ * 0.6))
      const rows = Math.floor((H - tr.top - tr.bottom) / (fs_ * 1.2))
      if (cols < 40 || rows < 10) err('terminal.rect', `leaves about ${cols} x ${rows} cells ${where}, needs 40 x 10`)
      const term = { a: box(t.rect, W, H), b: box(tr, W, H) }
      const boxes = els.map(e => ({ e, a: box(e.rect, W, H), b: box(splitsLib.rect(e.rect, e.follow, skin, now), W, H) }))
      boxes.forEach((x, i) => {
        if (x.e.follow && (x.b.x1 <= x.b.x0 || x.b.y1 <= x.b.y0)) err(`${x.e.fld}.rect`, `has no size ${where}`)
        if (!over(x.a, term.a) && over(x.b, term.b)) err(`${x.e.fld}.rect`, `overlaps the terminal ${where}`)
        for (const y of boxes.slice(i + 1)) if (!over(x.a, y.a) && over(x.b, y.b)) err(`${x.e.fld}.rect`, `meets ${y.e.fld} ${where}`)
      })
    }
  }

  // Every file in the skin must be of a kind a skin may carry.
  const walk = d => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name)
      if (ent.isDirectory()) walk(p)
      else if (!ALLOWED_FILES.includes(path.extname(ent.name).toLowerCase()) && !PLAIN_NAMES.test(ent.name)) {
        errors.push(`${rel(p)}: (file): file type not allowed in a skin`)
      }
    }
  }
  walk(root)

  return { skin: errors.length ? null : Object.assign({}, skin, { dir: realRoot }), errors }
}

module.exports = { validate, contrast, pngSize }
