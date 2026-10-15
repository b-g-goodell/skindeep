'use strict'
// Below its minWidth a skin is drawn scaled by width / minWidth, the
// terminal excepted, which keeps its font and gets the scaled rect
// (decision 0006). The window's minimum width is where that scaled
// terminal still holds 40 columns of the skin's own font, and never
// below half the skin's minWidth.

const MIN_SCALE = 0.5
const COLS = 40
const CELL = 0.6

function floorWidth (skin) {
  const w = skin.window
  const t = skin.terminal || {}
  const r = t.rect || {}
  const fs = t.fontSize || 14
  const share = (w.minWidth - (r.left || 0) - (r.right || 0)) / w.minWidth
  const forCols = share > 0 ? Math.ceil(COLS * fs * CELL / share) : w.minWidth
  return Math.min(w.minWidth, Math.max(Math.ceil(w.minWidth * MIN_SCALE), forCols))
}

module.exports = { floorWidth, MIN_SCALE }
