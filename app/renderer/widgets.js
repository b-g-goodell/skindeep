'use strict'
// The seven display widgets (decision 0007) and the list (decision
// 0034). Each returns
// { el, update(snapshot, now), frame(now, dt) }. Values move toward their
// targets with a damped spring. Parts carry stable class names that skin
// CSS styles, colours come from CSS custom properties.

const SVGNS = 'http://www.w3.org/2000/svg'

function svg (tag, attrs, parent) {
  const e = document.createElementNS(SVGNS, tag)
  for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v)
  if (parent) parent.appendChild(e)
  return e
}

function div (cls, parent, text) {
  const e = document.createElement('div')
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  if (parent) parent.appendChild(e)
  return e
}

function format (v, fmt) {
  if (v === null || v === undefined) return '--'
  if (typeof v === 'string' || fmt === 'text') return String(v)
  if (!isFinite(v)) return '--'
  if (Math.abs(v) < 1e-9) v = 0
  const f = fmt || 'int'
  if (f === 'int' && Math.round(v) === 0) return '0'
  if (f === 'int') return Math.round(v).toLocaleString('en-US')
  if (f.startsWith('fixed:')) return v.toFixed(Number(f.slice(6)))
  if (f === 'pct') return v.toFixed(1) + '%'
  if (f === 'usd') return '$' + v.toFixed(v < 10 ? 2 : 1)
  if (f === 'tokens') {
    if (Math.abs(v) < 1000) return String(Math.round(v))
    if (Math.abs(v) < 1e6) return (v / 1e3).toFixed(1) + 'k'
    return (v / 1e6).toFixed(2) + 'M'
  }
  if (f === 'duration') {
    const s = Math.max(0, Math.floor(v))
    const h = Math.floor(s / 3600)
    const m = Math.floor(s / 60) % 60
    const ss = String(s % 60).padStart(2, '0')
    return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
  }
  // Unix seconds to the time left until then.
  if (f === 'until') {
    const s = Math.floor(v - Date.now() / 1000)
    if (s <= 0) return 'now'
    const d = Math.floor(s / 86400)
    const h = Math.floor(s / 3600) % 24
    const m = Math.floor(s / 60) % 60
    return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${Math.max(1, m)}m`
  }
  if (f === 'bytes') {
    if (v < 1024) return Math.round(v) + ' B'
    if (v < 1048576) return (v / 1024).toFixed(1) + ' KB'
    return (v / 1048576).toFixed(1) + ' MB'
  }
  return String(v)
}

// Damped spring toward a target, frequency in Hz, damping 1 = critical.
class Spring {
  constructor (damping = 1, hz = 3) {
    this.v = null
    this.vel = 0
    this.target = null
    this.zeta = damping
    this.w = 2 * Math.PI * hz
  }

  set (t) {
    this.target = t
    if (this.v === null || t === null) { this.v = t; this.vel = 0 }
  }

  // Semi-implicit Euler in substeps of at most 1/240 s, so a slow frame
  // never makes the spring unstable.
  step (dt) {
    if (this.v === null || this.target === null) return this.v
    const total = Math.min(Math.max(dt, 0), 0.1)
    const n = Math.max(1, Math.ceil(total * 240))
    const h = total / n
    for (let i = 0; i < n; i++) {
      const a = this.w * this.w * (this.target - this.v) - 2 * this.zeta * this.w * this.vel
      this.vel += a * h
      this.v += this.vel * h
    }
    return this.v
  }
}

const DEG = Math.PI / 180

function polar (cx, cy, r, deg) {
  return [cx + r * Math.sin(deg * DEG), cy - r * Math.cos(deg * DEG)]
}

function arcPath (cx, cy, r, a0, a1) {
  const [x0, y0] = polar(cx, cy, r, a0)
  const [x1, y1] = polar(cx, cy, r, a1)
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

function base (spec, type) {
  const el = div(`w w-${type}${spec.class ? ' ' + spec.class : ''}`)
  el.dataset.id = spec.id
  const min = spec.min !== undefined ? spec.min : 0
  const max = spec.max !== undefined ? spec.max : 100
  const frac = v => v === null ? 0 : Math.max(0, Math.min(1, (v - min) / (max - min)))
  return { el, min, max, frac }
}

function labelled (el, spec) {
  if (spec.label) div('label', el, spec.label)
}

function valueOf (snap, name) {
  const v = snap[name]
  return v === undefined ? null : v
}

function gauge (spec) {
  const { el, frac } = base(spec, 'gauge')
  const a0 = spec.startAngle !== undefined ? spec.startAngle : -135
  const a1 = spec.endAngle !== undefined ? spec.endAngle : 135
  const th = spec.thickness !== undefined ? spec.thickness : 10
  const r = 50 - th / 2 - 2
  const s = svg('svg', { viewBox: '0 0 100 100', class: 'dial' }, el)
  svg('path', { d: arcPath(50, 50, r, a0, a1), class: 'track', fill: 'none', 'stroke-width': th, pathLength: 100 }, s)
  const fill = svg('path', { d: arcPath(50, 50, r, a0, a1), class: 'fill', fill: 'none', 'stroke-width': th, pathLength: 100, 'stroke-dasharray': '0 100' }, s)
  for (let i = 0; i <= (spec.ticks || 0) && spec.ticks; i++) {
    const a = a0 + (a1 - a0) * i / spec.ticks
    const [x0, y0] = polar(50, 50, r - th / 2 - 1, a)
    const [x1, y1] = polar(50, 50, r - th / 2 - 5, a)
    svg('line', { x1: x0, y1: y0, x2: x1, y2: y1, class: 'tick' }, s)
  }
  const marks = (spec.marks || []).map(m => ({ m, line: svg('line', { class: 'mark' + (m.class ? ' ' + m.class : '') }, s) }))
  const txt = svg('text', { x: 50, y: 56, class: 'value', 'text-anchor': 'middle' }, s)
  labelled(el, spec)
  const sp = new Spring(spec.damping !== undefined ? spec.damping : 1)
  let raw = null
  return {
    el,
    update (snap) {
      raw = valueOf(snap, spec.bind)
      sp.set(typeof raw === 'number' ? raw : null)
      el.classList.toggle('nodata', raw === null)
      for (const { m, line } of marks) {
        const mv = m.bind ? valueOf(snap, m.bind) : m.value
        if (typeof mv !== 'number') { line.setAttribute('visibility', 'hidden'); continue }
        const a = a0 + (a1 - a0) * frac(mv)
        const [x0, y0] = polar(50, 50, r + th / 2 + 1, a)
        const [x1, y1] = polar(50, 50, r - th / 2 - 1, a)
        Object.entries({ x1: x0, y1: y0, x2: x1, y2: y1, visibility: 'visible' }).forEach(([k, v]) => line.setAttribute(k, v))
      }
    },
    frame (now, dt) {
      const v = sp.step(dt)
      fill.setAttribute('stroke-dasharray', `${(frac(v) * 100).toFixed(2)} 100`)
      txt.textContent = format(v === null ? raw : v, spec.format)
    }
  }
}

function needle (spec) {
  const { el, frac } = base(spec, 'needle')
  const a0 = spec.startAngle !== undefined ? spec.startAngle : -60
  const a1 = spec.endAngle !== undefined ? spec.endAngle : 60
  const s = svg('svg', { viewBox: '0 0 100 75', class: 'dial' }, el)
  if (spec.face) svg('image', { href: spec.faceUrl, x: 0, y: 0, width: 100, height: 75, preserveAspectRatio: 'none', class: 'face' }, s)
  else svg('path', { d: arcPath(50, 70, 55, a0, a1), class: 'track', fill: 'none' }, s)
  for (let i = 0; spec.ticks && i <= spec.ticks; i++) {
    const a = a0 + (a1 - a0) * i / spec.ticks
    const [x0, y0] = polar(50, 70, 55, a)
    const [x1, y1] = polar(50, 70, 49, a)
    svg('line', { x1: x0, y1: y0, x2: x1, y2: y1, class: 'tick' }, s)
  }
  const g = svg('g', { class: 'needle-g' }, s)
  svg('line', { x1: 50, y1: 70, x2: 50, y2: 14, class: 'needle' }, g)
  svg('circle', { cx: 50, cy: 70, r: 4, class: 'pivot' }, s)
  labelled(el, spec)
  const val = div('value', el)
  const sp = new Spring(spec.damping !== undefined ? spec.damping : 0.55, 2.5)
  let raw = null
  return {
    el,
    update (snap) {
      raw = valueOf(snap, spec.bind)
      sp.set(typeof raw === 'number' ? raw : null)
      el.classList.toggle('nodata', raw === null)
    },
    frame (now, dt) {
      const v = sp.step(dt)
      const f = v === null ? 0 : (v - (spec.min || 0)) / ((spec.max !== undefined ? spec.max : 100) - (spec.min || 0))
      const a = a0 + (a1 - a0) * Math.max(-0.04, Math.min(1.04, f))
      g.setAttribute('transform', `rotate(${a.toFixed(2)} 50 70)`)
      val.textContent = format(v === null ? raw : v, spec.format)
    }
  }
}

function knob (spec) {
  const { el, frac } = base(spec, 'knob')
  const a0 = spec.startAngle !== undefined ? spec.startAngle : -135
  const a1 = spec.endAngle !== undefined ? spec.endAngle : 135
  const s = svg('svg', { viewBox: '0 0 100 100', class: 'knob-box', preserveAspectRatio: 'xMidYMid meet' }, el)
  const turn = svg('g', {}, s)
  if (spec.image) {
    svg('image', { href: spec.imageUrl, x: 2, y: 2, width: 96, height: 96, class: 'knob-image' }, turn)
  } else {
    svg('circle', { cx: 50, cy: 50, r: 46, class: 'knob-face' }, turn)
    svg('line', { x1: 50, y1: 12, x2: 50, y2: 36, class: 'knob-pointer' }, turn)
  }
  labelled(el, spec)
  const val = div('value', el)
  const sp = new Spring(spec.damping !== undefined ? spec.damping : 0.8)
  let raw = null
  return {
    el,
    update (snap) {
      raw = valueOf(snap, spec.bind)
      sp.set(typeof raw === 'number' ? raw : null)
      el.classList.toggle('nodata', raw === null)
    },
    frame (now, dt) {
      const v = sp.step(dt)
      turn.setAttribute('transform', `rotate(${(a0 + (a1 - a0) * frac(v)).toFixed(2)} 50 50)`)
      val.textContent = format(v === null ? raw : v, spec.format)
    }
  }
}

// A bar's or readout's resets: a metric of Unix seconds, shown as the
// time left, for a usage limit. Its word and its time are spans
// of their own, so a narrow skin can hide the word.
function resetsOf (el, spec) {
  if (!spec.resets && !(spec.fallback && spec.fallback.resets)) return () => {}
  const box = div('resets', el)
  const word = document.createElement('span')
  word.className = 'word'
  word.textContent = 'resets '
  const left = document.createElement('span')
  left.className = 'left'
  box.append(word, left)
  return (snap, name) => {
    const at = name ? valueOf(snap, name) : null
    box.classList.toggle('nodata', at === null)
    left.textContent = at === null ? '--' : format(at, 'until')
  }
}

// A bar's or readout's fallback, { bind, label, resets }: shown in the
// widget's place, its label too, while the widget's own metric is
// absent and the fallback's is present, as a gateway session's spend
// limit in the place of a subscription's limit. Gives the spec
// in force.
function fallbackOf (el, spec) {
  const label = el.querySelector('.label')
  return snap => {
    const f = spec.fallback
    const use = f && valueOf(snap, spec.bind) === null && valueOf(snap, f.bind) !== null
    el.classList.toggle('fallback', !!use)
    if (label) label.textContent = use && f.label ? f.label : spec.label
    return use ? Object.assign({}, spec, f) : spec
  }
}

function bar (spec) {
  const { el, frac } = base(spec, 'bar')
  const vertical = spec.orientation === 'vertical'
  if (vertical) el.classList.add('vertical')
  labelled(el, spec)
  const resets = resetsOf(el, spec)
  const inForce = fallbackOf(el, spec)
  const track = div('track', el)
  const n = spec.segments || 0
  const gap = spec.gap !== undefined ? spec.gap : 2
  let fill = null
  const segs = []
  if (n) {
    track.style.display = 'flex'
    track.style.flexDirection = vertical ? 'column-reverse' : 'row'
    track.style.gap = gap + 'px'
    for (let i = 0; i < n; i++) segs.push(div('seg', track))
  } else {
    fill = div('fill', track)
  }
  const sp = new Spring(spec.damping !== undefined ? spec.damping : 1)
  let raw = null
  return {
    el,
    update (snap) {
      const s = inForce(snap)
      raw = valueOf(snap, s.bind)
      sp.set(typeof raw === 'number' ? raw : null)
      el.classList.toggle('nodata', raw === null)
      resets(snap, s.resets)
    },
    frame (now, dt) {
      const f = frac(sp.step(dt))
      if (fill) fill.style[vertical ? 'height' : 'width'] = (f * 100).toFixed(2) + '%'
      else {
        const lit = Math.round(f * n)
        segs.forEach((s, i) => s.classList.toggle('on', i < lit))
      }
    }
  }
}

function led (spec) {
  const { el } = base(spec, 'led')
  const lamp = div('lamp', el)
  labelled(el, spec)
  let lit = false
  let last = null
  let pulseAt = -1e9
  return {
    el,
    update (snap, now) {
      const v = valueOf(snap, spec.bind)
      el.classList.toggle('nodata', v === null)
      if (spec.pulse) {
        if (typeof v === 'number' && last !== null && v > last) pulseAt = now
        last = typeof v === 'number' ? v : last
      } else {
        lit = typeof v === 'number' && v >= spec.on
      }
    },
    frame (now) {
      let on = spec.pulse ? now - pulseAt < (spec.pulseMs || 250) : lit
      if (on && spec.blink) on = Math.floor(now / spec.blink) % 2 === 0
      lamp.classList.toggle('on', on)
    }
  }
}

// A click on a numeric readout opens or closes its metric's dial on the
// sessions dashboard (decision 0033). mousedown is swallowed so the
// terminal keeps the keyboard.
function clickable (el, name) {
  el.classList.add('click')
  el.addEventListener('mousedown', e => e.preventDefault())
  el.addEventListener('click', () => window.skinned.toggleDial(name))
  return open => el.classList.toggle('open', open.has(name))
}

function readout (spec) {
  const { el } = base(spec, 'readout')
  labelled(el, spec)
  const val = div('value', el)
  const resets = resetsOf(el, spec)
  const inForce = fallbackOf(el, spec)
  const sp = new Spring(spec.damping !== undefined ? spec.damping : 1, 4)
  let raw = null
  const affix = s => (spec.prefix || '') + s + (spec.suffix || '')
  const dials = spec.format === 'text' ? null : clickable(el, spec.bind)
  return {
    el,
    dials,
    update (snap) {
      const s = inForce(snap)
      raw = valueOf(snap, s.bind)
      sp.set(typeof raw === 'number' && spec.format !== 'text' ? raw : null)
      el.classList.toggle('nodata', raw === null)
      resets(snap, s.resets)
    },
    frame (now, dt) {
      const v = sp.step(dt)
      val.textContent = affix(format(v === null ? raw : v, spec.format))
    }
  }
}

function sprite (spec) {
  const { el, frac } = base(spec, 'sprite')
  const img = div('sheet', el)
  const n = spec.frames
  const column = spec.layout === 'column'
  img.style.backgroundImage = `url("${spec.sheetUrl}")`
  img.style.backgroundSize = column ? `100% ${n * 100}%` : `${n * 100}% 100%`
  labelled(el, spec)
  const sp = new Spring(spec.damping !== undefined ? spec.damping : 1)
  let raw = null
  let runFrame = 0
  let runAt = 0
  const show = i => {
    const p = n > 1 ? (i / (n - 1)) * 100 : 0
    img.style.backgroundPosition = column ? `0 ${p}%` : `${p}% 0`
  }
  return {
    el,
    update (snap) {
      raw = valueOf(snap, spec.bind)
      sp.set(typeof raw === 'number' ? raw : null)
      el.classList.toggle('nodata', raw === null)
    },
    frame (now, dt) {
      const v = sp.step(dt)
      if (spec.mode === 'run') {
        if (typeof raw === 'number' && raw > 0 && now - runAt > 1000 / (spec.fps || 12)) {
          runFrame = (runFrame + 1) % n
          runAt = now
        }
        show(runFrame)
      } else {
        show(Math.round(frac(v) * (n - 1)))
      }
    }
  }
}

// The agent's task list (decision 0034): one row per item, a mark and
// the text, in the item's state. nodata while the list is empty or
// absent, which hides the widget.
const MARK = { todo: '[ ]', doing: '[>]', done: '[x]' }

function list (spec) {
  const { el } = base(spec, 'list')
  labelled(el, spec)
  const box = div('items', el)
  let items = []
  let drawn = null
  return {
    el,
    rows: () => items.map(i => ({ text: i.text, state: i.state })),
    update (snap) {
      const v = valueOf(snap, spec.bind)
      items = Array.isArray(v) ? v.slice(0, spec.rows || v.length) : []
      el.classList.toggle('nodata', !items.length)
      const key = JSON.stringify(items)
      if (key === drawn) return
      drawn = key
      box.textContent = ''
      for (const it of items) {
        const row = div('item ' + (MARK[it.state] ? it.state : 'todo'), box)
        div('mark', row, MARK[it.state] || MARK.todo)
        div('text', row, String(it.text))
      }
    },
    frame () {}
  }
}

window.Widgets = { gauge, needle, knob, bar, led, readout, sprite, list, format, Spring }
