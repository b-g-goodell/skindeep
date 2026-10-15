'use strict'
// A synthetic signal built from the session's numeric event stream
// (decision 0015), the sound output's samples in its place or added to
// it. Each frame yields 1024 samples at a nominal 44.1 kHz and 48 band
// magnitudes. No audio device is touched: the main process records the
// sound output and sends its samples as numbers.

window.Synth = (function () {
  const N = 1024
  const RATE = 44100
  const TOOL_HZ = [520, 330, 660, 880, 1320, 990]
  const BANDS = 48

  const bandHz = Array.from({ length: BANDS }, (_, k) => 40 * Math.pow(12000 / 40, k / (BANDS - 1)))
  const hann = Float32Array.from({ length: N }, (_, n) => 0.5 - 0.5 * Math.cos(2 * Math.PI * n / (N - 1)))

  class Synth {
    constructor () {
      this.t = 0
      this.voices = []
      this.level = { bass: 0, treble: 0, busy: 0, idle: 0 }
      this.target = { bass: 0, treble: 0, busy: 0, idle: 0 }
      this.samples = new Float32Array(N)
      this.bands = new Float32Array(BANDS)
      this.flashes = []
      // Events so far: a renderer that keeps the count sees a beat.
      this.beats = 0
      // Rises of the sound output's loudness so far, while it drives the
      // signal alone, and the slow level a rise is measured from.
      this.rises = 0
      this.floor = 0
      this.armed = true
    }

    // frame: { n: [out_bps, in_kps, idle_s, out_rate, busy, cpu, ctx], e: [kind, cls, ...] }
    input (frame) {
      const [outBps, inKps, idle, outRate, busy] = frame.n
      this.target.bass = Math.min(1, outBps / 2500) + Math.min(0.3, inKps / 30)
      this.target.treble = Math.min(1, outRate / 120)
      this.target.busy = busy ? 1 : 0
      this.target.idle = idle > 3 ? Math.min(1, (idle - 3) / 10) : 0
      for (let i = 0; i + 1 < frame.e.length; i += 2) this.trigger(frame.e[i], frame.e[i + 1])
    }

    trigger (kind, cls) {
      const t = this.t
      if (kind === 1) this.voices.push({ type: 'thump', t, hz: 70, amp: 0.5, life: 0.25 })
      else if (kind === 2) this.voices.push({ type: 'tool', t, hz: TOOL_HZ[cls] || 520, amp: 0.6, life: 0.45 })
      else if (kind === 3) this.voices.push({ type: 'chirp', t, from: 1800, to: 6500, amp: 0.45, life: 0.7 })
      else if (kind === 4) this.voices.push({ type: 'chirp', t, from: 6000, to: 1200, amp: 0.4, life: 0.7 })
      else if (kind === 5) this.voices.push({ type: 'wobble', t, hz: 220, amp: 0.5, life: 1.4 })
      else if (kind === 6) this.voices.push({ type: 'chirp', t, from: 8000, to: 90, amp: 0.7, life: 1.6 })
      this.flashes.push({ kind, cls, t })
      this.beats++
      if (this.voices.length > 64) this.voices.splice(0, this.voices.length - 64)
    }

    // Levels from the sound output alone: its loudness for the bass, its
    // sample-to-sample change for the treble.
    hear (a) {
      let sq = 0
      let d = 0
      for (let n = 0; n < a.length; n++) {
        sq += a[n] * a[n]
        if (n) d += Math.abs(a[n] - a[n - 1])
      }
      this.target.bass = Math.min(1, 4 * Math.sqrt(sq / a.length))
      this.target.treble = Math.min(1, 12 * d / a.length)
      this.target.busy = 0
      this.target.idle = 0
    }

    // Advance by dt seconds and fill this.samples and this.bands. sound:
    // { src, s }, src 0 the sessions alone, 1 the sound output's N
    // samples s alone, 2 both added.
    step (dt, sound) {
      const a = sound && sound.src > 0 && sound.s.length === N ? sound.s : null
      const only = a && sound.src === 1
      if (only) this.hear(a)
      this.t += dt
      const k = 1 - Math.exp(-dt * 6)
      for (const key of Object.keys(this.level)) this.level[key] += (this.target[key] - this.level[key]) * k
      const L = this.level
      const t0 = this.t
      if (only) {
        if (this.armed && L.bass > this.floor + 0.15) {
          this.rises++
          this.armed = false
        } else if (L.bass < this.floor + 0.05) this.armed = true
        this.floor += (L.bass - this.floor) * (1 - Math.exp(-dt * 1.5))
      }
      this.voices = this.voices.filter(v => t0 - v.t < v.life)
      this.flashes = this.flashes.filter(f => t0 - f.t < 1.5)
      const bassHz = 55 + 50 * Math.min(1, L.bass)
      const bassAmp = 0.06 + 0.8 * Math.min(1, L.bass) + 0.1 * L.busy
      const s = this.samples
      for (let n = 0; n < N; n++) {
        if (only) {
          s[n] = Math.tanh(1.5 * a[n])
          continue
        }
        const t = t0 + n / RATE
        let x = (a ? 1.5 * a[n] : 0) + bassAmp * Math.sin(2 * Math.PI * bassHz * t)
        x += 0.07 * L.idle * Math.sin(2 * Math.PI * 38 * t) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 0.3 * t))
        x += 0.22 * L.treble * (Math.random() * 2 - 1) * (n % 2 ? 1 : -1)
        for (const v of this.voices) {
          const age = t - v.t
          if (age < 0 || age > v.life) continue
          const env = v.amp * Math.exp(-age / (v.life / 3))
          if (v.type === 'thump') x += env * Math.sin(2 * Math.PI * v.hz * age)
          else if (v.type === 'tool') x += env * (0.7 * Math.sin(2 * Math.PI * v.hz * t) + 0.3 * (Math.random() * 2 - 1))
          else if (v.type === 'wobble') x += env * Math.sin(2 * Math.PI * v.hz * t + 3 * Math.sin(2 * Math.PI * 6 * age))
          else {
            const f = v.from + (v.to - v.from) * Math.min(1, age / v.life)
            x += env * Math.sin(2 * Math.PI * f * age)
          }
        }
        s[n] = Math.tanh(x)
      }
      for (let b = 0; b < BANDS; b++) {
        const w = 2 * Math.PI * bandHz[b] / RATE
        let re = 0
        let im = 0
        for (let n = 0; n < N; n += 2) {
          const v = s[n] * hann[n]
          re += v * Math.cos(w * n)
          im -= v * Math.sin(w * n)
        }
        this.bands[b] = Math.sqrt(re * re + im * im) / (N / 4)
      }
    }

    // The events since a renderer's last call, oldest first, as { kind,
    // cls }. mark: an object the renderer keeps, empty at first. The
    // sound output alone brings no events, so there each rise of its
    // loudness counts as an output event (kind 1).
    since (mark) {
      if (mark.beats === undefined) Object.assign(mark, { beats: this.beats, rises: this.rises })
      const n = Math.min(this.beats - mark.beats, this.flashes.length)
      const out = this.flashes.slice(this.flashes.length - n).map(f => ({ kind: f.kind, cls: f.cls }))
      for (let k = mark.rises; k < this.rises; k++) out.push({ kind: 1, cls: 0 })
      mark.beats = this.beats
      mark.rises = this.rises
      return out
    }

    bytes () {
      const out = new Uint8Array(N)
      for (let n = 0; n < N; n++) out[n] = Math.max(0, Math.min(255, Math.round(128 + 127 * this.samples[n])))
      return out
    }
  }

  return { Synth, N, BANDS }
})()
