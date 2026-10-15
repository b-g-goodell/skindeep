'use strict'
// The metric vocabulary skins bind to (decision 0011). docs/SKINS.md
// documents each name, its unit and its channel.

const NAMES = {
  'context.used_pct': 'percent of the context window in use',
  'context.used_tokens': 'tokens in the context window',
  'context.window': 'context window size in tokens',
  'context.window_inferred': '1 when the window size is inferred, 0 when read',
  'context.compact_threshold': 'tokens at which auto-compact fires',
  'context.compact_at_pct': 'auto-compact threshold as a percent of the window',
  'context.compact_left_pct': 'percent of the way left before auto-compact',
  'context.uncached': 'context tokens sent uncached',
  'context.cache_read': 'context tokens read from the prompt cache',
  'context.cache_write': 'context tokens written to the prompt cache',
  'context.output': 'output tokens of the last response',
  'tokens.in': 'input tokens this session, cached and uncached',
  'tokens.out': 'output tokens this session',
  'tokens.cache_read': 'cache-read input tokens this session',
  'tokens.cache_write': 'cache-write input tokens this session',
  'tokens.out_rate': 'output tokens per second over the last 10 s',
  'cache.hit_ratio': 'share of input read from the prompt cache, 0 to 1',
  'cost.usd': 'session cost in US dollars as the CLI reports it',
  'limits.five_hour_pct': 'percent of the five-hour usage limit used',
  'limits.five_hour_resets_at': 'when the five-hour limit resets, Unix seconds',
  'limits.seven_day_pct': 'percent of the seven-day usage limit used',
  'limits.seven_day_resets_at': 'when the seven-day limit resets, Unix seconds',
  'limits.spend_pct': 'percent of a gateway session\'s spend limit used',
  'limits.spend_usd': 'US dollars spent against a gateway session\'s spend limit',
  'limits.spend_limit_usd': 'a gateway session\'s spend limit in US dollars',
  'limits.spend_resets_at': 'when a gateway session\'s spend limit resets, Unix seconds',
  'tools.total': 'tool calls this session',
  'tools.rate': 'tool calls in the last 60 s',
  'agents.active': 'subagents running now',
  'lines.added': 'lines added this session',
  'lines.removed': 'lines removed this session',
  'state.busy': '1 while the agent works on a prompt, else 0',
  'model.name': 'model name (text)',
  'session.clock_s': 'seconds since launch',
  'session.compactions': 'compactions this session',
  'checklist.items': 'the agent\'s task list, [{ text, state }], state todo, doing or done',
  'checklist.count': 'items of the agent\'s task list',
  'checklist.done': 'items of the agent\'s task list that are done',
  'pty.out_bps': 'terminal output bytes per second',
  'pty.in_kps': 'input writes (keys, pastes) per second',
  'pty.idle_s': 'seconds since the last terminal output',
  'proc.cpu_pct': 'CPU percent of the CLI process tree',
  'proc.mem_mb': 'resident memory of the CLI process tree in MiB',
  'event.output': 'counter: output bursts',
  'event.tool': 'counter: tool calls',
  'event.prompt': 'counter: prompts submitted',
  'event.stop': 'counter: turns finished',
  'event.compact': 'counter: compactions',
  'event.agent': 'counter: subagents started'
}

// The names whose value is a list, not a number (decision 0034).
const LISTS = new Set(['checklist.items'])

function isList (name) {
  return LISTS.has(name)
}

// The metric of tool `name`: tools.<Name>, unsafe characters as _.
function toolKey (name) {
  return 'tools.' + String(name).replace(/[^A-Za-z0-9_]/g, '_').slice(0, 64)
}

// A finite number, else null (no data).
function num (v) {
  return typeof v === 'number' && isFinite(v) ? v : null
}

function known (name) {
  return Object.prototype.hasOwnProperty.call(NAMES, name) || /^tools\.[A-Za-z0-9_]{1,64}$/.test(name)
}

module.exports = { NAMES, LISTS, isList, known, toolKey, num }
