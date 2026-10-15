'use strict'
// The File menu (decisions 0008, 0022 to 0028): the skin's button opens an
// app-owned drop-down, above the skin and below the identity strip.
// While it is open it takes the keyboard: Escape closes it, and focus
// returns to the terminal.

window.AppMenu = (function () {
  const api = window.skinned
  const menu = document.getElementById('menu')
  const button = document.getElementById('menu-button')
  const dot = button.querySelector('.dot')
  let onClose = () => {}
  let refresh = null

  function close () {
    if (menu.hidden) return
    clearInterval(refresh)
    menu.hidden = true
    menu.textContent = ''
    button.classList.remove('open')
    onClose()
  }

  // keys: the entry's shortcut, shown at its right.
  function item (text, onClick, cls, keys) {
    const el = document.createElement('div')
    el.className = 'item' + (cls ? ' ' + cls : '')
    el.textContent = text
    if (keys) {
      const k = document.createElement('span')
      k.className = 'keys'
      k.textContent = keys
      el.appendChild(k)
    }
    if (onClick) el.addEventListener('click', e => { e.stopPropagation(); onClick(el) })
    menu.appendChild(el)
    return el
  }

  function rule () {
    menu.appendChild(document.createElement('hr'))
  }

  // One message at the foot of the drop-down: an error or a note.
  function say (text, cls) {
    for (const e of menu.querySelectorAll('.error, .note')) e.remove()
    const el = document.createElement('pre')
    el.className = cls
    el.textContent = text
    menu.appendChild(el)
  }

  // An action's result: an error or a note stays in the drop-down,
  // anything else closes it.
  async function act (p) {
    const r = await p
    if (r && r.error) say(r.error, 'error')
    else if (r && r.note) say(r.note, 'note')
    else close()
  }

  // A path that may be too long for the menu: it shows its end, the whole
  // of it on hover.
  function pathSpan (cls, text) {
    const sp = document.createElement('span')
    sp.className = cls + ' path'
    sp.title = text
    const b = document.createElement('bdi')
    b.textContent = text
    sp.appendChild(b)
    return sp
  }

  function age (ms) {
    const s = Math.max(0, Math.floor(ms / 1000))
    return s < 60 ? `${s} s` : s < 3600 ? `${Math.floor(s / 60)} m` : s < 86400 ? `${Math.floor(s / 3600)} h` : `${Math.floor(s / 86400)} d`
  }

  // Agent sessions (decision 0027): every live session of this user,
  // refreshed while the menu is open. One in a tab makes that tab
  // active, any other opens a read-only monitor tab.
  function fillSessions (box, list) {
    box.textContent = ''
    if (!list.length) {
      const none = document.createElement('div')
      none.className = 'item none'
      none.textContent = 'none running'
      box.appendChild(none)
    }
    for (const s of list) {
      const el = document.createElement('div')
      el.className = 'item session' + (s.tab !== null ? ' in-tab' : '')
      el.dataset.key = s.key
      for (const [cls, text] of [['s-label', s.label], ['s-folder', s.folder], ['s-state ' + s.state, s.state], ['s-age', age(s.age)], ['s-where', s.where]]) {
        if (cls === 's-folder') {
          el.appendChild(pathSpan(cls, text))
          continue
        }
        const sp = document.createElement('span')
        sp.className = cls
        sp.textContent = text
        el.appendChild(sp)
      }
      el.addEventListener('click', e => { e.stopPropagation(); act(api.openSession(s.key)) })
      box.appendChild(el)
    }
  }

  // The visualization's modes (decision 0015) in a flyout beside their
  // row, the current one marked. A pick shows it, opening the window.
  function vizModes (modes) {
    const row = item('Visualization mode', null, 'submenu')
    const sub = document.createElement('div')
    sub.className = 'sub'
    for (const m of modes) {
      const el = document.createElement('div')
      el.className = 'item' + (m.current ? ' current' : '')
      el.textContent = (m.current ? '* ' : '  ') + m.label
      el.addEventListener('click', e => { e.stopPropagation(); act(api.selectViz(m.id)) })
      sub.appendChild(el)
    }
    row.appendChild(sub)
    // To the right of the drop-down, to its left when the window has no
    // room, and moved up as far as it would run off the bottom.
    row.addEventListener('mouseenter', () => {
      row.classList.add('open')
      sub.classList.remove('left')
      sub.style.top = ''
      let r = sub.getBoundingClientRect()
      if (r.right > window.innerWidth - 4) sub.classList.add('left')
      r = sub.getBoundingClientRect()
      if (r.bottom > window.innerHeight - 4) sub.style.top = (sub.offsetTop - (r.bottom - window.innerHeight + 4)) + 'px'
    })
    row.addEventListener('mouseleave', () => row.classList.remove('open'))
  }

  async function open () {
    const [skins, viz, house, muted, tm, live] = await Promise.all([api.listSkins(), api.vizState(), api.housekeeping(), api.soundMuted(), api.tabsMenu(), api.sessions()])
    menu.textContent = ''
    const then = fn => () => { fn(); close() }
    item('New tab', then(() => api.newTab()), '', 'Ctrl+Shift+T')
    item('New tab...', then(() => window.Chooser.open()))
    item('Close tab', then(() => api.closeTab(null)), '', 'Ctrl+Shift+W')
    // Reopen and Duplicate resume or fork the session, else start a new one.
    const fresh = e => e && e.fresh ? ' (new session)' : ''
    item('Reopen closed tab' + fresh(tm.reopen), tm.reopen ? then(() => api.reopenTab()) : null, tm.reopen ? '' : 'disabled')
    item('Duplicate tab' + fresh(tm.duplicate), tm.duplicate ? then(() => api.duplicateTab()) : null, tm.duplicate ? '' : 'disabled')
    item('Next tab', then(() => api.stepTab(1)), '', 'Ctrl+Tab')
    item('Previous tab', then(() => api.stepTab(-1)), '', 'Ctrl+Shift+Tab')
    rule()
    item('Agent sessions', null, 'heading')
    const box = document.createElement('div')
    box.className = 'sessions'
    menu.appendChild(box)
    fillSessions(box, live)
    item('Sessions dashboard', then(() => api.openDashboard()))
    rule()
    item('Open skin...', () => act(api.openSkin()))
    rule()
    item('Skins', null, 'heading')
    // A skin opened by path shows its folder: it may replace a shipped
    // skin of the same name for the run.
    for (const s of skins) {
      const el = item((s.current ? '* ' : '  ') + s.label, () => act(api.selectSkin(s.id)), (s.current ? 'current' : '') + (s.location ? ' located' : ''))
      if (s.location) el.appendChild(pathSpan('location', s.location))
    }
    rule()
    item(viz.open ? 'Hide visualization' : 'Show visualization', () => { api.toggleViz(); close() })
    vizModes(viz.modes)
    item(muted ? 'Unmute skin sounds' : 'Mute skin sounds', () => { api.toggleSound(); close() })
    rule()
    item('Housekeeping', null, 'heading')
    for (const p of house.problems) item(p.title, () => say(p.detail, 'error'), 'problem')
    item('Forget remembered skin', () => act(api.forgetSkin()))
    item('Open log folder', () => { api.openLogs(); close() })
    item('Clear logs', () => act(api.clearLogs()))
    menu.hidden = false
    refresh = setInterval(async () => {
      const list = await api.sessions()
      if (!menu.hidden) fillSessions(box, list)
    }, 2000)
    button.classList.add('open')
    dot.hidden = true
    api.problemsSeen()
    // Below the button, inside the window, above it when there is no room.
    const b = button.getBoundingClientRect()
    const r = menu.getBoundingClientRect()
    menu.style.left = Math.max(4, Math.min(b.left, window.innerWidth - r.width - 4)) + 'px'
    const below = b.bottom + 2
    const top = document.getElementById('stage').getBoundingClientRect().top
    menu.style.top = (below + r.height <= window.innerHeight - 4 ? below : Math.max(top, b.top - r.height - 2)) + 'px'
  }

  // mousedown, not click: one press opens, and the terminal keeps focus.
  button.addEventListener('mousedown', e => {
    e.preventDefault()
    e.stopPropagation()
    if (e.button !== 0) return
    button.classList.add('down')
    if (menu.hidden) open()
    else close()
  })
  window.addEventListener('mouseup', () => button.classList.remove('down'))
  document.addEventListener('mousedown', e => {
    if (!menu.hidden && !menu.contains(e.target)) close()
  })
  window.addEventListener('keydown', e => {
    if (menu.hidden) return
    e.preventDefault()
    e.stopPropagation()
    if (e.key === 'Escape') close()
  }, true)

  // An unseen problem of this launch marks the button.
  api.housekeeping().then(h => { dot.hidden = !h.unseen })
  api.onHouse(h => { dot.hidden = !h.unseen })

  return {
    open,
    close,
    onClose (fn) { onClose = fn }
  }
})()
