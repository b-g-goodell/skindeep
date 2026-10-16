'use strict'
// The skin's text at the user's skin text size (decision 0036). The
// skin's stylesheet and widgets.css size text in calc(N px *
// var(--text-scale)), and the stage carries the factor. A larger text
// grows as far as its widget's or panel's rect holds it, and no
// further: each of the stage's children, a holder, gets the largest
// factor up to the user's at which its texts stay inside its rect, as
// far outside it as they were at the skin's own size, and overlap no
// text of the holder they did not overlap at that size, its CSS-drawn
// words inside the holder's box as far as at its own size, and cut no
// text that was whole, save a list's rows, which its rect cuts as it
// always has. A smaller text always fits, so below 100 percent no
// holder is fitted. Nothing is wrapped or moved.

window.TextFit = (function () {
  const PARTS = ['option', 'item', 'resets', 'value', 'label']
  const STEPS = 5
  const EPS = 0.5

  // The part of a widget a text belongs to, from its nearest classed
  // ancestor among PARTS, or 'text'.
  function partOf (el, h) {
    for (let a = el; a && a !== h.parentElement; a = a.parentElement) {
      const c = a.classList
      if (!c) continue
      const p = PARTS.find(x => c.contains(x))
      if (p) return p
    }
    return 'text'
  }

  // Whether el or an ancestor up to h is animated, as deck's marquee
  // is: what a clip cuts of it changes from frame to frame.
  function moving (el, h) {
    for (let a = el; a && a !== h.parentElement; a = a.parentElement) if (getComputedStyle(a).animationName !== 'none') return true
    return false
  }

  // Each element of holder h that holds a text node: the ink box of its
  // own text nodes, cut by every ancestor that clips, up to h's
  // parent, in client pixels: whether the cut took any of its width,
  // and the share of its height it left. Hidden texts are left out,
  // and, unless all, texts cut away whole.
  function texts (h, all) {
    const out = []
    const by = new Map()
    const walk = document.createTreeWalker(h, NodeFilter.SHOW_TEXT)
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      if (!n.data.trim()) continue
      const el = n.parentElement
      const r = document.createRange()
      r.selectNodeContents(n)
      const b = r.getBoundingClientRect()
      if (!b.width && !b.height) continue
      const t = by.get(el)
      if (t) {
        t.box = { x0: Math.min(t.box.x0, b.left), y0: Math.min(t.box.y0, b.top), x1: Math.max(t.box.x1, b.right), y1: Math.max(t.box.y1, b.bottom) }
        continue
      }
      const cs = getComputedStyle(el)
      if (cs.visibility !== 'visible') continue
      const item = { el, part: partOf(el, h), limit: !!el.closest('.limit-item'), row: !!el.closest('.w-list .items'), moving: moving(el, h), text: el.textContent.trim().slice(0, 40), fontSize: parseFloat(cs.fontSize), box: { x0: b.left, y0: b.top, x1: b.right, y1: b.bottom } }
      by.set(el, item)
      out.push(item)
    }
    for (const t of out) {
      const ink = Object.assign({}, t.box)
      for (let a = t.el; a && a !== h.parentElement; a = a.parentElement) {
        const c = getComputedStyle(a)
        if (c.overflowX === 'visible' && c.overflowY === 'visible') continue
        const r = a.getBoundingClientRect()
        if (c.overflowX !== 'visible') t.box = Object.assign(t.box, { x0: Math.max(t.box.x0, r.left), x1: Math.min(t.box.x1, r.right) })
        if (c.overflowY !== 'visible') t.box = Object.assign(t.box, { y0: Math.max(t.box.y0, r.top), y1: Math.min(t.box.y1, r.bottom) })
      }
      t.shown = t.box.x1 - t.box.x0 >= EPS && t.box.y1 - t.box.y0 >= EPS
      t.cutX = !t.shown || ink.x1 - ink.x0 - (t.box.x1 - t.box.x0) > EPS
      t.shownY = t.shown ? Math.min(1, (t.box.y1 - t.box.y0) / Math.max(EPS, ink.y1 - ink.y0)) : 0
      t.cut = t.cutX || t.shownY < 1 - 0.02
    }
    return all ? out : out.filter(t => t.shown)
  }

  // The words h or its elements draw from CSS content, as their
  // elements and font sizes: no box of their ink can be read.
  function words (h) {
    const out = []
    for (const el of [h, ...h.querySelectorAll('*')]) {
      for (const pseudo of ['::before', '::after']) {
        const c = getComputedStyle(el, pseudo)
        if (c.display === 'none' || !/^["']/.test(c.content)) continue
        const w = c.content.slice(1, -1).trim()
        if (/[A-Za-z]/.test(w)) out.push({ el, pseudo, text: w.slice(0, 40), fontSize: parseFloat(c.fontSize) })
      }
    }
    return out
  }

  const overlap = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > EPS && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > EPS

  // The pairs of shown texts that overlap, by index, an element and one
  // inside it excepted.
  function pairs (list) {
    const out = new Set()
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]
        const b = list[j]
        if (!a.shown || !b.shown || a.el.contains(b.el) || b.el.contains(a.el)) continue
        if (overlap(a.box, b.box)) out.add(i + ':' + j)
      }
    }
    return out
  }

  // h as it is drawn now: its box, its texts, its scroll extent.
  function look (h) {
    const r = h.getBoundingClientRect()
    return { r, list: texts(h, true), sw: h.scrollWidth, sh: h.scrollHeight }
  }

  // Whether h, drawn now as v, holds its texts as it did at the skin's
  // own size, base: each shown text inside the room of the holder's
  // rect and its texts at that size, no new overlap, no text cut that
  // was whole, nor more of its height cut, save a list's rows, which
  // its rect cuts, and a moving text, and the words
  // its CSS draws, if drawn, no further out.
  function holds (base, v, drawn) {
    if (v.list.length !== base.list.length) return false
    const shown = base.list.filter(t => t.shown)
    const room = {
      x0: Math.min(base.r.left, ...shown.map(t => t.box.x0)) - EPS,
      y0: Math.min(base.r.top, ...shown.map(t => t.box.y0)) - EPS,
      x1: Math.max(base.r.right, ...shown.map(t => t.box.x1)) + EPS,
      y1: Math.max(base.r.bottom, ...shown.map(t => t.box.y1)) + EPS
    }
    for (const [i, t] of v.list.entries()) {
      const b = base.list[i]
      if (!t.row && !t.moving && ((t.cutX && !b.cutX) || t.shownY < b.shownY - 0.02)) return false
      if (t.shown && (t.box.x0 < room.x0 || t.box.y0 < room.y0 || t.box.x1 > room.x1 || t.box.y1 > room.y1)) return false
    }
    for (const p of pairs(v.list)) if (!base.pairs.has(p)) return false
    if (drawn && (v.sw > base.sw + 1 || v.sh > base.sh + 1)) return false
    return true
  }

  const set = (h, f) => h.style.setProperty('--text-scale', String(f))

  // Fits each holder of hs at factor s: the largest factor up to s at
  // which it holds its texts, found by halving the interval from 1, all
  // holders at once, one layout a step.
  function fit (hs, s) {
    for (const h of hs) h.style.removeProperty('--text-scale')
    if (!(s > 1) || !hs.length) return
    const jobs = hs.map(h => ({ h, lo: 1, hi: s, drawn: words(h).length > 0 }))
    for (const j of jobs) set(j.h, 1)
    for (const j of jobs) {
      j.base = look(j.h)
      j.base.pairs = pairs(j.base.list)
    }
    for (const j of jobs) set(j.h, s)
    let open = jobs.filter(j => !holds(j.base, look(j.h), j.drawn))
    for (const j of jobs) if (!open.includes(j)) j.lo = s
    for (let k = 0; k < STEPS && open.length; k++) {
      for (const j of open) set(j.h, (j.lo + j.hi) / 2)
      for (const j of open) {
        const m = (j.lo + j.hi) / 2
        if (holds(j.base, look(j.h), j.drawn)) j.lo = m
        else j.hi = m
      }
    }
    for (const j of jobs) {
      if (j.lo >= s) j.h.style.removeProperty('--text-scale')
      else set(j.h, j.lo)
    }
  }

  return { texts, words, fit }
})()
