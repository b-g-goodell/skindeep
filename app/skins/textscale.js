'use strict'
// A skin's text follows the user's skin text size (decision 0036). The
// stylesheet is served with every px length of a font size or a line
// height, in font-size, line-height or the font shorthand, multiplied by
// var(--text-scale), which the app sets on the skin's stage. Nothing
// else in the stylesheet changes: widths, offsets, letter spacing and
// art keep the skin's pixels. A font size in em or % follows the size it
// is relative to. One in another unit (pt, rem, vh...) or an absolute
// keyword would escape the scale, so the validator refuses it.

const VAR = '--text-scale'
// A declaration of a font size or a line height, its value up to the
// end of the declaration.
const DECL = /(^|[;{\s])(font-size|line-height|font)(\s*:\s*)([^;{}]*)/gi
const PX = /(^|[^\w.#-])(\d*\.?\d+)px\b/gi
const QUOTED = /("[^"]*"|'[^']*')/
const UNIT = /(^|[^\w.#-])(\d*\.?\d+)([a-z]+)\b/gi
const KEYWORDS = /^(xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large)$/i
const OK_UNITS = ['px', 'em', '%']

// The value with each px length, outside quoted family names, scaled.
function scaleValue (v) {
  return v.split(QUOTED).map((part, i) => i % 2 ? part : part.replace(PX, (m, pre, n) => `${pre}calc(${n}px * var(${VAR}, 1))`)).join('')
}

// The stylesheet as served: comments kept, every font size and line
// height in px scaled.
function rewrite (css) {
  return css.replace(DECL, (m, pre, prop, colon, value) => pre + prop + colon + scaleValue(value))
}

// The places a font size or line height escapes the scale: { index,
// what }, index into css, what the unit or keyword found. Comments are
// the caller's to blank.
function strays (css) {
  const out = []
  for (const m of css.matchAll(DECL)) {
    const at = m.index + m[1].length
    const value = m[4]
    const bare = value.split(QUOTED).filter((p, i) => i % 2 === 0).join(' ')
    for (const u of bare.matchAll(UNIT)) {
      if (!OK_UNITS.includes(u[3].toLowerCase())) out.push({ index: at, what: u[3] })
    }
    if (m[2].toLowerCase() === 'font-size' && KEYWORDS.test(value.trim().replace(/\s*!important$/i, ''))) out.push({ index: at, what: value.trim() })
  }
  return out
}

module.exports = { rewrite, strays, VAR }
