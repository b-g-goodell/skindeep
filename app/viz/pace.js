'use strict'
// The visualization's frame rate cap (decision 0036): which of the
// display's frames the page draws. Each frame drawn is due one gap of
// 1000 / fps ms after the one before was due, so the frames drawn keep
// to the cap over any run, and a frame up to SLACK ms early counts as on
// time, so that the jitter of the display's clock does not skip one. A
// loop more than a gap behind starts again from now. The modes advance
// by the time since the frame drawn before, so a cap draws fewer frames
// and changes no mode's speed. Loaded by the viz page and by the tests.

;(function (root) {
  const SLACK = 2

  // now: the display frame's time in ms. next: the time from which a
  // frame is due, 0 at first. fps: the cap, 0 or null for none.
  // Returns whether to draw this frame and the next due time.
  function due (now, next, fps) {
    if (!(fps > 0)) return { draw: true, next: now }
    const gap = 1000 / fps
    if (now < next - SLACK) return { draw: false, next }
    return { draw: true, next: now - next > gap ? now + gap : next + gap }
  }

  const api = { due, SLACK }
  if (typeof module === 'object' && module.exports) module.exports = api
  else root.VizPace = api
})(this)
