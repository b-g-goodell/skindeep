'use strict'
// The failure rate of each live check, read from the outcome log the
// suite appends to (scripts/checks/passrecord.js), so a flaky check
// can be told from a broken one and run N times against a threshold.
//   node scripts/checks/flaky.js [--tree HEAD|<tree>|all] [--json]
// Only runs on a clean tree count. --tree: the tree whose runs count,
// default all. A rate pooled over trees mixes code states: repeat runs
// at one tree give the clean sample.
const path = require('path')
const passrecord = require('./passrecord')

const mean = xs => xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length * 10) / 10 : null

// Per job: runs, fails (timeouts among them), rate, trees, and the
// mean load at the start of passes and of failures. Highest rate first.
function summarize (outcomes, { tree = null } = {}) {
  const by = new Map()
  for (const o of outcomes) {
    if (o.dirty || (tree && o.tree !== tree)) continue
    if (!by.has(o.job)) by.set(o.job, [])
    by.get(o.job).push(o)
  }
  const rows = [...by].map(([job, os]) => {
    const bad = os.filter(o => o.outcome !== 'pass')
    const good = os.filter(o => o.outcome === 'pass')
    return {
      job,
      runs: os.length,
      fails: bad.length,
      timeouts: bad.filter(o => o.outcome === 'timeout').length,
      rate: Math.round(bad.length / os.length * 1000) / 1000,
      trees: new Set(os.map(o => o.tree)).size,
      loadPass: mean(good.map(o => o.load)),
      loadFail: mean(bad.map(o => o.load))
    }
  })
  return rows.sort((a, b) => b.rate - a.rate || b.runs - a.runs || a.job.localeCompare(b.job))
}

function main () {
  const argv = process.argv.slice(2)
  let tree = null
  let json = false
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--tree') tree = argv[++i]
    else if (argv[i] === '--json') json = true
    else throw new Error('usage: node scripts/checks/flaky.js [--tree HEAD|<tree>|all] [--json]')
  }
  const root = path.join(__dirname, '..', '..')
  if (tree === 'all') tree = null
  else if (tree === 'HEAD') tree = passrecord.tree(root)
  const rows = summarize(passrecord.outcomes(root), { tree })
  if (json) return console.log(JSON.stringify(rows))
  console.log(`${passrecord.outcomeLog(root)}, ${tree ? `tree ${tree}` : 'all trees'}, clean runs only`)
  console.log('job runs fails timeouts rate trees load-pass load-fail')
  for (const r of rows) console.log([r.job, r.runs, r.fails, r.timeouts, r.rate, r.trees, r.loadPass ?? '-', r.loadFail ?? '-'].join(' '))
}

if (require.main === module) {
  try { main() } catch (e) { console.error(e.message); process.exit(2) }
}

module.exports = { summarize }
