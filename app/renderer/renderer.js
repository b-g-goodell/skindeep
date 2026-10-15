'use strict'
/* global createTerminal, SkinView, SkinSounds, AppMenu, TabStrip, Chooser, DashboardView */
// The page: one terminal per tab in #term, the active one shown
// (decision 0023). A hidden terminal keeps its layout, so every tab
// keeps its size and its scrollback whole. The sessions dashboard's tab
// has a pane of app DOM in place of a terminal (decision 0028).

const api = window.skinned
const host = document.getElementById('term')
const panes = new Map()
let active = null
let metrics = {}

api.onStrip(({ label, cmdline, cwd, notice }) => {
  document.getElementById('strip-label').textContent = label
  document.getElementById('strip-cmd').textContent = cmdline
  document.getElementById('strip-notice').textContent = notice || ''
  document.getElementById('strip-cwd').textContent = cwd
})

// Never while New tab... is open: its fields keep the keyboard.
function focusActive () {
  if (Chooser.isOpen()) return
  const p = panes.get(active)
  if (p && p.term) p.term.focus()
  else if (p) p.el.focus()
}

const terms = () => [...panes.values()].filter(p => p.term)

function fitAll () {
  for (const p of terms()) p.fit.fit()
}

function pane (id, kind) {
  const el = document.createElement('div')
  el.className = 'pane'
  host.appendChild(el)
  if (kind === 'dashboard') {
    const p = { id, el, term: null, fit: null, dash: DashboardView.create(el) }
    panes.set(id, p)
    return p
  }
  const { term, fit, ser } = createTerminal(el, id)
  SkinView.styleTerminal(term)
  const p = { id, el, term, fit, ser }
  panes.set(id, p)
  return p
}

// The tabs as main sends them. A new tab gets a terminal, and its CLI
// starts at that terminal's size. A gone tab loses its terminal.
function sync (state) {
  TabStrip.render(state)
  const ids = new Set(state.tabs.map(t => t.id))
  let changed = false
  for (const [id, p] of panes) {
    if (ids.has(id)) continue
    if (p.term) p.term.dispose()
    p.el.remove()
    panes.delete(id)
    changed = true
  }
  const fresh = state.tabs.filter(t => !panes.has(t.id)).map(t => pane(t.id, t.kind))
  const moved = state.active !== active
  active = state.active
  for (const p of panes.values()) p.el.classList.toggle('active', p.id === active)
  if (changed || fresh.length) fitAll()
  for (const p of fresh) api.ready(p.id, p.term ? p.term.cols : 0, p.term ? p.term.rows : 0)
  if (moved) focusActive()
}

api.onData((id, d) => {
  const p = panes.get(id)
  if (p && p.term) p.term.write(d)
})

// The bottom screen of a terminal as text, blank rows at either end
// dropped (decision 0030).
function screenText (term) {
  const b = term.buffer.active
  const rows = []
  for (let y = b.baseY; y < b.baseY + term.rows; y++) {
    const line = b.getLine(y)
    rows.push(line ? line.translateToString(true) : '')
  }
  while (rows.length && !rows[rows.length - 1].trim()) rows.pop()
  while (rows.length && !rows[0].trim()) rows.shift()
  return rows.join('\n')
}

// Asked after the tab's last bytes, so it answers once they are drawn.
api.onScreenAsk((id, n) => {
  const p = panes.get(id)
  if (!p || !p.term) return api.screen(n, null)
  p.term.write('', () => api.screen(n, screenText(p.term)))
})
// A tab leaving for another window takes its buffer, scrollback
// included, once the bytes before the ask are drawn.
api.onSerializeAsk((id, n) => {
  const p = panes.get(id)
  if (!p || !p.term) return api.serialized(n, null)
  p.term.write('', () => api.serialized(n, p.ser.serialize({ scrollback: p.term.options.scrollback })))
})
api.onDashboard((id, d) => {
  const p = panes.get(id)
  if (p && p.dash) p.dash.update(d)
})
api.onTabs(sync)
api.tabs().then(sync)
new ResizeObserver(fitAll).observe(host)
AppMenu.onClose(focusActive)
Chooser.onClose(focusActive)

// Files dropped on the window are pasted, quoted, into the active tab.
const quote = p => /^[A-Za-z0-9_@%+=:,./-]+$/.test(p) ? p : "'" + p.replace(/'/g, "'\\''") + "'"
document.addEventListener('dragover', e => e.preventDefault())
document.addEventListener('drop', e => {
  e.preventDefault()
  if (Chooser.isOpen()) return
  const p = panes.get(active)
  const paths = Array.from(e.dataTransfer.files).map(f => api.pathForFile(f)).filter(Boolean)
  if (p && p.term && paths.length) p.term.paste(paths.map(quote).join(' ') + ' ')
})

api.onSkin(skin => {
  SkinSounds.apply(skin)
  SkinView.apply(skin, terms).then(() => {
    for (const p of panes.values()) if (p.dash) p.dash.render()
    focusActive()
  })
})
api.settings().then(s => SkinView.setSettings(s, terms))
api.onSettings(s => SkinView.setSettings(s, terms))
api.onMetrics(snap => {
  metrics = snap
  SkinView.update(snap)
})
api.onDials(names => SkinView.setDials(names))

// The page's probe for the live checks (decisions 0023, 0024): each
// tab's terminal, the meters the skin was last given, the skin's sounds
// and widgets.
window.skinnedPage = () => ({
  active,
  metrics,
  sounds: SkinSounds.state(),
  scale: SkinView.scale(),
  widgets: SkinView.state(),
  panes: [...panes.values()].map(p => {
    if (p.dash) return { id: p.id, shown: getComputedStyle(p.el).visibility === 'visible', lines: [], dashboard: p.dash.state() }
    const b = p.term.buffer.active
    const lines = []
    for (let i = 0; i < b.length; i++) lines.push(b.getLine(i).translateToString(true))
    return { id: p.id, shown: getComputedStyle(p.el).visibility === 'visible', cols: p.term.cols, rows: p.term.rows, fontSize: p.term.options.fontSize, viewportY: b.viewportY, lines }
  })
})
