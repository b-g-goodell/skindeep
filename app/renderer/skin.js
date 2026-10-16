'use strict'
/* global Widgets, SkinSplits */
// Builds a skin (decisions 0005, 0006): fonts through FontFace, a shadow
// root inside the app-owned containment wrapper, panels and widgets from
// their rects, the terminal's rect, theme and font from the manifest,
// the same for every tab's terminal. Below the skin's minWidth, or below
// its minimum skin area height, the skin is drawn scaled by the smaller of
// the two ratios, and the terminal and the menu button, which live
// outside it, get their rects scaled (decision 0006). Each of the skin's
// splits has a handle on the terminal's edge: a drag moves that edge,
// the elements that follow it and the terminal, which reflows, and the
// size is kept for the skin (decision 0035).

window.SkinView = (function () {
  let widgets = []
  let fonts = []
  let lastSnap = {}
  let terminal = null
  let current = null
  let stageEl = null
  let scale = 1
  // The stage area's size the last layout used, for the live checks.
  let laid = null
  let prefs = {}
  let dials = new Set()
  let listOff = false
  let picked = () => {}
  let dragged = () => {}
  // Every panel and widget as placed: its element, rect and follow.
  let placed = []
  // The splits' handles, and the size a drag holds until main keeps it.
  let handles = []
  let live = {}
  let at = {}
  const GRIP = 8

  function place (el, r, k = 1) {
    for (const key of ['left', 'right', 'top', 'bottom', 'width', 'height']) {
      el.style[key] = r[key] !== undefined ? r[key] * k + 'px' : ''
    }
  }

  // The sizes the user keeps for this skin's splits, a drag's over them.
  const saved = () => Object.assign({}, (prefs.panels || {})[current.name], live)

  // The skin laid out at the area's size divided by k, then drawn at k,
  // its splits at their sizes in that layout.
  function layout () {
    if (!current || !stageEl) return
    const area = document.getElementById('stage')
    const W = area.clientWidth
    const H = area.clientHeight
    const minH = current.window.minHeight - document.getElementById('strip').offsetHeight
    const k = Math.min(1, W / current.window.minWidth, H / minH)
    scale = k
    laid = [W, H]
    Object.assign(stageEl.style, {
      inset: 'auto',
      left: '0',
      top: '0',
      width: W / k + 'px',
      height: H / k + 'px',
      transform: k < 1 ? `scale(${k})` : '',
      transformOrigin: '0 0'
    })
    at = SkinSplits.sizes(current, saved(), W / k, H / k)
    for (const p of placed) place(p.el, SkinSplits.rect(p.rect, p.follow, current, at))
    const t = SkinSplits.terminal(current, at)
    place(document.getElementById('term'), t, k)
    placeMenu(current, k)
    // A handle lies along the terminal's edge, just outside it, the same
    // width at any scale, hidden while the window leaves its split no
    // room to move.
    const x0 = t.left * k
    const x1 = W - t.right * k
    const y0 = t.top * k
    const y1 = H - t.bottom * k
    for (const h of handles) {
      const across = SkinSplits.horizontal(h.split.edge)
      const r = across
        ? { left: h.split.edge === 'left' ? x0 - GRIP : x1, top: y0, width: GRIP, height: y1 - y0 }
        : { left: x0, top: h.split.edge === 'top' ? y0 - GRIP : y1, width: x1 - x0, height: GRIP }
      place(h.el, r)
      const room = SkinSplits.range(current, h.split, W / k, H / k)
      h.el.hidden = room.min >= room.max
    }
  }

  // A drag on a split's handle: the size follows the pointer, in the
  // layout's pixels, within the range the window leaves, and is kept
  // when the button is let go.
  function handle (split) {
    const el = document.createElement('div')
    el.className = 'split-handle ' + (SkinSplits.horizontal(split.edge) ? 'across' : 'along') + ' ' + split.edge
    el.dataset.id = split.id
    const sign = split.edge === 'left' || split.edge === 'top' ? 1 : -1
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      el.setPointerCapture(e.pointerId)
      el.classList.add('dragging')
      const from = SkinSplits.horizontal(split.edge) ? e.clientX : e.clientY
      const start = at[split.id]
      let frame = 0
      const move = ev => {
        const pos = SkinSplits.horizontal(split.edge) ? ev.clientX : ev.clientY
        live[split.id] = start + sign * (pos - from) / scale
        if (!frame) frame = requestAnimationFrame(() => { frame = 0; layout() })
      }
      const up = () => {
        el.removeEventListener('pointermove', move)
        el.removeEventListener('pointerup', up)
        el.removeEventListener('pointercancel', up)
        el.classList.remove('dragging')
        if (frame) cancelAnimationFrame(frame)
        layout()
        const v = Math.round(at[split.id])
        delete live[split.id]
        prefs = Object.assign({}, prefs, { panels: Object.assign({}, prefs.panels, { [current.name]: Object.assign({}, (prefs.panels || {})[current.name], { [split.id]: v }) }) })
        layout()
        dragged(split.id, v)
      }
      el.addEventListener('pointermove', move)
      el.addEventListener('pointerup', up)
      el.addEventListener('pointercancel', up)
    })
    return { el, split }
  }
  new ResizeObserver(layout).observe(document.getElementById('stage'))

  async function loadFonts (skin, base) {
    for (const f of fonts) document.fonts.delete(f)
    fonts = []
    for (const f of skin.fonts || []) {
      const face = new FontFace(f.family, `url("${base}${f.file}")`, { weight: String(f.weight || 'normal'), style: f.style || 'normal' })
      try {
        await face.load()
        document.fonts.add(face)
        fonts.push(face)
      } catch (e) {
        console.error('font', f.family, e)
      }
    }
  }

  // A tab's terminal in the skin's theme and font, at the user's font
  // size where one is set.
  function styleTerminal (term) {
    const t = terminal
    if (!t) return
    term.options.theme = t.theme
    term.options.fontFamily = t.fontFamily ? `"${t.fontFamily}", "DejaVu Sans Mono", monospace` : '"DejaVu Sans Mono", monospace'
    term.options.fontSize = prefs['terminal.fontSize'] || t.fontSize || 14
  }

  // The user's settings, applied to every tab's terminal at once, and
  // the panel sizes kept for the skin.
  function setSettings (s, panes) {
    prefs = s || {}
    layout()
    for (const p of panes()) {
      styleTerminal(p.term)
      p.fit.fit()
    }
  }

  // panes: a function giving the tabs' current { term, fit }.
  async function apply (skin, panes) {
    const base = skin.base
    await loadFonts(skin, base)
    const wrap = document.getElementById('skin-wrap')
    wrap.textContent = ''
    const host = document.createElement('div')
    host.id = 'skin-host'
    wrap.appendChild(host)
    const root = host.attachShadow({ mode: 'closed' })
    const appCss = document.createElement('link')
    appCss.rel = 'stylesheet'
    appCss.href = 'widgets.css'
    root.appendChild(appCss)
    if (skin.stylesheet) {
      const css = document.createElement('link')
      css.rel = 'stylesheet'
      css.href = base + skin.stylesheet
      root.appendChild(css)
    }
    const stage = document.createElement('div')
    stage.className = 'skin'
    root.appendChild(stage)
    placed = []
    for (const p of skin.panels || []) {
      const el = document.createElement('div')
      el.className = 'panel ' + p.class
      place(el, p.rect)
      stage.appendChild(el)
      placed.push({ el, rect: p.rect, follow: p.follow })
    }
    widgets = []
    for (const spec of skin.widgets || []) {
      const s = Object.assign({}, spec)
      if (s.face) s.faceUrl = base + s.face
      if (s.image) s.imageUrl = base + s.image
      if (s.sheet) s.sheetUrl = base + s.sheet
      s.pick = off => picked(off)
      const w = Widgets[s.type](s)
      w.spec = s
      place(w.el, s.rect)
      stage.appendChild(w.el)
      widgets.push(w)
      placed.push({ el: w.el, rect: s.rect, follow: s.follow })
      if (w.toggle) {
        place(w.toggle.el, w.toggle.rect)
        stage.appendChild(w.toggle.el)
        placed.push({ el: w.toggle.el, rect: w.toggle.rect, follow: spec.toggle.follow })
      }
    }
    for (const h of handles) h.el.remove()
    live = {}
    handles = (skin.splits || []).map(handle)
    for (const h of handles) document.getElementById('stage').appendChild(h.el)
    setDials(dials)
    terminal = skin.terminal
    current = skin
    stageEl = stage
    layout()
    document.getElementById('term').style.background = terminal.theme.background
    for (const p of panes()) {
      styleTerminal(p.term)
      p.fit.fit()
    }
    update(lastSnap)
  }

  // The menu button (decision 0022): app-owned, above the skin and out of
  // reach of its CSS, drawn with the skin's images.
  function placeMenu (skin, k) {
    const el = document.getElementById('menu-button')
    const m = skin.menu
    const url = f => `url("${skin.base}${f}")`
    place(el, m.rect, k)
    el.style.setProperty('--img', url(m.image))
    el.style.setProperty('--img-hover', url(m.hover || m.image))
    el.style.setProperty('--img-pressed', url(m.pressed || m.image))
    el.classList.toggle('own-hover', !!m.hover)
    el.classList.toggle('own-pressed', !!m.pressed)
    el.hidden = false
  }

  // The stage carries `checklist` while the agent's task list has
  // items and shows (decision 0034), so a skin can hide what the list
  // replaces, and `checklist-off` while it has items and the tab shows
  // what it replaces. Only a skin whose list has a toggle hides it.
  function update (snap) {
    lastSnap = snap
    const now = performance.now()
    for (const w of widgets) w.update(snap, now)
    mark()
  }

  function mark () {
    if (!stageEl) return
    const items = lastSnap['checklist.items']
    const has = Array.isArray(items) && items.length > 0
    const off = listOff && widgets.some(w => w.toggle)
    stageEl.classList.toggle('checklist', has && !off)
    stageEl.classList.toggle('checklist-off', has && off)
    for (const w of widgets) if (w.toggle) w.toggle.show(off)
  }

  // The active tab's choice, from main, and the callback a click on a
  // toggle's option calls with the choice.
  function setListOff (off) {
    listOff = !!off
    mark()
  }
  function onPick (fn) { picked = fn }
  // The callback a drag calls with the split's id and its size.
  function onDrag (fn) { dragged = fn }

  // The splits as laid out, for the live checks and the menu: each
  // one's size, its range in this layout and its handle's box.
  function splits () {
    if (!current) return []
    const area = document.getElementById('stage')
    return handles.map(h => {
      const r = SkinSplits.range(current, h.split, area.clientWidth / scale, area.clientHeight / scale)
      const b = h.el.getBoundingClientRect()
      return { id: h.split.id, edge: h.split.edge, size: at[h.split.id], min: r.min, max: r.max, def: r.def, shown: !h.el.hidden, cursor: getComputedStyle(h.el).cursor, box: { x: b.x, y: b.y, width: b.width, height: b.height } }
    })
  }

  // The panels as drawn, for the live checks.
  function panelBoxes () {
    return placed.filter(p => p.el.classList.contains('panel')).map(p => {
      const b = p.el.getBoundingClientRect()
      return { class: p.el.className, box: { x: b.x, y: b.y, width: b.width, height: b.height } }
    })
  }

  // The dials open on the sessions dashboard (decision 0033), marked on
  // the widgets that open them.
  function setDials (names) {
    dials = new Set(names)
    for (const w of widgets) if (w.dials) w.dials(dials)
  }

  // The widgets as drawn, for the live checks: the skin's shadow root
  // is closed, so a check reads and clicks them through this.
  function state () {
    return widgets.map(w => {
      const b = w.el.getBoundingClientRect()
      return {
        id: w.spec.id,
        type: w.spec.type,
        bind: w.spec.bind,
        classes: [...w.el.classList],
        cursor: getComputedStyle(w.el).cursor,
        visible: getComputedStyle(w.el).visibility === 'visible' && getComputedStyle(w.el).display !== 'none',
        box: { x: b.x, y: b.y, width: b.width, height: b.height },
        rows: w.rows ? w.rows() : undefined
      }
    }).concat(widgets.filter(w => w.toggle).map(w => {
      const el = w.toggle.el
      return {
        id: el.dataset.id,
        type: 'toggle',
        classes: [...el.classList],
        cursor: getComputedStyle(el).cursor,
        visible: getComputedStyle(el).visibility === 'visible' && getComputedStyle(el).display !== 'none',
        box: (b => ({ x: b.x, y: b.y, width: b.width, height: b.height }))(el.getBoundingClientRect()),
        options: w.toggle.options()
      }
    }))
  }

  let prev = performance.now()
  function loop (now) {
    const dt = (now - prev) / 1000
    prev = now
    for (const w of widgets) w.frame(now, dt)
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)

  return { apply, update, setDials, setListOff, onPick, onDrag, splits, panels: panelBoxes, state, stageClasses: () => stageEl ? [...stageEl.classList] : [], styleTerminal, setSettings, terminalTheme: () => terminal && terminal.theme, scale: () => scale, laid: () => laid }
})()
