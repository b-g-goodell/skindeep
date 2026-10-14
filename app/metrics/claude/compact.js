'use strict'
// The auto-compact rule of the 2.1.296 binary and its inputs (decision
// 0012). The settings writer keeps only COMPACT_KEYS of a settings env
// block and returns inputs(), the core applies window() and threshold().

const COMPACT_KEYS = ['CLAUDE_CODE_AUTO_COMPACT_WINDOW', 'DISABLE_AUTO_COMPACT', 'DISABLE_COMPACT']

// "400000", "400k", "1M" -> tokens, else null.
function parseTokens (s) {
  const m = /^(\d+(?:\.\d+)?)([kKmM]?)$/.exec(String(s || '').trim())
  if (!m) return null
  return Math.round(Number(m[1]) * ({ k: 1e3, K: 1e3, m: 1e6, M: 1e6 }[m[2]] || 1))
}

function truthy (v) {
  return v !== undefined && v !== '' && v !== '0' && String(v).toLowerCase() !== 'false'
}

function keys (e) {
  const out = {}
  if (e && typeof e === 'object') for (const k of COMPACT_KEYS) if (typeof e[k] === 'string') out[k] = e[k]
  return out
}

// Value of `--autocompact V` or `--autocompact=V` in argv.
function autocompactArg (argv) {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--autocompact') return argv[i + 1]
    if (argv[i].startsWith('--autocompact=')) return argv[i].slice(14)
  }
  return undefined
}

// sources: settings data, lowest priority first, each { env,
// autoCompactWindow }. argv: the child's arguments. env: the child's
// environment, of which only COMPACT_KEYS are read.
// compactWindow, highest first: env CLAUDE_CODE_AUTO_COMPACT_WINDOW (the
// child's, then a settings env block), --autocompact, autoCompactWindow
// of the highest source that sets it. Null when none is configured.
function inputs ({ sources = [], argv = [], env = {} }) {
  const child = keys(env)
  const settingsEnv = {}
  let settingsWindow = null
  for (const s of sources) {
    Object.assign(settingsEnv, keys(s.env))
    if (typeof s.autoCompactWindow === 'number' && isFinite(s.autoCompactWindow)) settingsWindow = s.autoCompactWindow
  }
  const disabled = [child, settingsEnv].some(e => truthy(e.DISABLE_AUTO_COMPACT) || truthy(e.DISABLE_COMPACT))
  const compactWindow = parseTokens(child.CLAUDE_CODE_AUTO_COMPACT_WINDOW || settingsEnv.CLAUDE_CODE_AUTO_COMPACT_WINDOW) ||
    parseTokens(autocompactArg(argv)) || settingsWindow
  return Object.freeze({ compactWindow: compactWindow || null, disabled })
}

// The window when no statusline reports it: compactWindow when
// configured, else 200000 unless usage exceeded it, then 1000000.
function window (inp, used) {
  return inp.compactWindow || (used > 200000 ? 1000000 : 200000)
}

// W = compactWindow - min(maxOutput, 20000), threshold = W - 13000, with
// compactWindow capped at the window. Null when compaction is disabled.
function threshold (win, inp) {
  if (!win || inp.disabled) return null
  return Math.min(inp.compactWindow || win, win) - 20000 - 13000
}

module.exports = { COMPACT_KEYS, inputs, window, threshold }
