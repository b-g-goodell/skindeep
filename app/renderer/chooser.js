'use strict'
// New tab... (decision 0025): an app-owned dialog above the skin, out of
// reach of skin CSS. The agent, its profile and the folder, and the
// command line the tab will run, shown and editable. Enter opens, Escape
// cancels. While it is open the body has the class modal: the terminal
// has no focus and the tab chords do nothing. With select-agent-config
// installed a Config row offers its snapshots (decision 0037): in a
// snapshot the line runs in the snapshot's shell, whose launchers set
// the profile, so the Profile row is disabled.

window.Chooser = (function () {
  const api = window.skinned
  const box = document.getElementById('chooser')
  let state = null
  let agent = null
  let f = null
  let onClose = () => {}

  function el (tag, cls, text) {
    const e = document.createElement(tag)
    if (cls) e.className = cls
    if (text !== undefined) e.textContent = text
    return e
  }

  function button (text, fn, cls) {
    const b = el('button', cls, text)
    b.type = 'button'
    b.addEventListener('click', e => { e.preventDefault(); fn() })
    return b
  }

  const current = () => state.agents.find(a => a.kind === agent)
  const chosen = () => current().profiles.find(p => p.dir === f.profile.value)

  function say (text) {
    f.error.textContent = text || ''
    f.error.hidden = !text
  }

  const snapshot = () => (f.snapshot && state.snapshots && state.snapshots.find(s => s.id === f.snapshot.value)) || null

  // The variable the tab runs with, and Forget for a remembered profile.
  // In a snapshot the profile is the snapshot shell's to set.
  function showProfile () {
    const a = current()
    const p = chosen()
    const s = snapshot()
    f.profile.disabled = !!s
    f.other.disabled = !!s
    if (s) f.env.textContent = `In the snapshot ${s.name}: ${a.variable} is set by its shell's launchers, and the snapshot's tree stands at the canonical paths`
    else f.env.textContent = p && p.isDefault ? `${a.variable} unset, the default profile` : `${a.variable}=${p ? p.shown : ''}`
    f.forget.disabled = !!s || !(p && p.remembered)
    f.shell.textContent = s
      ? 'The line runs in the snapshot\'s interactive shell, each word quoted: its launchers and aliases apply, ~ and $VAR do not expand.'
      : 'No shell runs the line: quotes and backslashes work, ~ and $VAR do not.'
  }

  function fillProfiles (dir) {
    f.profile.textContent = ''
    for (const p of current().profiles) {
      const o = el('option', null, p.shown + (p.isDefault ? '  (default)' : ''))
      o.value = p.dir
      f.profile.appendChild(o)
    }
    f.profile.value = current().profiles.some(p => p.dir === dir) ? dir : current().profiles[0].dir
    showProfile()
  }

  function pickAgent (kind) {
    agent = kind
    for (const r of f.agents) r.checked = r.value === kind
    const a = current()
    fillProfiles(a.profile)
    f.line.value = a.line
    f.dropped.textContent = a.dropped ? `Not carried from this window: ${a.dropped}` : ''
    f.dropped.hidden = !a.dropped
    say(null)
  }

  async function otherProfile () {
    const r = await api.chooserProfile()
    if (!r.dir) return
    const a = current()
    if (!a.profiles.some(p => p.dir === r.dir)) a.profiles.push({ dir: r.dir, shown: r.shown, isDefault: false, remembered: false })
    fillProfiles(r.dir)
  }

  async function forget () {
    const p = chosen()
    if (!p || !p.remembered) return
    const keep = { line: f.line.value, folder: f.folder.value }
    state = await api.chooserForget(agent, p.dir)
    fillProfiles(current().profile)
    f.line.value = keep.line
    f.folder.value = keep.folder
  }

  async function chooseFolder () {
    const r = await api.chooserFolder(f.folder.value)
    if (r.dir) f.folder.value = r.dir
  }

  async function submit () {
    const r = await api.chooserOpen({ agent, profile: f.profile.value, folder: f.folder.value, line: f.line.value, snapshot: f.snapshot ? f.snapshot.value : '' })
    if (r && r.error) say(r.error)
    else close()
  }

  function row (form, label, ...parts) {
    const r = el('div', 'row')
    r.append(el('span', 'name', label), ...parts)
    form.appendChild(r)
  }

  function build () {
    box.textContent = ''
    const form = el('form', 'dialog')
    form.addEventListener('submit', e => { e.preventDefault(); submit() })
    form.appendChild(el('div', 'title', 'New tab'))
    f = { agents: [] }
    const radios = el('span', 'agents')
    for (const a of state.agents) {
      const l = el('label')
      const r = el('input')
      Object.assign(r, { type: 'radio', name: 'agent', value: a.kind })
      r.addEventListener('change', () => pickAgent(a.kind))
      f.agents.push(r)
      l.append(r, ' ' + a.name)
      radios.appendChild(l)
    }
    row(form, 'Agent', radios)
    f.profile = el('select', 'profile')
    f.profile.addEventListener('change', showProfile)
    f.forget = button('Forget', forget, 'forget')
    f.other = button('Other profile...', otherProfile, 'other')
    row(form, 'Profile', f.profile, f.other, f.forget)
    // The snapshots of select-agent-config, when it is installed.
    f.snapshot = null
    if (state.snapshots) {
      f.snapshot = el('select', 'snapshot')
      const live = el('option', null, 'Live configuration')
      live.value = ''
      f.snapshot.appendChild(live)
      for (const s of state.snapshots) {
        const o = el('option', null, s.shown)
        o.value = s.id
        f.snapshot.appendChild(o)
      }
      f.snapshot.value = state.snapshots.some(s => s.id === state.snapshot) ? state.snapshot : ''
      f.snapshot.addEventListener('change', showProfile)
      row(form, 'Config', f.snapshot)
    }
    f.env = el('div', 'hint env')
    form.appendChild(f.env)
    f.folder = el('input', 'folder')
    f.folder.spellcheck = false
    row(form, 'Folder', f.folder, button('Choose...', chooseFolder))
    f.line = el('input', 'line')
    f.line.spellcheck = false
    row(form, 'Command', f.line)
    f.dropped = el('div', 'hint dropped')
    form.appendChild(f.dropped)
    f.shell = el('div', 'hint')
    form.appendChild(f.shell)
    f.error = el('pre', 'error')
    form.appendChild(f.error)
    const buttons = el('div', 'buttons')
    const ok = el('button', 'open', 'Open')
    ok.type = 'submit'
    buttons.append(button('Cancel', close, 'cancel'), ok)
    form.appendChild(buttons)
    box.appendChild(form)
  }

  async function open () {
    if (!box.hidden) return
    state = await api.chooser()
    build()
    pickAgent(state.agent)
    f.folder.value = state.folder
    box.hidden = false
    document.body.classList.add('modal')
    f.line.focus()
  }

  function close () {
    if (box.hidden) return
    box.hidden = true
    box.textContent = ''
    document.body.classList.remove('modal')
    onClose()
  }

  // Before the menu's and the tab strip's handlers see the key.
  window.addEventListener('keydown', e => {
    if (box.hidden || e.key !== 'Escape') return
    e.preventDefault()
    e.stopPropagation()
    close()
  }, true)

  return {
    open,
    close,
    isOpen: () => !box.hidden,
    onClose (fn) { onClose = fn }
  }
})()
