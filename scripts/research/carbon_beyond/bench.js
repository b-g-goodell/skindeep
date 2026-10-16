// bench.js: cost per frame of three branched-flow renderers on a 400 x 380 canvas, issue #154.
// Run from the repository root: node scripts/research/carbon_beyond/bench.js
// Plain JS, no packages. The blit to a canvas is not measured.
'use strict';
const W = 400, H = 380, CX = 140, CY = 190; // source where the Carbon atom sits (left part of the pane)
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gauss(r) { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
function median(a) { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; }
function time(fn, reps) { const t = []; for (let i = 0; i < reps; i++) { const s = process.hrtime.bigint(); fn(i);
  t.push(Number(process.hrtime.bigint() - s) / 1e6); } return { med: median(t), min: Math.min(...t), max: Math.max(...t) }; }
const show = (name, r) => console.log(name.padEnd(58), 'median', r.med.toFixed(2), 'ms  min', r.min.toFixed(2), ' max', r.max.toFixed(2));

// Field: delta n(x,y) = sigma sqrt(2/N) sum cos(kx x + ky y + phi), k ~ N(0, 2/l^2), pixels.
function modes(N, l, r) { const m = []; for (let i = 0; i < N; i++)
  m.push({ kx: gauss(r) * Math.SQRT2 / l, ky: gauss(r) * Math.SQRT2 / l, ph: 2 * Math.PI * r(), w: 2 * Math.PI * (r() - 0.5) * 0.3 });
  return m; }
// Build the field on a grid of gw x gh (cell size cs pixels) by the separable cos/sin product, at time t
// (each mode's phase drifts at rate w: a slowly changing medium). Returns the field and its gradient.
function buildGrid(md, sigma, gw, gh, cs, t, out) {
  const N = md.length, A = sigma * Math.sqrt(2 / N);
  const f = out.f; f.fill(0);
  const cx = new Float64Array(gw), sx = new Float64Array(gw), cy = new Float64Array(gh), sy = new Float64Array(gh);
  for (const m of md) {
    for (let i = 0; i < gw; i++) { const a = m.kx * i * cs + m.ph + m.w * t; cx[i] = Math.cos(a); sx[i] = Math.sin(a); }
    for (let j = 0; j < gh; j++) { const b = m.ky * j * cs; cy[j] = Math.cos(b); sy[j] = Math.sin(b); }
    for (let j = 0; j < gh; j++) { const cj = cy[j], sj = sy[j], row = j * gw;
      for (let i = 0; i < gw; i++) f[row + i] += cx[i] * cj - sx[i] * sj; }
  }
  for (let k = 0; k < f.length; k++) f[k] *= A;
  const gx = out.gx, gy = out.gy; // central differences, per pixel
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const k = j * gw + i;
    gx[k] = (f[j * gw + Math.min(i + 1, gw - 1)] - f[j * gw + Math.max(i - 1, 0)]) / (2 * cs);
    gy[k] = (f[Math.min(j + 1, gh - 1) * gw + i] - f[Math.max(j - 1, 0) * gw + i]) / (2 * cs);
  }
}
// Rays from the source in all directions; ray equation for n ~ 1 + dn: dv/ds = grad dn - (grad dn . v) v.
// Bilinear lookup of the gradient on the grid; deposit 1 per step into the density image.
function traceRays(G, gw, gh, cs, nr, hs, dens) {
  dens.fill(0);
  for (let q = 0; q < nr; q++) {
    const th = 2 * Math.PI * (q + 0.5) / nr; let vx = Math.cos(th), vy = Math.sin(th), x = CX, y = CY;
    for (;;) {
      const u = x / cs, v = y / cs, i = u | 0, j = v | 0;
      if (i < 0 || j < 0 || i >= gw - 1 || j >= gh - 1) break;
      const fu = u - i, fv = v - j, k = j * gw + i;
      const w00 = (1 - fu) * (1 - fv), w10 = fu * (1 - fv), w01 = (1 - fu) * fv, w11 = fu * fv;
      const ax = G.gx[k] * w00 + G.gx[k + 1] * w10 + G.gx[k + gw] * w01 + G.gx[k + gw + 1] * w11;
      const ay = G.gy[k] * w00 + G.gy[k + 1] * w10 + G.gy[k + gw] * w01 + G.gy[k + gw + 1] * w11;
      const dot = ax * vx + ay * vy;
      vx += hs * (ax - dot * vx); vy += hs * (ay - dot * vy);
      const nn = 1 / Math.sqrt(vx * vx + vy * vy); vx *= nn; vy *= nn;
      x += hs * vx; y += hs * vy;
      const px = x | 0, py = y | 0;
      if (px >= 0 && py >= 0 && px < W && py < H) dens[py * W + px] += 1;
    }
  }
}
// Radix-2 complex FFT in place.
function fft(re, im, inv) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (inv ? 2 : -2) * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const a = i + j, b = a + len / 2, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } } }
  if (inv) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}
