'use strict'
// The options a new tab carries from the window's command (decision
// 0023). table: option name -> arity: 0 a flag, 1 one value, '?' an
// optional value, '+' one or more values. An option the table lacks is
// dropped, and so is every operand: a prompt, a session id, a
// subcommand, all that follows --. The values are taken as the CLIs take
// them: arity 1 the next token whatever it is, '?' and '+' the tokens
// that do not start with -. --name=value and a short option's attached
// value (-mo3) stay one token.

function pick (argv, table) {
  const args = []
  const dropped = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--') {
      dropped.push(...argv.slice(i))
      break
    }
    if (!a.startsWith('-') || a === '-') {
      dropped.push(a)
      continue
    }
    const long = a.startsWith('--')
    const eq = long ? a.indexOf('=') : -1
    let arity = table[eq > 0 ? a.slice(0, eq) : a]
    let attached = eq > 0
    if (arity === undefined && !long && a.length > 2 && table[a.slice(0, 2)] === 1) {
      arity = 1
      attached = true
    }
    if (arity === undefined) {
      dropped.push(a)
      continue
    }
    args.push(a)
    if (attached) continue
    const more = () => i + 1 < argv.length && !argv[i + 1].startsWith('-')
    if (arity === 1 && i + 1 < argv.length) args.push(argv[++i])
    else if (arity === '?' && more()) args.push(argv[++i])
    else if (arity === '+') while (more()) args.push(argv[++i])
  }
  return { args, dropped }
}

module.exports = { pick }
