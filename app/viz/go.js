'use strict'
// Go mode (decision 0015): a 13 by 13 board on which every event of the
// pane's signal places a stone, black and white in turn, by the rules of
// Go: a group with no liberty is captured, a move that leaves its own
// group none is suicide and refused, and a single stone just captured
// may not be retaken at once (ko). The move is picked by the event: a
// prompt opens on a big point away from the stones, a tool call answers
// near the last move and rings in its class's colour, a stop hunts for
// captures, a subagent plays two moves. Neither side fills its own eye,
// so groups with two live. When neither side has a move, or the board
// is nearly full, it is counted and cleared. While the agent idles the
// board shades the territory each side holds. A click on a point plays
// it for the side to move, if the rules allow.

;(function (root) {
  const N = 13
  const EMPTY = 0
  const BLACK = 1
  const WHITE = 2
  const CLASS_HUE = [200, 120, 40, 0, 280, 320]

  // The board and its rules, apart from drawing. Points are y * n + x.
  class Board {
    constructor (n = N) {
      this.n = n
      this.cells = new Int8Array(n * n)
      this.ko = -1
      this.adj = Array.from({ length: n * n }, (_, i) => {
        const x = i % n
        const y = (i - x) / n
        const out = []
        if (x > 0) out.push(i - 1)
        if (x < n - 1) out.push(i + 1)
        if (y > 0) out.push(i - n)
        if (y < n - 1) out.push(i + n)
        return out
      })
    }

    // The group at i: its stones and its liberties.
    group (i) {
      const c = this.cells[i]
      const stones = [i]
      const seen = new Set(stones)
      const libs = new Set()
      for (let k = 0; k < stones.length; k++) {
        for (const j of this.adj[stones[k]]) {
          if (this.cells[j] === EMPTY) libs.add(j)
          else if (this.cells[j] === c && !seen.has(j)) {
            seen.add(j)
            stones.push(j)
          }
        }
      }
      return { stones, libs }
    }

    // Play color at i. The stones it captures, or null for an illegal
    // move: the point taken, the ko point, or suicide.
    play (i, color) {
      if (this.cells[i] !== EMPTY || i === this.ko) return null
      const other = 3 - color
      this.cells[i] = color
      const taken = []
      for (const j of this.adj[i]) {
        if (this.cells[j] !== other) continue
        const g = this.group(j)
        if (g.libs.size === 0) {
          for (const s of g.stones) {
            this.cells[s] = EMPTY
            taken.push(s)
          }
        }
      }
      const own = this.group(i)
      if (own.libs.size === 0) {
        this.cells[i] = EMPTY
        return null
      }
      this.ko = taken.length === 1 && own.stones.length === 1 && own.libs.size === 1 ? taken[0] : -1
      return taken
    }

    // An empty point every neighbour of which is color's: an eye, or
    // the start of one, that color should not fill.
    eye (i, color) {
      return this.cells[i] === EMPTY && this.adj[i].every(j => this.cells[j] === color)
    }

    copy () {
      const b = Object.create(Board.prototype)
      Object.assign(b, this, { cells: Int8Array.from(this.cells) })
      return b
    }

    clear () {
      this.cells.fill(EMPTY)
      this.ko = -1
    }
  }

  // The move color plays for an event of kind, or -1 for a pass: every
  // legal move but its own eyes scored, the best taken. last: the last
  // move's point or -1.
  function choose (board, color, kind, last, rand = Math.random) {
    const n = board.n
    let best = -1
    let top = -Infinity
    let stones = 0
    for (const c of board.cells) if (c) stones++
    for (let i = 0; i < n * n; i++) {
      if (board.cells[i] !== EMPTY || board.eye(i, color)) continue
      const b = board.copy()
      const taken = b.play(i, color)
      if (!taken) continue
      const x = i % n
      const y = (i - x) / n
      const line = Math.min(x, y, n - 1 - x, n - 1 - y)
      const own = b.group(i)
      let s = rand() * 6 + 40 * taken.length
      if (own.libs.size === 1 && !taken.length) s -= 30
      else if (own.libs.size === 2) s -= 4
      for (const j of board.adj[i]) {
        const c = board.cells[j]
        if (c === color && board.group(j).libs.size === 1) s += 18
        if (c === 3 - color) {
          const l = b.cells[j] ? b.group(j).libs.size : 0
          s += l === 1 ? 12 : 2
        }
      }
      if (stones < n) s += line === 2 || line === 3 ? 8 : line < 1 ? -10 : 0
      else if (line === 0) s -= 3
      let near = 0
      if (last >= 0) {
        const lx = last % n
        near = Math.max(Math.abs(lx - x), Math.abs((last - lx) / n - y))
      }
      if (kind === 3) {
        let far = 9
        for (let j = 0; j < n * n; j++) {
          if (board.cells[j]) far = Math.min(far, Math.max(Math.abs(j % n - x), Math.abs(Math.floor(j / n) - y)))
        }
        s += 3 * Math.min(far, 4) + (line >= 2 ? 4 : 0)
      } else if (kind === 4) {
        s += 30 * taken.length
      } else if (last >= 0) {
        s += Math.max(0, 8 - 3 * near)
      }
      if (s > top) {
        top = s
        best = i
      }
    }
    return best
  }

  // Area score: stones plus empty regions reached by one colour only,
  // of at most max points. Each point's owner, 0 for none.
  function territory (board, max = Infinity) {
    const n = board.n
    const own = new Int8Array(n * n)
    const seen = new Uint8Array(n * n)
    for (let i = 0; i < n * n; i++) {
      if (board.cells[i]) {
        own[i] = board.cells[i]
        continue
      }
      if (seen[i]) continue
      const region = [i]
      seen[i] = 1
      let touch = 0
      for (let k = 0; k < region.length; k++) {
        for (const j of board.adj[region[k]]) {
          const c = board.cells[j]
          if (c) touch |= c
          else if (!seen[j]) {
            seen[j] = 1
            region.push(j)
          }
        }
      }
      if ((touch === BLACK || touch === WHITE) && region.length <= max) for (const j of region) own[j] = touch
    }
    return own
  }

  function create (canvas) {
    // Drawn on a canvas of the CPU, then blitted to the pane: under
    // swiftshader the pane's canvas rasterizes paths and gradients in
    // software GL, several times slower.
    const out = canvas.getContext('2d')
    const layer = document.createElement('canvas')
    const g = layer.getContext('2d', { willReadFrequently: true })
    const wood = document.createElement('canvas')
    const wg = wood.getContext('2d', { willReadFrequently: true })
    const mark = {}
    const board = new Board(N)
    let color = BLACK
    let last = -1
    let passes = 0
    let dirty = true
    let owner = new Int8Array(N * N)
    // Animations: stones placed and taken, and the board's sweep away.
    let placed = []
    let fallen = []
    let ending = 0
    let moving = ''
    let cw = 0
    let ch = 0
    let geo = null
    // The signal's clock at the last frame, and the moves clicked.
    let tick = 0
    let clicks = 0

    function move (kind, cls, t) {
      if (ending) return
      const i = choose(board, color, kind, last)
      if (i < 0) passes++
      else place(i, board.play(i, color), kind === 2 ? CLASS_HUE[cls] ?? 200 : null, t)
      turn(t)
    }

    // Color's stone at i, which took the stones taken.
    function place (i, taken, hue, t) {
      passes = 0
      placed.push({ i, color, t, hue })
      for (const s of taken) fallen.push({ i: s, color: 3 - color, t })
      last = i
      dirty = true
    }

    // The other side to move, the board counted when it is done.
    function turn (t) {
      color = 3 - color
      let stones = 0
      for (const c of board.cells) if (c) stones++
      if (passes >= 2 || stones > N * N * 0.8) ending = t
    }

    // The board's geometry for a w by h pane.
    function layout (w, h) {
      const size = Math.floor(Math.min(w, h) * 0.96)
      const step = size / (N + 0.6)
      return { size, step, x: Math.floor((w - size) / 2), y: Math.floor((h - size) / 2), m: step * 0.8 }
    }

    function stone (c, x, y, r, color, alpha) {
      c.globalAlpha = alpha
      const grad = c.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r)
      if (color === BLACK) {
        grad.addColorStop(0, '#666')
        grad.addColorStop(1, '#080808')
      } else {
        grad.addColorStop(0, '#fff')
        grad.addColorStop(1, '#b8b4aa')
      }
      c.fillStyle = grad
      c.beginPath()
      c.arc(x, y, r, 0, Math.PI * 2)
      c.fill()
      c.globalAlpha = 1
    }

    // The wood, the grid and the stones, redrawn when a move lands.
    function paint () {
      const { size, step, m } = geo
      wood.width = wood.height = size
      const grad = wg.createLinearGradient(0, 0, size, size)
      grad.addColorStop(0, '#d9a85c')
      grad.addColorStop(1, '#b9823e')
      wg.fillStyle = grad
      wg.fillRect(0, 0, size, size)
      wg.strokeStyle = 'rgba(120, 70, 20, 0.18)'
      wg.lineWidth = 1
      for (let k = 0; k < 26; k++) {
        wg.beginPath()
        for (let x = 0; x <= size; x += 8) {
          const y = k * size / 25 + 6 * Math.sin(x / 60 + k * 1.7) + 3 * Math.sin(x / 17 + k)
          if (x) wg.lineTo(x, y)
          else wg.moveTo(x, y)
        }
        wg.stroke()
      }
      wg.strokeStyle = '#2a1a08'
      wg.lineWidth = Math.max(1, step / 22)
      wg.beginPath()
      for (let k = 0; k < N; k++) {
        const p = Math.round(m + k * step) + 0.5
        wg.moveTo(m, p)
        wg.lineTo(m + (N - 1) * step, p)
        wg.moveTo(p, m)
        wg.lineTo(p, m + (N - 1) * step)
      }
      wg.stroke()
      wg.fillStyle = '#2a1a08'
      for (const [a, b] of [[3, 3], [3, 9], [9, 3], [9, 9], [6, 6]]) {
        wg.beginPath()
        wg.arc(m + a * step, m + b * step, Math.max(1.5, step / 9), 0, Math.PI * 2)
        wg.fill()
      }
      const fresh = new Set(moving ? moving.split(',').map(Number) : [])
      for (let i = 0; i < N * N; i++) {
        if (!board.cells[i] || fresh.has(i)) continue
        stone(wg, m + (i % N) * step, m + Math.floor(i / N) * step, step * 0.47, board.cells[i], 1)
      }
      // A region larger than a quarter of the board is open ground, not
      // yet anyone's.
      owner = territory(board, N * N / 4)
      dirty = false
    }

    return {
      draw (synth, dt) {
        const w = canvas.width
        const h = canvas.height
        if (w < 8 || h < 8) return
        const t = synth.t
        tick = t
        if (w !== cw || h !== ch) {
          cw = w
          ch = h
          layer.width = w
          layer.height = h
          geo = layout(w, h)
          dirty = true
        }
        for (const e of synth.since(mark)) {
          move(e.kind, e.cls, t)
          if (e.kind === 5) move(e.kind, e.cls, t)
        }
        if (ending && t - ending > 4) {
          board.clear()
          ending = 0
          last = -1
          passes = 0
          color = BLACK
          placed = []
          fallen = []
          dirty = true
        }
        // A placed stone settles in 0.3 s, then joins the painted board.
        // A tool call's ring spreads for 1.2 s.
        placed = placed.filter(p => t - p.t < (p.hue === null ? 0.3 : 1.2))
        const now = placed.filter(p => t - p.t < 0.3).map(p => p.i).join()
        if (now !== moving) {
          moving = now
          dirty = true
        }
        fallen = fallen.filter(f => t - f.t < 0.8)
        if (dirty) paint()

        const { step, m, size } = geo
        const L = synth.level
        g.fillStyle = `rgb(${10 + 14 * L.busy}, ${8 + 8 * L.busy}, 6)`
        g.fillRect(0, 0, w, h)
        g.drawImage(wood, geo.x, geo.y)
        // The lamp dims while the agent idles.
        if (L.idle > 0.02) {
          g.fillStyle = `rgba(0, 0, 0, ${0.35 * L.idle})`
          g.fillRect(geo.x, geo.y, size, size)
        }
        const at = i => [geo.x + m + (i % N) * step, geo.y + m + Math.floor(i / N) * step]

        // Territory, as small squares, fading in while idle or counting.
        const shade = Math.max(L.idle, ending ? Math.min(1, (t - ending) / 0.8) : 0)
        if (shade > 0.02) {
          const q = step * 0.36
          for (let i = 0; i < N * N; i++) {
            if (!owner[i] || board.cells[i]) continue
            const [x, y] = at(i)
            g.fillStyle = owner[i] === BLACK ? `rgba(10, 10, 10, ${0.75 * shade})` : `rgba(250, 250, 245, ${0.85 * shade})`
            g.fillRect(x - q / 2, y - q / 2, q, q)
          }
        }
        for (const f of fallen) {
          const [x, y] = at(f.i)
          const a = 1 - (t - f.t) / 0.8
          stone(g, x, y - (1 - a) * step * 0.6, step * 0.47 * (1 + 0.3 * (1 - a)), f.color, a)
        }
        for (const p of placed) {
          const [x, y] = at(p.i)
          const a = Math.min(1, (t - p.t) / 0.3)
          if (t - p.t < 0.3 && board.cells[p.i] === p.color) stone(g, x, y, step * 0.47 * (1.4 - 0.4 * a), p.color, a)
          if (p.hue !== null) {
            g.strokeStyle = `hsla(${p.hue}, 95%, 60%, ${Math.max(0, 1 - (t - p.t) / 1.2)})`
            g.lineWidth = Math.max(2, step / 8)
            g.beginPath()
            g.arc(x, y, step * (0.5 + 0.8 * (t - p.t)), 0, Math.PI * 2)
            g.stroke()
          }
        }
        if (last >= 0 && board.cells[last]) {
          const [x, y] = at(last)
          g.strokeStyle = board.cells[last] === BLACK ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)'
          g.lineWidth = Math.max(1, step / 14)
          g.beginPath()
          g.arc(x, y, step * (0.2 + 0.04 * Math.sin(t * 4)), 0, Math.PI * 2)
          g.stroke()
        }
        if (ending) {
          g.fillStyle = `rgba(0, 0, 0, ${Math.max(0, (t - ending - 3) / 1)})`
          g.fillRect(geo.x, geo.y, size, size)
        }
        out.drawImage(layer, 0, 0)
      },

      // A click within half a step of a point plays it, if it is legal.
      pointer (kind, x, y) {
        if (kind !== 'down' || !geo || ending) return
        const { step, m } = geo
        const gx = Math.round((x - geo.x - m) / step)
        const gy = Math.round((y - geo.y - m) / step)
        if (gx < 0 || gy < 0 || gx >= N || gy >= N) return
        if (Math.hypot(x - geo.x - m - gx * step, y - geo.y - m - gy * step) > step / 2) return
        const i = gy * N + gx
        const taken = board.play(i, color)
        if (!taken) return
        clicks++
        place(i, taken, null, tick)
        turn(tick)
      },

      // For the live checks: the stones on the board and the clicks
      // played.
      probe () {
        let stones = 0
        for (const c of board.cells) if (c) stones++
        return { clicks, stones }
      }
    }
  }

  if (typeof module === 'object' && module.exports) module.exports = { Board, choose, territory, BLACK, WHITE }
  else (root.VizCanvas = root.VizCanvas || {}).go = create
})(this)
