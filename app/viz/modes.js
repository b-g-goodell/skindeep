'use strict'
// The visualization's modes (decision 0015), in the order the space bar
// cycles them and the menu lists them: the id the menu and the record
// use, the name the menu shows, and what draws it. milk: a butterchurn
// preset of presets.js. canvas: a Canvas2D renderer that scope.js,
// classic.js, avs.js or the procedural mode's own file (fern.js, go.js,
// zoom.js, gravity.js, gravity3d.js, quantum.js, carbon.js,
// savannah.js) registers under the id.
// Loaded by the main process and by the viz page.

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
    { id: 'dotplane', label: 'Dot plane', kind: 'canvas' },
    { id: 'fern', label: 'Fern', kind: 'canvas' },
    { id: 'go', label: 'Go', kind: 'canvas' },
    { id: 'zoom', label: 'Zoom out', kind: 'canvas' },
    { id: 'gravity', label: 'Gravity', kind: 'canvas' },
    { id: 'gravity3d', label: 'Gravity 3D', kind: 'canvas' },
    { id: 'quantum', label: 'Quantum', kind: 'canvas' },
    { id: 'carbon', label: 'Carbon', kind: 'canvas' },
    { id: 'savannah', label: 'Savannah hunt', kind: 'canvas' }
  ]
  if (typeof module === 'object' && module.exports) module.exports = { MODES }
  else root.VizModes = MODES
})(this)
