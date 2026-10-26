'use strict'
// The viz page receives numeric frames and can send nothing (decision 0015).
// One entry per pane: k the tab's id, i its place in the strip, a 1 for
// the active tab, m the index of the mode to show, o 1 while its mode
// drop-down is open. src: the input, 0 the sessions, 1 the sound output,
// 2 both. st: the sound output's state, 0 none yet, 1 live, 2 failed. s:
// its newest samples, in -1 to 1. t: the text size, a factor of 0.5 to
// 2 (decision 0036). c: the frame rate cap, frames a second in 1 to
// 240, 0 for none. r: Gravity 3D's traced pixels a pane, in 1000 to
// 1000000, 0 for the mode's own (decision 0015). w: the Gravity modes'
// waves, 1 for smoke, 0 for the colour field (decision 0015).
const { contextBridge, ipcRenderer } = require('electron')

// A number in lo to hi, else 0.
const within = (v, lo, hi) => (Number(v) >= lo && Number(v) <= hi ? Number(v) : 0)

const pane = p => ({ k: Number(p.k), i: Number(p.i), a: Number(p.a), m: Number(p.m), o: Number(p.o), n: Array.from(p.n, Number), e: Array.from(p.e, Number) })

contextBridge.exposeInMainWorld('vizFeed', {
  onFrame: fn => ipcRenderer.on('frame', (_e, f) => fn({
    p: Array.from(f.p, pane),
    src: Number(f.src),
    st: Number(f.st),
    s: Float32Array.from(f.s || [], v => Math.max(-1, Math.min(1, Number(v) || 0))),
    t: Math.max(0.5, Math.min(2, Number(f.t) || 1)),
    c: within(f.c, 1, 240),
    r: within(f.r, 1000, 1000000),
    w: within(f.w, 1, 1)
  }))
})
