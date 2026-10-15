'use strict'
/* global Terminal, FitAddon, Unicode11Addon, WebLinksAddon, WebglAddon, SerializeAddon */
// The terminal of one tab. Input reaches the tab's pty only from xterm.js
// onData, output reaches xterm.js only as the pty's bytes (decision
// 0002), which the page routes by tab id.

window.createTerminal = function createTerminal (host, id) {
  const api = window.skinned
  const openLink = (event, uri) => { if (event.ctrlKey) api.openLink(uri) }
  const term = new Terminal({
    allowProposedApi: true,
    fontFamily: '"DejaVu Sans Mono", monospace',
    fontSize: 14,
    scrollback: 5000,
    linkHandler: { activate: openLink, allowNonHttpProtocols: false }
  })
  const fit = new FitAddon.FitAddon()
  term.loadAddon(fit)
  // The buffer as escapes, for a tab that moves to another window.
  const ser = new SerializeAddon.SerializeAddon()
  term.loadAddon(ser)
  term.loadAddon(new Unicode11Addon.Unicode11Addon())
  term.unicode.activeVersion = '11'
  term.loadAddon(new WebLinksAddon.WebLinksAddon(openLink))
  term.open(host)
  try {
    const gl = new WebglAddon.WebglAddon()
    gl.onContextLoss(() => gl.dispose())
    term.loadAddon(gl)
  } catch (e) {
    // DOM renderer stays in charge.
  }

  const paste = () => api.clipRead().then(text => { if (text) term.paste(text) })
  term.attachCustomKeyEventHandler(ev => {
    if (ev.type !== 'keydown') return true
    const k = ev.code
    if (ev.ctrlKey && ev.shiftKey && !ev.altKey && k === 'KeyC') {
      ev.preventDefault()
      if (term.hasSelection()) api.clipWrite(term.getSelection(), 'clipboard')
      return false
    }
    if ((ev.ctrlKey && ev.shiftKey && !ev.altKey && k === 'KeyV') || (ev.shiftKey && !ev.ctrlKey && k === 'Insert')) {
      ev.preventDefault()
      paste()
      return false
    }
    // A bare Ctrl+V is ^V to the CLI, as in a plain terminal. Stop the
    // browser's own paste event so it is not also pasted as text.
    if (ev.ctrlKey && !ev.shiftKey && !ev.altKey && k === 'KeyV') ev.preventDefault()
    return true
  })
  term.onSelectionChange(() => {
    if (term.hasSelection()) api.clipWrite(term.getSelection(), 'selection')
  })

  term.onData(d => api.input(id, d))
  term.onBinary(d => api.input(id, d))
  term.onResize(({ cols, rows }) => api.resize(id, cols, rows))
  return { term, fit, ser }
}
