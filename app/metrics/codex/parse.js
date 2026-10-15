'use strict'
// Codex rollout lines to metric updates (decision 0013). Pure.

const { EVENT } = require('../bus')
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

class CodexState {
  constructor () {
    this.prevOut = null
    this.meta = null
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
      const rl = p.rate_limits || {}
      for (const w of [rl.primary, rl.secondary]) {
        if (!w || !num(w.window_minutes)) continue
        const which = w.window_minutes <= 300 ? 'five_hour' : w.window_minutes >= 7 * 24 * 60 ? 'seven_day' : null
        if (!which) continue
        r.set.push([`limits.${which}_pct`, num(w.used_percent)], [`limits.${which}_resets_at`, num(w.resets_at)])
      }
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
