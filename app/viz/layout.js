'use strict'
// The panes of the visualization window (decision 0015): one per tab, in
// a grid of equal panes whose column count gives each pane the longest
// shorter side, and each pane's mode drop-down. Loaded by the viz page,
// which lays the panes out and maps the pointer to its pane, and by the
// main process, which reads the drop-downs' presses. In CSS pixels.

;(function (root) {
  function grid (n, w, h) {
    let best = { cols: 1, rows: Math.max(1, n) }
    let side = -1
    for (let cols = 1; cols <= Math.max(1, n); cols++) {
      const rows = Math.ceil(n / cols)
      const s = Math.min(w / cols, h / rows)
      if (s > side) {
        side = s
        best = { cols, rows }
      }
    }
    return best
  }

  // Pane i of n, in whole pixels: the panes tile the window.
  function rect (i, n, w, h) {
    const { cols, rows } = grid(n, w, h)
    const c = i % cols
    const r = Math.floor(i / cols)
    const x = Math.round(c * w / cols)
    const y = Math.round(r * h / rows)
    return { x, y, w: Math.round((c + 1) * w / cols) - x, h: Math.round((r + 1) * h / rows) - y }
  }

  // The pane at (x, y), or -1 for none.
  function at (x, y, n, w, h) {
    for (let i = 0; i < n; i++) {
      const p = rect(i, n, w, h)
      if (x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h) return i
    }
    return -1
  }

  // Each pane's mode drop-down, in CSS pixels: a button at the pane's top
  // left, and, while it is open, a row per mode below the button in as
  // many columns as the window's height needs, over the other panes.
  // The main process reads the presses with it, the page draws with it,
  // so neither measures text.
  const PAD = 4
  const BUTTON = { w: 150, h: 20 }
  const ROW = 18
  const ITEM = 160

  // The drop-down of the pane at r, for m modes, in a w by h window.
  function menu (r, m, w, h) {
    const button = { x: r.x + PAD, y: r.y + PAD, w: Math.max(0, Math.min(BUTTON.w, r.w - 2 * PAD)), h: BUTTON.h }
    const top = button.y + button.h + 2
    const rows = Math.max(1, Math.min(m, Math.floor((h - PAD - top) / ROW)))
    const cols = Math.ceil(m / rows)
    const iw = Math.max(1, Math.min(ITEM, Math.floor((w - 2 * PAD) / cols)))
    const left = Math.max(PAD, Math.min(button.x, w - PAD - cols * iw))
    const items = []
    for (let i = 0; i < m; i++) items.push({ x: left + Math.floor(i / rows) * iw, y: top + (i % rows) * ROW, w: iw, h: ROW })
    return { button, items }
  }

  const inside = (b, x, y) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h

  // What a press at (x, y) hits, of n panes in a w by h window, each
  // with m modes, pane open's drop-down open, -1 for none: { pane, item }
  // for a row of the open drop-down, { pane, button: true } for a pane's
  // button, else null.
  function press (x, y, n, m, w, h, open) {
    if (open >= 0 && open < n) {
      const item = menu(rect(open, n, w, h), m, w, h).items.findIndex(b => inside(b, x, y))
      if (item >= 0) return { pane: open, item }
    }
    const i = at(x, y, n, w, h)
    if (i >= 0 && inside(menu(rect(i, n, w, h), m, w, h).button, x, y)) return { pane: i, button: true }
    return null
  }

  const api = { grid, rect, at, menu, press }
  if (typeof module === 'object' && module.exports) module.exports = api
  else root.VizLayout = api
})(this)
