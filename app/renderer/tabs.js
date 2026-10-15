'use strict'
// The tab strip (decision 0023): app DOM between the identity strip and
// the stage, out of reach of skin CSS, shown from the second tab on. A
// press picks a tab, a drag moves it, a middle click or its close button
// closes it, + opens a new tab. A tab in the background marks work in
// progress and output not yet seen. The tab chords are keys that send
// the CLI nothing: Ctrl+Shift+T, Ctrl+Shift+W, Ctrl+Tab, Ctrl+Shift+Tab.

window.TabStrip = (function () {
  const api = window.skinned
  const strip = document.getElementById('tabs')
  const TIMES = String.fromCharCode(0xd7)
  let state = { active: null, tabs: [] }
  let drag = null

  function span (cls, text) {
    const el = document.createElement('span')
    el.className = cls
    el.textContent = text
    return el
  }

  // Held while a tab is dragged, drawn when the drag ends.
  function render (s) {
    state = s
    if (drag) return
    const shown = s.tabs.length > 1
    document.body.classList.toggle('tabbed', shown)
    strip.hidden = !shown
    strip.textContent = ''
    for (const t of s.tabs) {
      const back = t.id !== s.active
      const el = document.createElement('div')
      el.className = 'tab' + (back ? '' : ' active') + (back && t.busy ? ' busy' : '') + (back && t.unseen ? ' unseen' : '')
      el.dataset.id = t.id
      el.append(span('mark', ''), span('label', t.label))
      if (t.folder) el.append(span('folder', t.folder))
      el.append(span('close', TIMES))
      strip.appendChild(el)
    }
    strip.appendChild(span('new', '+'))
  }

  // mousedown, not click: the terminal keeps the focus.
  strip.addEventListener('mousedown', e => {
    e.preventDefault()
    if (e.target.closest('.new')) {
      if (e.button === 0) api.newTab()
      return
    }
    const el = e.target.closest('.tab')
    if (!el) return
    const id = Number(el.dataset.id)
    if (e.button === 1 || (e.button === 0 && e.target.closest('.close'))) return api.closeTab(id)
    if (e.button !== 0) return
    api.activateTab(id)
    drag = { id, el, x: e.clientX, moved: false }
  })

  // A dragged tab goes before the first other tab whose middle lies right
  // of the pointer.
  window.addEventListener('mousemove', e => {
    if (!drag || (!drag.moved && Math.abs(e.clientX - drag.x) < 5)) return
    drag.moved = true
    drag.el.classList.add('dragging')
    const others = [...strip.querySelectorAll('.tab')].filter(t => t !== drag.el)
    const before = others.find(t => {
      const r = t.getBoundingClientRect()
      return e.clientX < r.left + r.width / 2
    })
    strip.insertBefore(drag.el, before || strip.querySelector('.new'))
  })

  window.addEventListener('mouseup', () => {
    if (!drag) return
    const d = drag
    drag = null
    if (d.moved) api.moveTab(d.id, [...strip.querySelectorAll('.tab')].indexOf(d.el))
    render(state)
  })

  // After the menu's own handler: an open menu takes every key first, and
  // an open New tab... dialog leaves the chords to its fields.
  window.addEventListener('keydown', e => {
    if (e.defaultPrevented || !e.ctrlKey || e.altKey || e.metaKey || document.body.classList.contains('modal')) return
    let act = null
    if (e.shiftKey && e.code === 'KeyT') act = () => api.newTab()
    else if (e.shiftKey && e.code === 'KeyW') act = () => api.closeTab(null)
    else if (e.code === 'Tab') act = () => api.stepTab(e.shiftKey ? -1 : 1)
    if (!act) return
    e.preventDefault()
    e.stopPropagation()
    if (!e.repeat || e.code === 'Tab') act()
  }, true)

  return { render }
})()
