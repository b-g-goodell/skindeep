'use strict'
/* global Synth, VizModes, VizCanvas, VizPresets, VizLayout, VizPace, butterchurn */
// The visualization page (decision 0015), fed only by window.vizFeed
// numeric frames: one entry per pane, each a tab of the main window with
// its own signal and the index of its mode in modes.js, and the input:
// the sessions, the sound output's samples, which every pane shares, or
// both. The main process
// owns the modes, and sees the space bar that steps them and the presses
// on each pane's mode drop-down, so the page sends nothing: it draws the
// drop-downs where layout.js puts them, open as the frame says. The
// panes tile the window by layout.js. The pointer goes to the mode in the
// pane under it, read here and never sent, save a press on a drop-down.

;(function () {
  // Butterchurn panes at most: each holds a WebGL2 context, and Chromium
  // drops the oldest context of a page past about 16.
  const MAX_GL = 8
  const root = document.getElementById('panes')
  const menu = document.getElementById('menu')
  let listed = ''
  const panes = new Map()
  let order = ''
  let bc = null
  let audio = null
  let note = ''
  let gl = 0
  let sound = { src: 0, st: 0, s: new Float32Array(0) }
  // The pane a press went to, which holds the pointer until the release,
  // and the time of the last pointer tone.
  let held = null
  let tone = -Infinity
  const SOURCE = ['', 'sound output', 'session and sound output']
  // The text size, a factor (decision 0036): the drop-downs, the
  // captions and a mode's own text, which reads it through text().
  let text = 1
  // The frame rate cap, frames a second or 0 for none (decision 0036),
  // and Gravity 3D's traced pixels a pane, 0 for the mode's own
  // (decision 0015), which a mode reads through trace().
  let cap = 0
  let trace = 0
  const env = { text: () => text, trace: () => trace }

  try {
    const probe = document.createElement('canvas').getContext('webgl2')
    if (!probe) throw new Error('no WebGL2')
    const lose = probe.getExtension('WEBGL_lose_context')
    if (lose) lose.loseContext()
    // An OfflineAudioContext gives butterchurn its analysers without
    // opening any audio device. Levels come from render({audioLevels}).
    audio = new OfflineAudioContext(2, 44100, 44100)
    bc = butterchurn.default || butterchurn
  } catch (e) {
    note = 'needs WebGL2, showing scope: ' + e.message
  }

  function el (tag, cls) {
    const e = document.createElement(tag)
    if (cls) e.className = cls
    return e
  }

  function make (k) {
    const p = { k, i: 0, a: 0, o: 0, x: 0, y: 0, w: 0, h: 0, menu: null, synth: new Synth.Synth(), milk: null, why: '', shown: -1, flat: null }
    p.el = el('div', 'pane')
    p.milkCanvas = el('canvas')
    p.flatCanvas = el('canvas')
    p.label = el('div', 'mode')
    p.button = el('div', 'pick')
    p.el.append(p.milkCanvas, p.flatCanvas, p.label, p.button)
    root.appendChild(p.el)
    watch(p)
    return p
  }

  // When the GPU process exits, every WebGL context of the page is lost
  // and draws nothing again, so a butterchurn pane would stay blank while
  // its mode steps. The pane drops its butterchurn and its canvas, whose
  // context stays lost. The next frame shows a butterchurn mode afresh, on
  // a new context or on the scope with the reason, and a Canvas2D mode
  // draws on.
  function watch (p) {
    p.milkCanvas.addEventListener('webglcontextlost', () => {
      if (!p.milk) return
      p.milk = null
      p.why = ''
      gl--
      const c = el('canvas')
      c.width = p.w
      c.height = p.h
      c.hidden = p.milkCanvas.hidden
      p.milkCanvas.replaceWith(c)
      p.milkCanvas = c
      if (!p.flat) p.shown = -1
      watch(p)
    })
  }

  // The pane's butterchurn, made the first time it shows a milk mode, or
  // null with the reason in p.why.
  function milkOf (p) {
    if (p.milk || p.why) return p.milk
    if (!bc) p.why = note
    else if (gl >= MAX_GL) p.why = `scope: ${MAX_GL} WebGL2 panes at most`
    else {
      try {
        p.milk = bc.createVisualizer(audio, p.milkCanvas, { width: p.w || 1, height: p.h || 1, pixelRatio: 1 })
        gl++
      } catch (e) {
        p.why = 'needs WebGL2, showing scope: ' + e.message
      }
    }
    return p.milk
  }

  function drop (p) {
    if (p.milk) {
      // Cleared first: the loss event below then counts nothing.
      p.milk = null
      gl--
      const ctx = p.milkCanvas.getContext('webgl2')
      const lose = ctx && ctx.getExtension('WEBGL_lose_context')
      if (lose) lose.loseContext()
    }
    if (held === p) held = null
    p.el.remove()
  }

  function caption (p) {
    if (p.shown < 0) return
    const mode = VizModes[p.shown]
    const why = mode.kind === 'milk' && !p.milk && p.why ? '  (' + p.why + ')' : ''
    const src = sound.src > 0 ? '  [' + SOURCE[sound.src] + (sound.st === 2 ? ': none, see the log' : '') + ']' : ''
    p.label.textContent = (panes.size > 1 ? p.i + '  ' : '') + mode.label + src + why
    p.button.textContent = mode.label + ' \u25be'
  }

  // The open drop-down, if any: a row per mode where layout.js puts it,
  // the pane's own mode marked. Redrawn only when it changes.
  function dropdown () {
    const p = [...panes.values()].find(q => q.o === 1 && q.menu)
    const key = p ? [p.k, p.shown, JSON.stringify(p.menu.items)].join() : ''
    for (const q of panes.values()) q.button.classList.toggle('open', q === p)
    if (key === listed) return
    listed = key
    menu.replaceChildren()
    if (!p) return
    VizModes.forEach((m, i) => {
      const b = p.menu.items[i]
      const row = el('div', i === p.shown ? 'item current' : 'item')
      row.textContent = (i === p.shown ? '\u25b8 ' : '  ') + m.label
      Object.assign(row.style, { left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px' })
      menu.appendChild(row)
    })
  }

  // Show mode m in pane p. A butterchurn preset blends from the one
  // before; from a Canvas2D mode it starts at once, since its canvas
  // holds no frame. A milk mode without WebGL2 shows the scope.
  function show (p, m) {
    if (!(m >= 0 && m < VizModes.length) || m === p.shown) return
    const prev = p.shown >= 0 ? VizModes[p.shown] : null
    const mode = VizModes[m]
    p.shown = m
    const milk = mode.kind === 'milk' && milkOf(p)
    if (milk) {
      milk.loadPreset(VizPresets[mode.id], prev && prev.kind === 'milk' ? 1.5 : 0)
      p.flat = null
    } else {
      const g = p.flatCanvas.getContext('2d')
      g.fillStyle = '#000'
      g.fillRect(0, 0, p.flatCanvas.width, p.flatCanvas.height)
      p.flat = VizCanvas[mode.kind === 'milk' ? 'scope' : mode.id](p.flatCanvas, env)
    }
    p.milkCanvas.hidden = !milk
    p.flatCanvas.hidden = !!milk
    caption(p)
  }

  // Each pane's place, in the order of the frame.
  function layout () {
    const list = [...panes.values()]
    const W = window.innerWidth
    const H = window.innerHeight
    list.forEach((p, i) => {
      const r = VizLayout.rect(i, list.length, W, H)
      Object.assign(p.el.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' })
      p.el.classList.toggle('active', list.length > 1 && p.a === 1)
      p.x = r.x
      p.y = r.y
      p.menu = VizLayout.menu(r, VizModes.length, W, H, text)
      const b = p.menu.button
      Object.assign(p.button.style, { left: (b.x - r.x) + 'px', top: (b.y - r.y) + 'px', width: b.w + 'px', height: b.h + 'px' })
      if (r.w === p.w && r.h === p.h) return
      p.w = r.w
      p.h = r.h
      for (const c of [p.milkCanvas, p.flatCanvas]) {
        c.width = r.w
        c.height = r.h
      }
      if (p.milk) p.milk.setRendererSize(r.w, r.h)
    })
    for (const p of list) caption(p)
  }

  window.addEventListener('resize', () => {
    layout()
    dropdown()
  })

  // The pointer, in the pane's canvas pixels, to the mode's pointer(kind,
  // x, y, down), kind down, move or up. A mode without the method hears a
  // tone in its pane's signal instead, at the press and every 60 ms of a
  // drag. Moves come unpressed too. The left button alone.
  // A press on a drop-down's button, or any press while one is open, is
  // the main process's, and no mode hears it.
  function point (kind, e) {
    const all = [...panes.values()]
    const W = window.innerWidth
    const H = window.innerHeight
    if (kind === 'down' && (all.some(q => q.o === 1) || VizLayout.press(e.clientX, e.clientY, all.length, VizModes.length, W, H, -1, text))) return
    const p = held || all[VizLayout.at(e.clientX, e.clientY, all.length, W, H)]
    if (!p) return
    if (kind === 'down') held = p
    const down = kind !== 'up' && held === p
    if (kind === 'up') held = null
    const x = e.clientX - p.x
    const y = e.clientY - p.y
    if (p.flat && p.flat.pointer) p.flat.pointer(kind, x, y, down)
    else if (down && p.shown >= 0 && (kind === 'down' || e.timeStamp - tone > 60)) {
      tone = e.timeStamp
      p.synth.touch(x / Math.max(1, p.w), y / Math.max(1, p.h))
    }
  }
  window.addEventListener('mousedown', e => { if (e.button === 0) point('down', e) })
  window.addEventListener('mousemove', e => point(held && !(e.buttons & 1) ? 'up' : 'move', e))
  window.addEventListener('mouseup', e => { if (e.button === 0 && held) point('up', e) })
  window.vizFeed.onFrame(f => {
    const was = sound.src + ':' + sound.st
    sound = { src: f.src, st: f.st, s: f.s }
    cap = f.c
    trace = f.r
    if (f.t !== text) {
      text = f.t
      document.documentElement.style.setProperty('--viz-text', String(text))
      order = ''
      listed = ''
    }
    const keys = f.p.map(e => e.k)
    for (const [k, p] of panes) {
      if (!keys.includes(k)) {
        drop(p)
        panes.delete(k)
      }
    }
    // The map keeps the frame's order.
    const next = new Map()
    for (const e of f.p) next.set(e.k, panes.get(e.k) || make(e.k))
    panes.clear()
    for (const [k, p] of next) panes.set(k, p)
    const now = f.p.map(e => `${e.k}:${e.i}:${e.a}`).join()
    for (const e of f.p) {
      const p = panes.get(e.k)
      p.i = e.i
      p.a = e.a
      p.o = e.o
      if (sound.src !== 1) p.synth.input(e)
    }
    if (now !== order || was !== sound.src + ':' + sound.st) {
      order = now
      layout()
    }
    for (const e of f.p) show(panes.get(e.k), e.m)
    dropdown()
  })

  // Each display frame the cap lets through is drawn, and every mode
  // advances by the time since the frame drawn before (pace.js). drawn:
  // the frames drawn, for the live checks.
  let prev = performance.now()
  let next = 0
  let drawn = 0
  function loop (now) {
    const d = VizPace.due(now, next, cap)
    next = d.next
    if (!d.draw) {
      requestAnimationFrame(loop)
      return
    }
    const dt = Math.min(0.1, (now - prev) / 1000)
    prev = now
    drawn++
    for (const p of panes.values()) {
      p.synth.step(dt, sound)
      if (p.shown < 0) continue
      if (p.flat) {
        p.flat.draw(p.synth, dt)
      } else if (p.milk) {
        const b = p.synth.bytes()
        p.milk.render({ audioLevels: { timeByteArray: b, timeByteArrayL: b, timeByteArrayR: b } })
      }
    }
    requestAnimationFrame(loop)
  }

  // mode: the active pane's, else the first's. drawn: the frames drawn,
  // cap and trace as the last frame set them. A pane's clock: its synthesiser's
  // seconds, and milkTime its butterchurn's, which steps by its own
  // reading of the time between the frames it renders.
  window.vizState = () => {
    const list = [...panes.values()]
    const main = list.find(p => p.a === 1) || list[0]
    const id = p => p && p.shown >= 0 ? VizModes[p.shown].id : null
    return {
      modes: VizModes.map(m => m.id),
      menu: [...menu.children].map(r => ({ label: r.textContent.trim(), current: r.classList.contains('current'), x: parseFloat(r.style.left), y: parseFloat(r.style.top), w: parseFloat(r.style.width), h: parseFloat(r.style.height) })),
      mode: id(main),
      webgl: !!bc,
      drawn,
      cap,
      trace,
      sound: { src: sound.src, st: sound.st, peak: sound.s.reduce((m, v) => Math.max(m, Math.abs(v)), 0) },
      panes: list.map(p => ({ tab: p.k, place: p.i, active: p.a === 1, mode: id(p), open: p.o === 1, button: p.menu && p.menu.button, milk: !!p.milk, lost: !!p.milk && p.milkCanvas.getContext('webgl2').isContextLost(), x: p.x, y: p.y, w: p.w, h: p.h, touches: p.synth.touches.length, clock: p.synth.t, milkTime: p.milk ? p.milk.renderer.time : null, beats: p.synth.beats, rises: p.synth.rises, idle: p.synth.level.idle, probe: p.flat && p.flat.probe ? p.flat.probe() : null }))
    }
  }
  // For the live checks alone: pane k's mode stages a scene and holds it
  // still, or lets it go (gravity3d stage, unstage). Nothing else calls
  // them, and a mode without them answers null.
  const flat = k => {
    const p = [...panes.values()][k]
    return p && p.flat && p.flat.stage ? p.flat : null
  }
  window.vizStage = (k, spec) => {
    const f = flat(k)
    return f ? f.stage(spec) : null
  }
  window.vizUnstage = k => {
    const f = flat(k)
    return f ? (f.unstage(), true) : null
  }
  requestAnimationFrame(loop)
})()
