'use strict'
// Pure functions from Claude Code side-channel payloads to metric
// updates (decisions 0011, 0012). Each returns [name, value] pairs.

const compact = require('./compact')
const { toolKey, num } = require('../names')

const HOOK_FIELDS = [
  'hook_event_name', 'session_id', 'transcript_path', 'tool_name', 'tool_use_id', 'duration_ms',
  'agent_id', 'agent_type', 'trigger', 'notification_type', 'source', 'model'
]

// Keep only the metadata of a hook payload. Prompt text, tool input and
// output, and assistant messages never leave this function.
function hookMeta (body) {
  const m = {}
  for (const k of HOOK_FIELDS) if (body[k] !== undefined && typeof body[k] !== 'object') m[k] = body[k]
  return m
}

// Tool class for the visualization: 0 other, 1 read, 2 edit, 3 shell,
// 4 web, 5 agent.
function toolClass (name) {
  const n = String(name || '')
  if (/^(Read|Grep|Glob|LS|NotebookRead)$/.test(n)) return 1
  if (/^(Edit|MultiEdit|Write|NotebookEdit)$/.test(n)) return 2
  if (/^(Bash|BashOutput|KillShell|KillBash)$/.test(n)) return 3
  if (/^(WebFetch|WebSearch)$/.test(n)) return 4
  if (/^(Agent|Task)$/.test(n)) return 5
  return 0
}

// The one sum of an API usage block: used = input + cache write + cache
// read (decision 0012). Serves the statusline, the fallback and totals.
function usage (u) {
  const uncached = u.input_tokens || 0
  const write = u.cache_creation_input_tokens || 0
  const read = u.cache_read_input_tokens || 0
  return { uncached, write, read, output: u.output_tokens || 0, used: uncached + write + read }
}

function contextFrom (cu, window, threshold) {
  const out = []
  if (!cu) {
    for (const k of ['used_tokens', 'used_pct', 'compact_left_pct', 'uncached', 'cache_read', 'cache_write', 'output']) out.push(['context.' + k, null])
    return out
  }
  const { uncached, write, read, output, used } = usage(cu)
  out.push(['context.uncached', uncached], ['context.cache_write', write], ['context.cache_read', read],
    ['context.output', output], ['context.used_tokens', used])
  out.push(['context.used_pct', window ? used / window * 100 : null])
  out.push(['context.compact_left_pct', threshold ? Math.max(0, (1 - used / threshold) * 100) : null])
  return out
}

// compaction: compact.inputs(). The context family only when the
// payload carries the window size.
function fromStatusline (j, compaction) {
  const out = []
  const cw = j.context_window || {}
  const window = num(cw.context_window_size)
  if (window !== null) {
    const threshold = compact.threshold(window, compaction)
    out.push(['context.window', window], ['context.window_inferred', 0], ['context.compact_threshold', threshold],
      ['context.compact_at_pct', threshold ? threshold / window * 100 : null])
    out.push(...contextFrom(cw.current_usage || null, window, threshold))
  }
  const cost = j.cost || {}
  out.push(['cost.usd', num(cost.total_cost_usd)], ['lines.added', num(cost.total_lines_added)],
    ['lines.removed', num(cost.total_lines_removed)])
  if (j.prompt_cache) out.push(['cache.hit_ratio', num(j.prompt_cache.hit_ratio)])
  const rl = j.rate_limits || {}
  out.push(['limits.five_hour_pct', rl.five_hour ? num(rl.five_hour.used_percentage) : null],
    ['limits.five_hour_resets_at', rl.five_hour ? num(rl.five_hour.resets_at) : null],
    ['limits.seven_day_pct', rl.seven_day ? num(rl.seven_day.used_percentage) : null],
    ['limits.seven_day_resets_at', rl.seven_day ? num(rl.seven_day.resets_at) : null])
  // A gateway session's spend limit, absent elsewhere.
  const sl = rl.spend_limit
  if (sl) {
    out.push(['limits.spend_pct', num(sl.used_percentage)], ['limits.spend_resets_at', num(sl.resets_at)],
      ['limits.spend_usd', num(sl.used_usd)], ['limits.spend_limit_usd', num(sl.limit_usd)])
  }
  if (j.model && j.model.display_name) out.push(['model.name', String(j.model.display_name).slice(0, 40)])
  return out
}

// Hook metadata to bus operations: ['set'|'add'|'pulse', name, value].
// agents.active is the core's own count.
function fromHook (m) {
  const ops = []
  switch (m.hook_event_name) {
    case 'PreToolUse':
      ops.push(['pulse', 'event.tool'], ['add', 'tools.total', 1])
      if (m.tool_name) ops.push(['add', toolKey(m.tool_name), 1])
      break
    case 'SubagentStart':
      ops.push(['pulse', 'event.agent'])
      break
    case 'UserPromptSubmit':
      ops.push(['set', 'state.busy', 1], ['pulse', 'event.prompt'])
      break
    case 'Stop':
      ops.push(['set', 'state.busy', 0], ['pulse', 'event.stop'])
      break
    case 'PostCompact':
      ops.push(['pulse', 'event.compact'], ['add', 'session.compactions', 1])
      break
  }
  return ops
}

