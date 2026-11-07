'use strict'
// A provider's peak price hours from its published schedule (decision
// 0038), computed here with no request. A schedule is { days, hours,
// holidays }: days the UTC weekdays it runs (0 Sunday), hours the UTC
// spans ["HH:MM", "HH:MM") of each, holidays { offset_minutes, through,
// dates } the calendar days, in the zone offset_minutes east of UTC,
// on which it does not run, listed up to `through`. Past `through` the
// holidays are unknown, so the state is too: no reading.

const DAY = 86400000
const MIN = 60000

const minutes = s => Number(s.slice(0, 2)) * 60 + Number(s.slice(3))
const ymd = t => new Date(t).toISOString().slice(0, 10)

// The first instant past the holiday list, or Infinity with none.
function coverageEnd (s) {
  const h = s.holidays
  if (!h) return Infinity
  return Date.parse(h.through + 'T00:00:00Z') + DAY - h.offset_minutes * MIN
}

function inPeak (s, t) {
  const d = new Date(t)
  if (!s.days.includes(d.getUTCDay())) return false
  const m = d.getUTCHours() * 60 + d.getUTCMinutes()
  if (!s.hours.some(([a, b]) => m >= minutes(a) && m < minutes(b))) return false
  const h = s.holidays
  return !(h && h.dates.includes(ymd(t + h.offset_minutes * MIN)))
}

// At t (ms): { peak: 1 or 0, changes_at: Unix seconds of the next
// switch, or null when that falls past the holiday list }, or null with
// no schedule or past the list.
function state (s, t) {
  if (!s) return null
  const end = coverageEnd(s)
  if (t >= end) return null
  const now = inPeak(s, t)
  // Every instant the state can switch at: each span's edges on each
  // UTC day, and each midnight of the holidays' zone.
  const day0 = Math.floor(t / DAY) * DAY
  const marks = []
  for (let k = 0; k <= 15; k++) {
    const d = day0 + k * DAY
    for (const [a, b] of s.hours) marks.push(d + minutes(a) * MIN, d + minutes(b) * MIN)
    if (s.holidays) marks.push(d - s.holidays.offset_minutes * MIN)
  }
  marks.sort((a, b) => a - b)
  let at = null
  for (const m of marks) {
    if (m <= t) continue
    if (m >= end) break
    if (inPeak(s, m) !== now) { at = m; break }
  }
  return { peak: now ? 1 : 0, changes_at: at === null ? null : Math.floor(at / 1000) }
}

module.exports = { state, inPeak, coverageEnd }
