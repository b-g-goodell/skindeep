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
    ['limits.seven_day_pct', rl.seven_day ? num(rl.seven_day.used_percentage) : null])
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

module.exports = { toolClass, hookMeta, fromStatusline, fromHook, usage, contextFrom, TranscriptTotals }
