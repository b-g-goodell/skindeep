'use strict'
// Skin sounds (decision 0024): the current skin's own files and nothing
// else, at half the volume its manifest gives. A loop plays without end.
// A random sound plays once after a wait drawn from its interval, then
// waits again. A new skin, a reload of the skin or a mute stops every
// sound and every wait. Nothing is recorded or captured.

window.SkinSounds = (function () {
  const api = window.skinned
  // The app's own cap: a skin at full volume plays at half scale.
  const MASTER = 0.5
  const DEFAULT_VOLUME = 0.3
  let skin = null
  // Muted until main says otherwise, so a launch with --mute never sounds.
  let muted = true
  let playing = []
  let gen = 0

  function stop () {
    gen++
    for (const p of playing) {
      clearTimeout(p.timer)
      p.el.pause()
      p.el.removeAttribute('src')
      p.el.load()
    }
    playing = []
  }

  function play (p, g) {
    if (g !== gen) return
    p.timer = null
    p.plays++
    p.el.currentTime = 0
    p.el.play().catch(e => console.error('sound', p.spec.file, e.message))
  }

  function wait (p, g) {
    if (g !== gen) return
    const [lo, hi] = p.spec.interval
    p.timer = setTimeout(() => play(p, g), (lo + Math.random() * (hi - lo)) * 1000)
  }

  function start () {
    stop()
    if (!skin || muted) return
    const g = gen
    for (const spec of skin.sounds || []) {
      const el = new Audio()
      el.preload = 'auto'
      el.src = skin.base + spec.file
      el.volume = MASTER * (spec.volume !== undefined ? spec.volume : DEFAULT_VOLUME)
      const p = { spec, el, timer: null, plays: 0 }
      playing.push(p)
      if (spec.mode === 'loop') {
        el.loop = true
        play(p, g)
      } else {
        el.addEventListener('ended', () => wait(p, g))
        wait(p, g)
      }
    }
  }

  function apply (s) {
    skin = s
    start()
  }

  function setMuted (m) {
    muted = !!m
    start()
  }

  api.soundMuted().then(setMuted)
  api.onSoundMuted(setMuted)

  // For the page's probe: what plays, what waits.
  function state () {
    return {
      skin: skin ? skin.id : null,
      muted,
      sounds: playing.map(p => ({
        file: p.spec.file,
        mode: p.spec.mode,
        src: p.el.src,
        paused: p.el.paused,
        loop: p.el.loop,
        volume: p.el.volume,
        plays: p.plays,
        waiting: p.timer !== null,
        currentTime: p.el.currentTime,
        error: p.el.error ? p.el.error.code : null
      }))
    }
  }

  return { apply, setMuted, state }
})()
