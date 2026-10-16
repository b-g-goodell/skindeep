'use strict'
// Codex rollout lines to metric updates (decision 0013). Pure.

const { EVENT } = require('../bus')
const limits = require('../limits')
const { toolKey, num } = require('../names')

// Tool class for the visualization, as in the Claude adapter.
function toolClass (name) {
  const n = String(name || '')
  if (/^(exec|shell|local_shell|container\.exec|exec_command|unified_exec)$/.test(n)) return 3
  if (/^(apply_patch|write_file|edit)$/.test(n)) return 2
  if (/^(read_file|view_image|list_dir|grep|search)$/.test(n)) return 1
  if (/^(web_search|web_fetch)/.test(n)) return 4
  if (/agent|spawn/.test(n)) return 5
  return 0
}

// A window's scalar names: five_hour for 5 h or less, seven_day for
// about a week. A 30 day window has only its item.
function scalar (minutes) {
  if (minutes <= 300) return 'five_hour'
  if (minutes >= 6 * 1440 && minutes <= 8 * 1440) return 'seven_day'
  return null
}

// A model's name as a skin's label shows it: the last word of a
// hyphenated name, GPT-5.3-Codex-Spark as Spark, so a quarter tile has
// room for it. The item keeps the whole name in model.
function shortName (name) {
  const last = name.split('-').pop()
  return /^[A-Za-z][A-Za-z ]*$/.test(last) ? last : name
}

class CodexState {
  constructor () {
    this.prevOut = null
    this.meta = null
    // The latest windows of each limit, by limit_id, in order of first
    // appearance (decision 0011).
    this.limitsById = new Map()
  }

  // One token_count's rate_limits: one limit's snapshot, its limit_id
  // and limit_name, and its primary and secondary windows. The limit
  // `codex` (or one with no limit_id) is the account's and fills the
  // five-hour and seven-day names, null for a window it no longer
  // sends. Another, such as codex_bengalfox named GPT-5.3-Codex-Spark,
  // is one model's and has only its items. Snapshots of different
  // limits interleave in one rollout.
  limits (rl) {
    const id = typeof rl.limit_id === 'string' && rl.limit_id ? rl.limit_id : 'codex'
    const account = id === 'codex'
    const model = account ? null : String(typeof rl.limit_name === 'string' && rl.limit_name.trim() ? rl.limit_name : id).slice(0, 40)
    const windows = [rl.primary, rl.secondary]
      .filter(w => w && typeof w === 'object' && num(w.window_minutes) && num(w.used_percent) !== null)
      .sort((a, b) => a.window_minutes - b.window_minutes)
    if (windows.length) this.limitsById.set(id, { model, windows })
    else this.limitsById.delete(id)
    const set = []
    if (account) {
      for (const which of ['five_hour', 'seven_day']) {
        const w = windows.find(x => scalar(x.window_minutes) === which)
        set.push([`limits.${which}_pct`, w ? num(w.used_percent) : null], [`limits.${which}_resets_at`, w ? num(w.resets_at) : null])
      }
    }
    const items = []
    const ids = [...this.limitsById.keys()].sort((a, b) => (b === 'codex') - (a === 'codex'))
    for (const k of ids) {
      const l = this.limitsById.get(k)
      for (const w of l.windows) {
        const window = limits.span(w.window_minutes)
        const label = l.model ? `${shortName(l.model)} ${window}` : window
        items.push(limits.item({ key: `${k}.${window}`, window, model: l.model, label, pct: w.used_percent, resetsAt: w.resets_at }))
      }
    }
    set.push(['limits.items', limits.list(items)])
    return set
  }

  // Returns { set: [[name, value]], add: [[name, n]], events: [[kind, cls]],
  // samples: [[rate name, amount]] }.
  add (obj) {
    const r = { set: [], add: [], events: [], samples: [] }
    const p = obj && obj.payload
    if (!p || typeof p !== 'object') return r
    if (obj.type === 'session_meta') {
      this.meta = { id: p.id, cwd: p.cwd, source: p.source }
    } else if (obj.type === 'turn_context') {
      if (p.model) r.set.push(['model.name', String(p.model).slice(0, 40)])
    } else if (obj.type === 'event_msg' && p.type === 'token_count') {
      const info = p.info
      if (info && info.total_token_usage) {
        const t = info.total_token_usage
        const last = info.last_token_usage || {}
        const win = num(info.model_context_window)
        const used = num(last.input_tokens)
        r.set.push(['tokens.in', num(t.input_tokens)], ['tokens.out', num(t.output_tokens)],
          ['tokens.cache_read', num(t.cached_input_tokens)], ['tokens.cache_write', num(t.cache_write_input_tokens)],
          ['cache.hit_ratio', t.input_tokens ? (t.cached_input_tokens || 0) / t.input_tokens : null],
          ['context.window', win], ['context.used_tokens', used],
          ['context.used_pct', win && used !== null ? used / win * 100 : null],
          ['context.cache_read', num(last.cached_input_tokens)],
          ['context.uncached', used !== null ? used - (last.cached_input_tokens || 0) : null],
          ['context.output', num(last.output_tokens)])
        const out = num(t.output_tokens) || 0
        if (this.prevOut !== null && out > this.prevOut) r.samples.push(['tokens.out_rate', out - this.prevOut])
        this.prevOut = out
      }
      const rl = p.rate_limits
      if (rl && typeof rl === 'object') r.set.push(...this.limits(rl))
    } else if (obj.type === 'event_msg' && p.type === 'task_started') {
      r.set.push(['state.busy', 1])
      r.add.push(['event.prompt', 1])
      r.events.push([EVENT.prompt, 0])
    } else if (obj.type === 'event_msg' && p.type === 'task_complete') {
      r.set.push(['state.busy', 0])
      r.add.push(['event.stop', 1])
      r.events.push([EVENT.stop, 0])
    } else if (obj.type === 'compacted') {
      r.add.push(['event.compact', 1], ['session.compactions', 1])
      r.events.push([EVENT.compact, 0])
    } else if (obj.type === 'response_item' && ['function_call', 'custom_tool_call', 'local_shell_call', 'web_search_call'].includes(p.type)) {
      const name = p.type === 'local_shell_call' ? 'shell' : p.type === 'web_search_call' ? 'web_search' : p.name
      r.add.push(['tools.total', 1], ['event.tool', 1], [toolKey(name || p.type), 1])
      r.samples.push(['tools.rate', 1])
      r.events.push([EVENT.tool, toolClass(name)])
    }
    return r
  }
}

module.exports = { CodexState, toolClass }