// Transcript accumulator. One API response spans several lines that
// repeat its usage, so each message.id counts once (its latest usage).
class TranscriptTotals {
  constructor () {
    this.seen = new Map()
    this.totals = { in: 0, out: 0, read: 0, write: 0 }
    this.last = null
    this.model = null
  }

  // Returns the output-token delta this line added, for the rate meter,
  // or null when the line is not a main-chain response with usage.
  add (obj) {
    if (!obj || obj.type !== 'assistant' || obj.isSidechain) return null
    const msg = obj.message || {}
    const u = msg.usage
    if (!msg.id || !u) return null
    const s = usage(u)
    const cur = { in: s.used, out: s.output, read: s.read, write: s.write }
    const prev = this.seen.get(msg.id) || { in: 0, out: 0, read: 0, write: 0 }
    for (const k of Object.keys(cur)) this.totals[k] += cur[k] - prev[k]
    this.seen.set(msg.id, cur)
    this.last = u
    if (msg.model) this.model = msg.model
    return cur.out - prev.out
  }

  metrics () {
    const t = this.totals
    return [['tokens.in', t.in], ['tokens.out', t.out], ['tokens.cache_read', t.read], ['tokens.cache_write', t.write]]
  }

  hitRatio () {
    return this.totals.in ? this.totals.read / this.totals.in : null
  }
}

// The agent's task list as the transcript shows it (decision 0034).
// A TodoWrite call replaces it whole, a TaskCreate adds an item, a
// TaskUpdate changes or deletes one, and a markdown task list in an
// assistant text replaces it. An item is { id, text, state }, state
// todo, doing or done. Sidechain lines are a subagent's.
const STATE = { pending: 'todo', in_progress: 'doing', completed: 'done' }
const TEXT_MAX = 200
const TASK_LINE = /^[ \t]*[-*+][ \t]+\[([ xX])\][ \t]+(\S.*)$/gm

const text = s => String(s === undefined || s === null ? '' : s).trim().slice(0, TEXT_MAX)

class Checklist {
  constructor () {
    this.items = []
    // TaskCreate calls whose result, which names the task's id, is
    // yet to come, by tool_use id.
    this.pending = new Map()
    this.created = 0
  }

  // One transcript line. True when the list changed.
  add (obj) {
    if (!obj || typeof obj !== 'object' || obj.isSidechain) return false
    const msg = obj.message || {}
    const content = Array.isArray(msg.content) ? msg.content : []
    let changed = false
    if (obj.type === 'assistant') {
      for (const b of content) {
        if (!b || typeof b !== 'object') continue
        if (b.type === 'tool_use') changed = this.toolUse(b) || changed
        else if (b.type === 'text' && typeof b.text === 'string') changed = this.markdown(b.text) || changed
      }
    } else if (obj.type === 'user') {
      const r = obj.toolUseResult
      const task = r && typeof r === 'object' && r.task && typeof r.task === 'object' ? r.task : null
      for (const b of content) {
        if (!b || b.type !== 'tool_result' || !this.pending.has(b.tool_use_id)) continue
        const item = this.pending.get(b.tool_use_id)
        this.pending.delete(b.tool_use_id)
        if (task && task.id !== undefined && task.id !== null) item.id = String(task.id)
      }
    }
    return changed
  }

  toolUse (b) {
    const input = b.input && typeof b.input === 'object' ? b.input : {}
    if (b.name === 'TodoWrite') {
      if (!Array.isArray(input.todos)) return false
      this.items = input.todos.filter(t => t && typeof t === 'object')
        .map((t, i) => ({ id: String(i + 1), text: text(t.content !== undefined ? t.content : t.activeForm), state: STATE[t.status] || 'todo' }))
      this.pending.clear()
      return true
    }
    if (b.name === 'TaskCreate') {
      if (typeof input.subject !== 'string') return false
      const item = { id: String(++this.created), text: text(input.subject), state: 'todo' }
      this.items.push(item)
      if (typeof b.id === 'string') this.pending.set(b.id, item)
      return true
    }
    if (b.name === 'TaskUpdate') {
      const item = this.items.find(i => i.id === String(input.taskId))
      if (!item) return false
      if (input.status === 'deleted') {
        this.items = this.items.filter(i => i !== item)
        return true
      }
      let changed = false
      if (STATE[input.status] && STATE[input.status] !== item.state) { item.state = STATE[input.status]; changed = true }
      if (typeof input.subject === 'string' && text(input.subject) !== item.text) { item.text = text(input.subject); changed = true }
      return changed
    }
    return false
  }

  markdown (s) {
    const items = []
    for (const m of s.matchAll(TASK_LINE)) items.push({ id: String(items.length + 1), text: text(m[2]), state: /x/i.test(m[1]) ? 'done' : 'todo' })
    if (!items.length) return false
    this.items = items
    this.pending.clear()
    return true
  }

  metrics () {
    const items = this.items.map(i => ({ text: i.text, state: i.state }))
    return [['checklist.items', items], ['checklist.count', items.length], ['checklist.done', items.filter(i => i.state === 'done').length]]
  }
}

module.exports = { toolClass, hookMeta, fromStatusline, fromHook, usage, contextFrom, TranscriptTotals, Checklist }
