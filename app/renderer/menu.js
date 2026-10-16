'use strict'
// The menus (decisions 0008, 0022 to 0028): the skin's button opens an
// app-owned drop-down, above the skin and below the identity strip, with
// a bar of four menus, File, Agents, Skins and Visualization, on File.
// While it is open it takes the keyboard: Left and Right step through
// the menus, Escape closes it, and focus returns to the terminal.

window.AppMenu = (function () {
  const api = window.skinned
  const menu = document.getElementById('menu')
  const button = document.getElementById('menu-button')
  const dot = button.querySelector('.dot')
  let onClose = () => {}
  let refresh = null
  // The menu the drop-down shows, and the count of asks to show one.
  let shown = 'File'
  let asked = 0

  function close () {
    asked++
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

  function sessionRow (s) {
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
    return el
  }

  // Agent sessions (decision 0027): every live session of this user,
  // refreshed while the menu is open. One in a tab makes that tab
  // active, any other opens a read-only monitor tab. A refresh moves no
  // row: a session still running is redrawn in its place, a new
  // one is added last, and one that ended stays, marked ended, until the
  // menu closes.
  function fillSessions (box, list) {
    const rows = new Map([...box.querySelectorAll('.session')].map(el => [el.dataset.key, el]))
    if (!rows.size) box.textContent = ''
    if (!list.length && !box.childElementCount) {
      const none = document.createElement('div')
      none.className = 'item none'
      none.textContent = 'none running'
      box.appendChild(none)
    }
    if (list.length) for (const el of box.querySelectorAll('.none')) el.remove()
    for (const s of list) {
      const el = sessionRow(s)
      if (rows.has(s.key)) rows.get(s.key).replaceWith(el)
      else box.appendChild(el)
      rows.delete(s.key)
    }
    for (const el of rows.values()) {
      el.classList.add('ended')
      el.querySelector('.s-state').className = 's-state ended'
      el.querySelector('.s-state').textContent = 'ended'
    }
  }

  // The sessions list keeps the height it opened with, so its refresh
  // moves nothing below it, and no more than the window leaves
  // the menu, the rest scrolling inside it. Not below two rows.
  function fitSessions (box, below) {
    box.style.height = ''
    const room = window.innerHeight - 4 - below
    const over = menu.getBoundingClientRect().height - room
    const h = box.getBoundingClientRect().height
    const row = box.firstElementChild ? box.firstElementChild.getBoundingClientRect().height : 0
    box.style.height = Math.max(Math.min(h, 2 * row), over > 0 ? h - over : h) + 'px'
  }

  // A list beside its row, the current entry marked: the visualization's
  // modes and inputs (decision 0015), where a pick shows it, opening the
  // window, and each setting's choices.
  function flyout (title, list, pick) {
    const row = item(title, null, 'submenu')
    const sub = document.createElement('div')
    sub.className = 'sub'
    for (const m of list) {
      const el = document.createElement('div')
      el.className = 'item' + (m.current ? ' current' : '')
      el.textContent = (m.current ? '* ' : '  ') + m.label
      el.addEventListener('click', e => { e.stopPropagation(); act(pick(m.id)) })
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

  // The four menus (decision 0022), in the order of the bar. Each fills
  // the drop-down below the bar from what it asks the main process.
  const MENUS = [
    ['File', fileMenu],
    ['Agents', agentsMenu],
    ['Skins', skinsMenu],
    ['Visualization', vizMenu]
  ]
  const then = fn => () => { fn(); close() }

  // The bar: one title per menu, the shown one marked. A press on a
  // title shows its menu.
  function bar () {
    const row = document.createElement('div')
    row.className = 'bar'
    for (const [name] of MENUS) {
      const el = document.createElement('div')
      el.className = 'title' + (name === shown ? ' current' : '')
      el.textContent = name
      el.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); if (name !== shown) show(name) })
      row.appendChild(el)
    }
    menu.appendChild(row)
  }

  // File: the tab entries of decision 0023, Settings and Housekeeping.
  async function fileMenu () {
    const [tm, prefs, house] = await Promise.all([api.tabsMenu(), api.settingsMenu(), api.housekeeping()])
    return () => {
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
      item('Settings', null, 'heading')
      for (const s of prefs) flyout(s.label, s.choices.map(c => ({ id: c.value, label: c.label, current: c.current })), v => api.setSetting(s.id, v))
      // The skin's splits back to its own sizes (decision 0035).
      const split = window.SkinView.splits().length > 0
      item('Reset panel sizes', split ? () => act(api.resetPanels()) : null, split ? '' : 'disabled')
      rule()
      item('Housekeeping', null, 'heading')
      for (const p of house.problems) item(p.title, () => say(p.detail, 'error'), 'problem')
      item('Forget remembered skin', () => act(api.forgetSkin()))
      item('Open log folder', () => { api.openLogs(); close() })
      item('Clear logs', () => act(api.clearLogs()))
      dot.hidden = true
      api.problemsSeen()
    }
  }

  // Agents: the agent sessions of decision 0027, refreshed while the
  // menu shows, and the dashboard of decision 0028.
  async function agentsMenu () {
    const live = await api.sessions()
    return () => {
      item('Agent sessions', null, 'heading')
      const box = document.createElement('div')
      box.className = 'sessions'
      menu.appendChild(box)
      fillSessions(box, live)
      item('Sessions dashboard', then(() => api.openDashboard()))
      return box
    }
  }

  // Skins: Open skin... and the skins, the current one marked. A skin
  // opened by path shows its folder: it may replace a shipped skin of
  // the same name for the run.
  async function skinsMenu () {
    const skins = await api.listSkins()
    return () => {
      item('Open skin...', () => act(api.openSkin()))
      rule()
      item('Skins', null, 'heading')
      for (const s of skins) {
        const el = item((s.current ? '* ' : '  ') + s.label, () => act(api.selectSkin(s.id)), (s.current ? 'current' : '') + (s.location ? ' located' : ''))
        if (s.location) el.appendChild(pathSpan('location', s.location))
      }
    }
  }

  // Visualization: the window, its modes and inputs (decision 0015), and
  // the skin's sounds (decision 0024).
  async function vizMenu () {
    const [viz, muted] = await Promise.all([api.vizState(), api.soundMuted()])
    return () => {
      item(viz.open ? 'Hide visualization' : 'Show visualization', () => { api.toggleViz(); close() })
      flyout('Visualization mode', viz.modes, api.selectViz)
      flyout('Visualization input', viz.inputs, api.selectVizInput)
      item(muted ? 'Unmute skin sounds' : 'Mute skin sounds', () => { api.toggleSound(); close() })
    }
  }

  // Shows one menu under the bar, opening the drop-down if it is closed.
  // A later ask wins over one still waiting on the main process.
  async function show (name) {
    const n = ++asked
    const fill = await MENUS.find(m => m[0] === name)[1]()
    if (n !== asked) return
    clearInterval(refresh)
    shown = name
    menu.textContent = ''
    bar()
    const box = fill()
    menu.hidden = false
    button.classList.add('open')
    if (box) {
      fitSessions(box, button.getBoundingClientRect().bottom + 2)
      refresh = setInterval(async () => {
        const list = await api.sessions()
        if (!menu.hidden && box.isConnected) fillSessions(box, list)
      }, 2000)
    }
    // Below the button, inside the window, above it when there is no room.
    const b = button.getBoundingClientRect()
    const r = menu.getBoundingClientRect()
    menu.style.left = Math.max(4, Math.min(b.left, window.innerWidth - r.width - 4)) + 'px'
    const below = b.bottom + 2
    const top = document.getElementById('stage').getBoundingClientRect().top
    menu.style.top = (below + r.height <= window.innerHeight - 4 ? below : Math.max(top, b.top - r.height - 2)) + 'px'
  }

  // The drop-down opens on File.
  function open () {
    return show('File')
  }

  // Left and Right step through the menus, wrapping.
  function step (d) {
    const i = MENUS.findIndex(m => m[0] === shown)
    show(MENUS[(i + d + MENUS.length) % MENUS.length][0])
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
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') step(e.key === 'ArrowLeft' ? -1 : 1)
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
