'use strict'

const meet = (a, b) => Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 0.5 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 0.5

// Inspect rendered ink, independently of the text fitter's verdict.
function layout (page) {
  const texts = page.texts.filter(t => t.part !== 'words')
  const findings = []
  for (let i = 0; i < texts.length; i++) {
    const a = texts[i]
    if (meet(a.box, page.term)) findings.push(`${a.owner}: text meets terminal`)
    for (let j = i + 1; j < texts.length; j++) {
      const b = texts[j]
      if (a.holder !== b.holder && meet(a.box, b.box)) findings.push(`${a.owner} / ${b.owner}: text overlaps`)
    }
  }
  return findings
}

module.exports = { layout }
