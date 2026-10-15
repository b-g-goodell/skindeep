'use strict'
// The viz page receives numeric frames and can send nothing (decision 0015).
// m: the index of the mode to show.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('vizFeed', {
  onFrame: fn => ipcRenderer.on('frame', (_e, f) => fn({ n: Array.from(f.n, Number), e: Array.from(f.e, Number), m: Number(f.m) }))
})
