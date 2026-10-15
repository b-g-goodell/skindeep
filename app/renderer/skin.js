'use strict'
/* global Widgets */
// Builds a skin (decisions 0005, 0006): fonts through FontFace, a shadow
// root inside the app-owned containment wrapper, panels and widgets from
// their rects, the terminal's rect, theme and font from the manifest,
// the same for every tab's terminal. Below the skin's minWidth the skin
// is drawn scaled by width / minWidth, and the terminal and the menu
// button, which live outside it, get their rects scaled (decision 0006).

window.SkinView = (function () {
  let widgets = []
  let fonts = []
  let lastSnap = {}
  let terminal = null
  let current = null
  let stageEl = null
  let scale = 1
  let prefs = {}

  function place (el, r, k = 1) {
    for (const key of ['left', 'right', 'top', 'bottom', 'width', 'height']) {
      el.style[key] = r[key] !== undefined ? r[key] * k + 'px' : ''
    }
  }

  // The skin laid out at the area's size divided by k, then drawn at k.
  function layout () {
    if (!current || !stageEl) return
    const area = document.getElementById('stage')
    const W = area.clientWidth
    const H = area.clientHeight
    const k = Math.min(1, W / current.window.minWidth)
    scale = k
    Object.assign(stageEl.style, {
      inset: 'auto',
      left: '0',
      top: '0',
      width: W / k + 'px',
      height: H / k + 'px',
      transform: k < 1 ? `scale(${k})` : '',
      transformOrigin: '0 0'
    })
    place(document.getElementById('term'), current.terminal.rect, k)
    placeMenu(current, k)
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

  // The user's settings, applied to every tab's terminal at once.
  function setSettings (s, panes) {
    prefs = s || {}
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
    for (const p of skin.panels || []) {
      const el = document.createElement('div')
      el.className = 'panel ' + p.class
      place(el, p.rect)
      stage.appendChild(el)
    }
    widgets = []
    for (const spec of skin.widgets || []) {
      const s = Object.assign({}, spec)
      if (s.face) s.faceUrl = base + s.face
      if (s.image) s.imageUrl = base + s.image
      if (s.sheet) s.sheetUrl = base + s.sheet
      const w = Widgets[s.type](s)
      place(w.el, s.rect)
      stage.appendChild(w.el)
      widgets.push(w)
    }
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

  function update (snap) {
    lastSnap = snap
    const now = performance.now()
    for (const w of widgets) w.update(snap, now)
  }

  let prev = performance.now()
  function loop (now) {
    const dt = (now - prev) / 1000
    prev = now
    for (const w of widgets) w.frame(now, dt)
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)

  return { apply, update, styleTerminal, setSettings, terminalTheme: () => terminal && terminal.theme, scale: () => scale }
})()
