'use strict'
// The visualization's modes (decision 0015), in the order click and space
// cycle them and the menu lists them: the id the menu and the record
// use, the name the menu shows, and what draws it. milk: a butterchurn
// preset of presets.js. canvas: a Canvas2D renderer that scope.js,
// classic.js or avs.js registers under the id. Loaded by the main
// process and by the viz page.

;(function (root) {
  const MODES = [
    { id: 'drift', label: 'Drift', kind: 'milk' },
    { id: 'rings', label: 'Rings', kind: 'milk' },
    { id: 'plasma', label: 'Plasma', kind: 'milk' },
    { id: 'stardust', label: 'Star dust', kind: 'milk' },
    { id: 'whirlpool', label: 'Whirlpool', kind: 'milk' },
    { id: 'scope', label: 'Scope', kind: 'canvas' },
    { id: 'analyzer', label: 'Spectrum analyzer', kind: 'canvas' },
    { id: 'fire', label: 'Fire analyzer', kind: 'canvas' },
    { id: 'superscope', label: 'Superscope', kind: 'canvas' },
    { id: 'dotplane', label: 'Dot plane', kind: 'canvas' }
  ]
  if (typeof module === 'object' && module.exports) module.exports = { MODES }
  else root.VizModes = MODES
})(this)
