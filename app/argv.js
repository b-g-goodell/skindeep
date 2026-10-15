'use strict'
// The command line of New tab... (decision 0025) split into argv as a
// shell splits words, with no shell: blanks separate words, '...' is
// literal, "..." keeps \" \\ \$ \` as escapes, and a backslash outside
// quotes takes the next character. Nothing expands: no ~, $VAR, glob or
// redirection. The inverse of identity.quote for every word it quotes.

function split (line) {
  const argv = []
  let word = null
  let i = 0
  const s = String(line)
  while (i < s.length) {
    const c = s[i]
    if (c === ' ' || c === '\t' || c === '\n') {
      if (word !== null) argv.push(word)
      word = null
      i++
    } else if (c === "'") {
      const end = s.indexOf("'", i + 1)
      if (end < 0) return { error: 'unclosed single quote' }
      word = (word || '') + s.slice(i + 1, end)
      i = end + 1
    } else if (c === '"') {
      word = word || ''
      i++
      for (;;) {
        if (i >= s.length) return { error: 'unclosed double quote' }
        const d = s[i]
        if (d === '"') break
        if (d === '\\' && i + 1 < s.length && '"\\$`'.includes(s[i + 1])) {
          word += s[i + 1]
          i += 2
        } else {
          word += d
          i++
        }
      }
      i++
    } else if (c === '\\') {
      if (i + 1 >= s.length) return { error: 'a backslash ends the line' }
      word = (word || '') + s[i + 1]
      i += 2
    } else {
      word = (word || '') + c
      i++
    }
  }
  if (word !== null) argv.push(word)
  if (!argv.length) return { error: 'the command line is empty' }
  return { argv }
}

module.exports = { split }
