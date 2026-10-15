'use strict'
// Butterchurn presets written by this project (decision 0015). Bass
// follows terminal output, mid follows tool calls, treble follows token
// rate and prompt chirps, as the synthesiser builds them. stardust and
// whirlpool recreate the look of two presets by Ryan Geiss from his
// screenshots named cosmic dust and vortex, with no line of the
// originals: a swarm of small green-gold dots in a slow dim vortex, and
// copper spiral arms wound from jagged white scribbles.

window.VizPresets = (function () {
  const WARP = 'shader_body {\nret = texture2D(sampler_main, uv).rgb;\nret -= 0.004;\n}\n'
  const COMP = 'shader_body {\nret = texture2D(sampler_main, uv).rgb;\nret *= hue_shader;\n}\n'

  function preset (baseVals, frame, pixel, extra) {
    return Object.assign({
      baseVals,
      shapes: [],
      waves: [],
      init_eqs_str: 'a.q1 = 0;',
      frame_eqs_str: frame,
      pixel_eqs_str: pixel || '',
      warp: WARP,
      comp: COMP
    }, extra || {})
  }

  const drift = preset({
    decay: 0.97, gammaadj: 1.9, wave_mode: 2, additivewave: 1, wave_a: 0.9, wave_scale: 1.4, wave_smoothing: 0.5,
    wave_r: 0.4, wave_g: 0.9, wave_b: 0.6, zoom: 1.02, warp: 0.3, warpscale: 1.6, warpanimspeed: 1.2,
    darken_center: 1, ob_size: 0.005, ob_a: 0.4, ob_r: 0.1, ob_g: 0.6, ob_b: 0.3
  },
  'a.q1 = 0.9*a.q1 + 0.1*a.mid_att;' +
  'a.zoom = 1.01 + 0.05*a.bass_att;' +
  'a.rot = 0.015*Math.sin(a.time*0.4) + 0.04*a.q1;' +
  'a.wave_r = 0.5 + 0.5*Math.sin(a.time*0.7);' +
  'a.wave_g = 0.6 + 0.4*Math.sin(a.time*0.53 + 1.3);' +
  'a.wave_b = 0.4 + 0.6*a.treb_att;' +
  'a.warp = 0.2 + 0.6*a.mid_att;',
  'a.zoom = a.zoom + 0.03*a.rad*a.bass;' +
  'a.rot = a.rot + 0.02*Math.sin(a.ang*3 + a.time)*a.mid;')

  const rings = preset({
    decay: 0.94, gammaadj: 2.0, wave_mode: 0, additivewave: 1, wave_a: 1.0, wave_scale: 0.9, wave_smoothing: 0.7,
    wave_thick: 1, zoom: 0.97, rot: 0.02, warp: 0.05, echo_zoom: 1.0, brighten: 0,
    ib_size: 0.01, ib_a: 0.3, ib_r: 0.2, ib_g: 0.2, ib_b: 0.8
  },
  'a.zoom = 0.96 + 0.04*a.bass_att;' +
  'a.rot = 0.03*Math.cos(a.time*0.3) + 0.05*a.mid;' +
  'a.wave_r = 0.5 + 0.5*Math.sin(a.time*1.1);' +
  'a.wave_g = 0.5 + 0.5*Math.sin(a.time*0.9 + 2);' +
  'a.wave_b = 0.5 + 0.5*Math.sin(a.time*0.7 + 4);' +
  'a.cx = 0.5 + 0.1*Math.sin(a.time*0.21);' +
  'a.cy = 0.5 + 0.1*Math.cos(a.time*0.17);',
  'a.dx = 0.005*Math.sin(a.y*12 + a.time)*a.treb;' +
  'a.dy = 0.005*Math.cos(a.x*12 + a.time)*a.treb;')

  const plasma = preset({
    decay: 0.99, gammaadj: 1.6, wave_mode: 6, additivewave: 1, wave_a: 0.6, wave_scale: 2.0, wave_smoothing: 0.3,
    zoom: 1.0, warp: 1.0, warpscale: 3.0, warpanimspeed: 2.0, mv_a: 0, darken: 1,
    ob_size: 0.02, ob_a: 0.15
  },
  'a.warp = 0.5 + 1.5*a.bass_att;' +
  'a.zoom = 1.0 + 0.02*Math.sin(a.time*0.6) + 0.03*a.treb;' +
  'a.wave_r = 0.6 + 0.4*Math.sin(a.time*0.31);' +
  'a.wave_g = 0.3 + 0.3*a.mid_att;' +
  'a.wave_b = 0.7 + 0.3*Math.sin(a.time*0.43 + 1);',
  'a.rot = 0.04*Math.sin(a.rad*6 - a.time*1.5)*(0.3 + a.mid);' +
  'a.sx = 1 + 0.02*Math.sin(a.ang*2 + a.time)*a.bass;')

  // A swarm of dots: each frame, `samples` dots at random places, dimmer
  // or brighter at random, added to what is there. thick: 1 for 2 px dots.
  function dots (samples, r, g, b, frame, thick) {
    return {
      baseVals: { enabled: 1, samples, usedots: 1, thick, additive: 1, scaling: 1, smoothing: 0, r, g, b, a: 0.6 },
      init_eqs_str: '',
      frame_eqs_str: frame,
      point_eqs_str: 'a.x = Math.random(); a.y = Math.random(); a.a = a.a*(0.25 + 0.75*Math.random());'
    }
  }

  const stardust = preset({
    decay: 0.95, gammaadj: 1.4, wave_a: 0, zoom: 1.004, warp: 0.45, warpscale: 2.4, warpanimspeed: 0.4,
    mv_a: 0, echo_zoom: 1, wrap: 1
  },
  'a.q1 = 0.95*a.q1 + 0.05*(a.bass_att + a.mid_att);' +
  'a.cx = 0.5 + 0.12*Math.sin(a.time*0.11);' +
  'a.cy = 0.5 + 0.10*Math.cos(a.time*0.083);' +
  'a.warp = 0.3 + 0.5*a.mid_att;',
  'a.rot = 0.012 + 0.03*Math.max(0, 0.7 - a.rad)*(0.6 + a.q1);' +
  'a.zoom = a.zoom + 0.012*a.rad*a.bass;',
  {
    waves: [
      dots(200, 0.85, 0.95, 0.45, 'a.a = 0.3 + 0.25*a.treb_att + 0.15*a.bass;', 1),
      dots(120, 0.70, 0.90, 0.55, 'a.a = 0.2 + 0.3*a.mid_att;', 0),
      dots(60, 0.65, 0.45, 0.85, 'a.a = 0.15 + 0.2*a.bass_att;', 0)
    ],
    warp: 'shader_body {\nret = texture2D(sampler_main, uv).rgb;\nret -= 0.004;\n}\n',
    comp: 'shader_body {\nvec3 m = texture2D(sampler_main, uv).rgb;\nvec3 b = texture2D(sampler_blur1, uv).rgb;\nret = m*vec3(0.95, 1.0, 0.85) + b*vec3(0.45, 0.6, 0.65) + vec3(0.01, 0.02, 0.017);\n}\n'
  })

  // The core: two jagged clusters of the waveform, opposite each other,
  // orbiting the centre, one wave each so no line joins them. Rotation
  // faster near the centre winds their trails into arms.
  function scribble (phase) {
    return {
      baseVals: { enabled: 1, samples: 90, usedots: 0, thick: 0, additive: 1, scaling: 1, smoothing: 0, r: 0.85, g: 0.92, b: 1.0, a: 0.45 },
      init_eqs_str: '',
      frame_eqs_str: 'a.a = 0.3 + 0.3*Math.min(1, a.mid_att + a.treb);',
      // A random walk held near its cluster's centre, its steps longer as
      // the waveform swings wider.
      point_eqs_str: `var o = a.time*0.8 + ${phase};` +
        'var d = 0.012 + 0.08*Math.abs(a.value1);' +
        'a.wx = 0.9*(a.sample > 0 ? (a.wx || 0) : 0) + d*(Math.random()*2 - 1);' +
        'a.wy = 0.9*(a.sample > 0 ? (a.wy || 0) : 0) + d*(Math.random()*2 - 1);' +
        'a.x = 0.5 + 0.07*Math.cos(o) + a.wx;' +
        'a.y = 0.5 + 0.09*Math.sin(o) + 1.3*a.wy;'
    }
  }

  const whirlpool = preset({
    decay: 0.93, gammaadj: 1.6, wave_a: 0, zoom: 1.02, warp: 0.1, mv_a: 0, echo_zoom: 1
  },
  'a.q1 = 0.9*a.q1 + 0.1*a.bass_att;' +
  'a.zoom = 1.015 + 0.01*a.q1;',
  'a.rot = 0.08*Math.max(0, 1 - 1.4*a.rad) + 0.006*a.q1;' +
  'a.zoom = a.zoom + 0.01*a.rad;',
  {
    waves: [scribble(0), scribble(3.1416)],
    warp: 'shader_body {\nret = texture2D(sampler_main, uv).rgb*vec3(0.985, 0.95, 0.9);\nret -= 0.006;\n}\n',
    comp: 'shader_body {\nvec3 m = texture2D(sampler_main, uv).rgb;\nfloat core = max(0.0, 1.0 - rad*7.0);\nret = m + vec3(1.0, 0.85, 0.65)*core*core*(0.12 + 0.2*bass_att) + vec3(0.016, 0.013, 0.012);\n}\n'
  })

  return { drift, rings, plasma, stardust, whirlpool }
})()
