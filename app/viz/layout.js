'use strict'
// The panes of the visualization window (decision 0015): one per tab, in
// a grid of equal panes whose column count gives each pane the longest
// shorter side. Loaded by the viz page, which lays the panes out and
// maps the pointer to its pane. In CSS pixels.

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

  const api = { grid, rect, at }
  if (typeof module === 'object' && module.exports) module.exports = api
  else root.VizLayout = api
})(this)
