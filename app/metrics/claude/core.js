'use strict'
// The Claude session as its three channels describe it: which session
// and transcript are current, what a change resets, which lines are
// history, which source wins each metric, the subagent count (decisions
// 0009, 0011, 0012). It takes
// hook, statusline and transcript payloads in arrival order and writes
// through a writer source. No I/O, no clock: the writer owns the rates.

const parse = require('./parse')
const compact = require('./compact')
const { titleOf } = require('./title')
const { EVENT } = require('../bus')

// What the core's writer source declares. The hook-fed defaults and
// tools.rate only when the hooks were injected (decision 0009). The
// output rate begins with the first payload, and every Claude Code
// payload names the transcript.
function source (facts) {
  return facts.hooks
    ? { defaults: { 'tools.total': 0, 'agents.active': 0, 'state.busy': 0 }, rates: ['tokens.out_rate', 'tools.rate'] }
    : { rates: ['tokens.out_rate'] }
}

const KINDS = { PreToolUse: EVENT.tool, UserPromptSubmit: EVENT.prompt, Stop: EVENT.stop, SubagentStart: EVENT.agent, PostCompact: EVENT.compact }

const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v)

// A statusline payload claims each of these it carries, for the rest of
// the session: the context family as one, model.name, cache.hit_ratio.
// The transcript writes a metric only while it is unclaimed.
const claimOf = name => name.startsWith('context.') ? 'context' : (name === 'model.name' || name === 'cache.hit_ratio') ? name : null

class ClaudeCore {
  // src: a writer source made from source(facts). facts, frozen at
  // prepare: { hooks, statusline, compaction, log }. hooks, statusline:
  // true when injected and not silenced by managed settings.
  // compaction: compact.inputs(). log: one line.
  constructor (src, facts) {
    this.src = src
    this.facts = facts
    this.session = null
    this.transcript = null
    // The session's custom title from its transcript (decision 0032).
    this.title = null
    this.totals = new parse.TranscriptTotals()
    this.checklist = new parse.Checklist()
    this.claims = new Set()
    this.agents = 0
    this.quiet()
  }

  // Per session: Stop hooks seen while the statusline stays silent.
  quiet () {
    this.stops = 0
    this.statusSeen = false
  }

  // Session and transcript of a payload. A payload without a session id
  // is not placed in any session and is ignored.
  enter (j) {
    if (!isObject(j) || typeof j.session_id !== 'string' || !j.session_id) return false
    if (this.session && j.session_id !== this.session) {
      this.src.reset()
      this.totals = new parse.TranscriptTotals()
      this.checklist = new parse.Checklist()
      this.claims.clear()
      this.agents = 0
      this.title = null
      this.quiet()
    }
    this.session = j.session_id
    this.src.begin()
    if (typeof j.transcript_path === 'string' && j.transcript_path && j.transcript_path !== this.transcript) {
      this.transcript = j.transcript_path
      this.totals = new parse.TranscriptTotals()
      this.checklist = new parse.Checklist()
    }
    return true
  }

  // A hook payload when no hooks were injected is not this session's.
  hook (body) {
    if (!this.facts.hooks || !this.enter(body)) return
    const m = parse.hookMeta(body)
    for (const [op, name, v] of parse.fromHook(m)) {
      if (op === 'set') this.src.set(name, v)
      else if (op === 'add') this.src.add(name, v)
      else this.src.pulse(name)
    }
    const ev = m.hook_event_name
    const kind = KINDS[ev]
    if (kind) this.src.event(kind, kind === EVENT.tool ? parse.toolClass(m.tool_name) : 0)
    if (ev === 'PreToolUse') this.src.sample('tools.rate', 1)
    // The statusline runs at least once a turn. Silent through two turns,
    // something overrides it, such as remote managed settings.
    if (ev === 'Stop' && this.facts.statusline && !this.statusSeen && ++this.stops === 2 && this.facts.log) {
      this.facts.log(`claude adapter: session ${this.session}: the injected statusline stayed silent through two turns, so managed settings may override it`)
    }
    if (ev === 'SubagentStart' || ev === 'SubagentStop') {
      this.agents = Math.max(0, this.agents + (ev === 'SubagentStart' ? 1 : -1))
      this.src.set('agents.active', this.agents)
    }
  }

  statusline (j) {
    if (!this.enter(j)) return
    this.statusSeen = true
    for (const [k, v] of parse.fromStatusline(j, this.facts.compaction)) {
      const c = claimOf(k)
      if (c) this.claims.add(c)
      this.src.set(k, v)
    }
  }

  // One line of the transcript `file`. replayed: the line was in the file
  // when the tail started.
  line (file, obj, replayed) {
    if (!this.transcript || file !== this.transcript || !isObject(obj)) return
    const t = titleOf(obj, this.session)
    if (t) this.title = t
    if (this.checklist.add(obj)) for (const [k, v] of this.checklist.metrics()) this.src.set(k, v)
    const dOut = this.totals.add(obj)
    if (dOut === null) return
    if (dOut > 0) this.src.sample('tokens.out_rate', dOut, { history: replayed })
    for (const [k, v] of this.totals.metrics()) this.src.set(k, v)
    if (this.totals.model && !this.claims.has('model.name')) this.src.set('model.name', this.totals.model)
    if (!this.claims.has('cache.hit_ratio')) this.src.set('cache.hit_ratio', this.totals.hitRatio())
    if (!this.claims.has('context')) this.fallbackContext()
  }

  // Context figures from the transcript when no statusline runs.
  fallbackContext () {
    const c = this.facts.compaction
    const last = this.totals.last
    const window = compact.window(c, last ? parse.usage(last).used : 0)
    const threshold = compact.threshold(window, c)
    this.src.set('context.window', window)
    this.src.set('context.window_inferred', 1)
    this.src.set('context.compact_threshold', threshold)
    this.src.set('context.compact_at_pct', threshold ? threshold / window * 100 : null)
    for (const [k, v] of parse.contextFrom(last, window, threshold)) this.src.set(k, v)
  }
}

module.exports = { ClaudeCore, source }
