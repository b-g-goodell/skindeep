'use strict'
// Below its minWidth or its minimum skin area height a skin is drawn
// scaled by the smaller of width / minWidth and height / (minHeight -
// STRIP), the terminal excepted, which keeps its font and gets the
// scaled rect (decision 0006). The window's minimum width is where that
// scaled terminal still holds 40 columns of the skin's own font, its
// minimum height where it still holds 10 rows, and neither falls below
// half the skin's own.

const MIN_SCALE = 0.5
const COLS = 40
const ROWS = 10
const CELL = 0.6
const LINE = 1.2
// The identity strip, #strip in app/renderer/app.css.
const STRIP = 22

function floorWidth (skin) {
  const w = skin.window
  const t = skin.terminal || {}
  const r = t.rect || {}
  const fs = t.fontSize || 14
  const share = (w.minWidth - (r.left || 0) - (r.right || 0)) / w.minWidth
  const forCols = share > 0 ? Math.ceil(COLS * fs * CELL / share) : w.minWidth
  return Math.min(w.minWidth, Math.max(Math.ceil(w.minWidth * MIN_SCALE), forCols))
}

// The minimum content height of a window of one tab: the identity strip
// and the floor of the skin area.
function floorHeight (skin) {
  const t = skin.terminal || {}
  const r = t.rect || {}
  const fs = t.fontSize || 14
  const area = skin.window.minHeight - STRIP
  const share = (area - (r.top || 0) - (r.bottom || 0)) / area
  const forRows = share > 0 ? Math.ceil(ROWS * fs * LINE / share) : area
  return STRIP + Math.min(area, Math.max(Math.ceil(area * MIN_SCALE), forRows))
}

module.exports = { floorWidth, floorHeight, MIN_SCALE, STRIP }
