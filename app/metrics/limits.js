'use strict'
// The usage limits as one list, limits.items (decision 0011): every
// limit the provider sends now, account-wide first, then each model's.
// An item is { key, label, window, model, pct, resets_at }: window a
// short span such as 5h, 7d or 30d (null for a spend limit), model the
// provider's name for the model or null, pct the percent used, resets_at
// Unix seconds or null. A limit with no reading is no item.

const { num } = require('./names')

// A window of `minutes` as a short span: 300 is 5h, 10080 is 7d.
function span (minutes) {
  const m = num(minutes)
  if (m === null || m <= 0) return null
  if (m % 1440 === 0) return `${m / 1440}d`
  if (m % 60 === 0) return `${m / 60}h`
  return `${m}m`
}

// One item, or null when pct is not a number. The label is the model
// and the window, such as "Spark 5h", unless one is given.
function item ({ key, window, model, label, pct, resetsAt }) {
  const p = num(pct)
  if (p === null) return null
  const l = label || [model, window].filter(Boolean).join(' ') || key
  return { key, label: l, window: window || null, model: model || null, pct: p, resets_at: num(resetsAt) }
}

// limits.items from the items found, null when none.
function list (items) {
  const out = items.filter(Boolean)
  return out.length ? out : null
}

module.exports = { span, item, list }
