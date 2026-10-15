'use strict'
// The sessions dashboard's pane (decision 0028): app DOM in place of a
// terminal, at the skin's terminal rect and out of reach of skin CSS. At
// the top the sums across sessions, below one row per session with a
// sparkline per meter over the history main keeps, and the issue board
// of its project (decision 0029): open issues over 14 days. Drawn on
// canvas from numbers and the menu's own strings. A click on a row does
// what the menu's row does.

window.DashboardView = (function () {
  const api = window.skinned
  const COLORS = { tokens: '#6fa8dc', tools: '#e0b050', cost: '#8fd18f', context: '#d48ad8', compactions: '#e07a6a', board: '#c8c8c8', dial: '#9fd3c7' }
  const SPARKS = [['tools', 'tool calls'], ['tokens', 'output tokens'], ['cost', 'cost'], ['context', 'context'], ['compactions', 'compactions']]
  const ACROSS = [['tokensPerMin', 'output tokens / min', 'tokens'], ['toolsPerMin', 'tool calls / min', 'tools'], ['cost', 'cost, all sessions', 'cost']]

  function el (tag, cls, text) {
    const e = document.createElement(tag)
    if (cls) e.className = cls
    if (text !== undefined) e.textContent = text
    return e
  }

  function fmt (k, v) {
    if (v === null || v === undefined) return '--'
    if (k === 'cost') return '$' + v.toFixed(2)
    if (k === 'context') return v.toFixed(0) + '%'
    if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M'
    if (v >= 1e3) return (v / 1e3).toFixed(1) + 'k'
    return String(Math.round(v))
  }

  const last = s => { for (let i = s.length - 1; i >= 0; i--) if (s[i] !== null) return s[i]; return null }

  // The board cell: nothing for a session with no project, the issues
  // open over 14 days and those closed in them, or why there are none.
  function boardCell (b) {
    const cell = el('span', 'd-board')
    if (!b) return { cell, canvas: null }
    if (b.state !== 'ok') {
      cell.appendChild(el('span', 'd-num', b.state === 'loading' ? '...' : 'no access'))
      return { cell, canvas: null }
    }
    const c = el('canvas')
    cell.title = `${b.openNow} issues open now, ${b.closed14} closed in the last 14 days`
    cell.append(c, el('span', 'd-num', `${b.openNow} / ${b.closed14}`))
    return { cell, canvas: c }
  }

  // A line of s across the canvas, gaps where s is null, scaled to its
  // own range, the newest point at the right edge.
  function spark (canvas, s, color, filled) {
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (!w || !h) return
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    const g = canvas.getContext('2d')
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, w, h)
    const vals = s.filter(v => v !== null)
    if (!vals.length) return
    const lo = Math.min(0, ...vals)
    const hi = Math.max(...vals)
    const span = hi - lo || 1
    const x = i => s.length < 2 ? w - 1 : (i / (s.length - 1)) * (w - 1)
    const y = v => h - 2 - ((v - lo) / span) * (h - 4)
    g.strokeStyle = color
    g.lineWidth = 1.5
    g.beginPath()
    let on = false
    s.forEach((v, i) => {
      if (v === null) { on = false; return }
      if (on) g.lineTo(x(i), y(v))
      else g.moveTo(x(i), y(v))
      on = true
    })
    g.stroke()
    // The area under a series with no gaps.
    if (filled && s.length > 1 && s.every(v => v !== null)) {
      g.globalAlpha = 0.18
      g.fillStyle = color
      g.beginPath()
      g.moveTo(x(0), h)
      s.forEach((v, i) => g.lineTo(x(i), y(v)))
      g.lineTo(x(s.length - 1), h)
      g.closePath()
      g.fill()
      g.globalAlpha = 1
    }
  }

  function create (root) {
    root.classList.add('dashboard')
    root.tabIndex = -1
    const head = el('div', 'd-head', 'Sessions dashboard')
    const across = el('div', 'd-across')
    const table = el('div', 'd-rows')
    root.append(head, across, table)
    let data = null

    function render () {
      if (!data) return
      const theme = window.SkinView.terminalTheme()
      root.style.color = theme ? theme.foreground : ''
      const live = data.rows.filter(r => !r.ended).length
      const mins = Math.round(data.ticks.length * data.intervalMs / 60000)
      head.textContent = `Sessions dashboard: ${live} live, ${data.rows.length - live} ended, the last ${mins < 1 ? 'minute' : mins + ' min'}, sampled every ${data.intervalMs / 1000} s`
      across.textContent = ''
      for (const [k, title, color] of ACROSS) {
        const box = el('div', 'd-chart')
        const s = data.across[k]
        box.append(el('div', 'd-title', title), el('div', 'd-value', fmt(color, last(s))))
        const c = el('canvas')
        box.appendChild(c)
        across.appendChild(box)
        spark(c, s, COLORS[color], true)
      }
      table.textContent = ''
      // The meters' columns, then one per dial (decision 0033).
      const columns = [...SPARKS.map(([k]) => [k, COLORS[k], false]), ...(data.dials || []).map(n => [n, COLORS.dial, true])]
      const header = el('div', 'd-row d-header')
      header.append(el('span', 'd-label', 'session'), el('span', 'd-folder', 'folder'), el('span', 'd-state', 'state'))
      for (const [, name] of SPARKS) header.appendChild(el('span', 'd-spark', name))
      // The dials (decision 0033): a column per metric opened from a skin.
      for (const name of data.dials || []) {
        const h = el('span', 'd-spark d-dial', name)
        h.title = name
        header.appendChild(h)
      }
      const bh = el('span', 'd-board', 'open / closed')
      bh.title = 'issues on the project\'s board: open now / closed in the last 14 days'
      header.appendChild(bh)
      table.appendChild(header)
      if (!data.rows.length) table.appendChild(el('div', 'd-none', 'No agent session is running.'))
      for (const r of data.rows) {
        const row = el('div', 'd-row' + (r.ended ? ' ended' : ''))
        row.dataset.key = r.key
        const folder = el('span', 'd-folder', r.folder)
        folder.title = r.folder
        row.append(el('span', 'd-label', r.label), folder, el('span', 'd-state ' + (r.ended ? 'ended' : r.state), r.ended ? 'ended' : r.state))
        const canvases = []
        for (const [k, color, dial] of columns) {
          const cell = el('span', 'd-spark' + (dial ? ' d-dial' : ''))
          const c = el('canvas')
          cell.append(c, el('span', 'd-num', fmt(k, last(r.series[k] || []))))
          row.appendChild(cell)
          canvases.push([c, k, color])
        }
        const b = boardCell(r.board)
        row.appendChild(b.cell)
        if (!r.ended) row.addEventListener('click', () => api.openSession(r.key))
        table.appendChild(row)
        for (const [c, k, color] of canvases) spark(c, r.series[k] || [], color, false)
        if (b.canvas) spark(b.canvas, r.board.open, COLORS.board, false)
      }
    }

    new ResizeObserver(render).observe(root)
    return {
      update (d) { data = d; render() },
      render,
      state: () => data && {
        ticks: data.ticks.length,
        dials: data.dials || [],
        rows: data.rows.map(r => ({ key: r.key, label: r.label, state: r.state, ended: r.ended, points: r.series.tokens.filter(v => v !== null).length, last: Object.fromEntries(SPARKS.map(([k]) => [k, last(r.series[k])])), board: r.board || null, boardText: (table.querySelector(`.d-row[data-key="${r.key}"] .d-board`) || {}).textContent || '' })),
        shownRows: [...table.querySelectorAll('.d-row:not(.d-header)')].map(e => ({ key: e.dataset.key, ended: e.classList.contains('ended'), opacity: getComputedStyle(e).opacity }))
      }
    }
  }

  return { create }
})()
