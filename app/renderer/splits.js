'use strict'
// A skin's draggable boundaries (decision 0035). A split is one edge of
// the terminal: its size is the terminal rect's offset on that edge, the
// manifest's value by default, the user's within the split's min and
// max. An element's follow names, for a rect key, the split whose change
// from its default that key takes, so the element moves or stretches
// with the boundary. A split grows past its default only by as much as
// the skin area is no shorter, on the split's axis, than the skin's
// initial size less the room it grows into: below the initial size the
// growth gives way pixel for pixel, so a layout the validator checked at
// the initial window with every split at its max holds at every size.
// Loaded by the validator and by the skin's page, which serves app/renderer.

;(function (root) {
  // The identity strip, as in scale.js.
  const STRIP = 22
  const EDGES = ['left', 'right', 'top', 'bottom']
  const SIZE = { left: 'width', right: 'width', top: 'height', bottom: 'height' }
  const horizontal = edge => edge === 'left' || edge === 'right'

  // The keys a split may move: its own edge, or the size of a rect
  // anchored at that edge, which then grows or shrinks toward the
  // terminal.
  function movable (edge, key, rect) {
    if (key === edge) return edge in rect
    return key === SIZE[edge] && edge in rect && key in rect
  }

  // The range a split's size can take in a skin area laid out at W x H:
  // its min, and its max less the growth the area cannot hold.
  function range (skin, s, W, H) {
    const def = skin.terminal.rect[s.edge]
    const short = horizontal(s.edge) ? skin.window.width - W : skin.window.height - STRIP - H
    return { min: s.min, max: Math.max(def, Math.min(s.max, s.max - short)), def }
  }

  // Each split's size in that area, from the user's saved sizes by id.
  function sizes (skin, saved, W, H) {
    const out = {}
    for (const s of skin.splits || []) {
      const r = range(skin, s, W, H)
      const v = saved && typeof saved[s.id] === 'number' && isFinite(saved[s.id]) ? saved[s.id] : r.def
      out[s.id] = Math.min(r.max, Math.max(r.min, v))
    }
    return out
  }

  // A rect with each followed key moved by its split's change.
  function rect (r, follow, skin, at) {
    if (!follow) return r
    const out = Object.assign({}, r)
    for (const [key, id] of Object.entries(follow)) {
      const s = (skin.splits || []).find(x => x.id === id)
      if (s && key in out && id in at) out[key] += at[id] - skin.terminal.rect[s.edge]
    }
    return out
  }

  // The terminal's rect at those sizes.
  function terminal (skin, at) {
    const out = Object.assign({}, skin.terminal.rect)
    for (const s of skin.splits || []) if (s.id in at) out[s.edge] = at[s.id]
    return out
  }

  const api = { STRIP, EDGES, SIZE, horizontal, movable, sizes, range, rect, terminal }
  if (typeof module === 'object' && module.exports) module.exports = api
  else root.SkinSplits = api
})(this)
