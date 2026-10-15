'use strict'
// The viz page receives numeric frames and can send nothing (decision 0015).
// One entry per pane: k the tab's id, i its place in the strip, a 1 for
// the active tab, m the index of the mode to show. src: the input, 0 the
// sessions, 1 the sound output, 2 both. st: the sound output's state, 0
// none yet, 1 live, 2 failed. s: its newest samples, in -1 to 1.
const { contextBridge, ipcRenderer } = require('electron')

const pane = p => ({ k: Number(p.k), i: Number(p.i), a: Number(p.a), m: Number(p.m), n: Array.from(p.n, Number), e: Array.from(p.e, Number) })

contextBridge.exposeInMainWorld('vizFeed', {
  onFrame: fn => ipcRenderer.on('frame', (_e, f) => fn({
    p: Array.from(f.p, pane),
    src: Number(f.src),
    st: Number(f.st),
    s: Float32Array.from(f.s || [], v => Math.max(-1, Math.min(1, Number(v) || 0)))
  }))
})