// Split-step paraxial propagation of a beam along x across the canvas: i dU/dx = -(1/2k) U_yy - k dn U.
function splitStep(G, gw, cs, k, img) {
  const n = 512, re = new Float64Array(n), im = new Float64Array(n), kin = new Float64Array(n);
  for (let i = 0; i < n; i++) { const ky = 2 * Math.PI * (i < n / 2 ? i : i - n) / n; kin[i] = -ky * ky / (2 * k); }
  for (let j = 0; j < n; j++) { const y = j - (n - H) / 2; re[j] = Math.exp(-((y - CY) ** 2) / (2 * 4 * 4)); im[j] = 0; } // narrow beam: a source
  for (let x = 0; x < W; x++) {
    for (let j = 0; j < n; j++) { const y = j - (n - H) / 2; let ph = 0;
      if (y >= 0 && y < H) { ph = k * G.f[((y / cs) | 0) * gw + ((x / cs) | 0)]; }
      const c = Math.cos(ph), s = Math.sin(ph), r0 = re[j]; re[j] = r0 * c - im[j] * s; im[j] = r0 * s + im[j] * c; }
    fft(re, im, false);
    for (let j = 0; j < n; j++) { const c = Math.cos(kin[j]), s = Math.sin(kin[j]), r0 = re[j]; re[j] = r0 * c - im[j] * s; im[j] = r0 * s + im[j] * c; }
    fft(re, im, true);
    for (let y = 0; y < H; y++) { const j = y + (n - H) / 2; img[y * W + x] = re[j] * re[j] + im[j] * im[j]; }
  }
}

const r = rng(42), l = 6, sigma = 0.05; // display medium: l = 6 px, sigma_n = 0.05 (onset ~ 2.263*6*0.05^(-2/3) = 100 px)
console.log('node', process.version, '| canvas', W, 'x', H, '| source at', CX, CY, '| l =', l, 'px, sigma_n =', sigma);
const dens = new Float32Array(W * H);
for (const [gw, gh, cs, N] of [[W, H, 1, 32], [101, 96, 4, 32], [101, 96, 4, 16], [51, 48, 8, 16], [101, 96, 4, 128], [101, 96, 4, 256]]) {
  const md = modes(N, l, r), G = { f: new Float64Array(gw * gh), gx: new Float64Array(gw * gh), gy: new Float64Array(gw * gh) };
  show(`field grid ${gw}x${gh} cell ${cs}px, ${N} modes, rebuild`, time(t => buildGrid(md, sigma, gw, gh, cs, t * 0.03, G), 30));
  if (cs > 4 || N > 32) continue; // an 8 px cell cannot resolve l = 6 px; ray cost does not depend on N
  for (const [nr, hs] of [[2000, 1], [4000, 1], [8000, 1], [4000, 0.5]]) {
    show(`  rays ${nr}, step ${hs}px through that grid`, time(() => traceRays(G, gw, gh, cs, nr, hs, dens), 15));
  }
}
{
  const gw = 101, gh = 96, cs = 4, md = modes(32, l, r);
  const G = { f: new Float64Array(gw * gh), gx: new Float64Array(gw * gh), gy: new Float64Array(gw * gh) };
  buildGrid(md, sigma, gw, gh, cs, 0, G);
  const img = new Float32Array(W * H);
  // optical k in pixels: a symbol, wavelength 2 px (lambda << l = 6 px)
  show('split-step paraxial, 512 transverse, 400 steps, lambda 2 px', time(() => splitStep(G, gw, cs, Math.PI, img), 10));
  // sanity: branch contrast of the ray picture (scintillation index on a circle of radius 150 px)
  traceRays(G, gw, gh, cs, 8000, 1, dens);
  let s1 = 0, s2 = 0, n = 0;
  for (let a = 0; a < 720; a++) { const th = a * Math.PI / 360, x = Math.round(CX + 150 * Math.cos(th)), y = Math.round(CY + 150 * Math.sin(th));
    if (x < 0 || y < 0 || x >= W || y >= H) continue; const v = dens[y * W + x]; s1 += v; s2 += v * v; n++; }
  console.log('ray density, 8000 rays: scintillation index at r = 150 px:', (s2 / n / ((s1 / n) ** 2) - 1).toFixed(2), 'over', n, 'samples');
}
