// onset.js: branched-flow onset distances, photoelectron wavelengths, vacuum jitter, ray check of the onset prefactor.
// Issue #154. Run from the repository root: node scripts/research/carbon_beyond/onset.js
// (mode-count convergence: node scripts/research/carbon_beyond/onset.js converge). Plain JS, no packages.
// Every input is named with its source in docs/research/carbon-beyond.md. Units SI unless stated.
'use strict';

// CODATA 2022 (NIST allascii.txt, read 2026-10-15)
const h = 6.62607015e-34, hbar = 1.054571817e-34, me = 9.1093837139e-31;
const qe = 1.602176634e-19, re = 2.8179403205e-15, alpha = 7.2973525643e-3;
const a0 = 5.29177210544e-11, c = 299792458;
const pc = 648000 / Math.PI * 149597870700; // IAU 2012 au, 2015 pc definition

// Ai(0) = 3^(-2/3)/Gamma(2/3), Bi(0) = sqrt(3) Ai(0) (relation not checked against a source this session)
function gamma(z) { // Lanczos, g=7, n=9
  const g = 7, p = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  z -= 1; let x = p[0]; for (let i = 1; i < g + 2; i++) x += p[i] / (z + i);
  const t = z + g + 0.5; return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}
const Ai0 = Math.pow(3, -2 / 3) / gamma(2 / 3), Bi0 = Math.sqrt(3) * Ai0;
const PREF_K = Math.PI ** 2 * (Ai0 ** 2 + Bi0 ** 2); // l_caustic = PREF_K * kappa at B = 0

// Maryenko et al. PRB 85 195329 (2012) App. A, B = 0, point source, units m = v = 1:
// l = pi^2 kappa (Ai(0)^2 + Bi(0)^2), kappa = (2/D)^(1/3), D = int dx d^4_y c(x,y)|_{y=0}
// Gaussian c = V0^2 exp(-r^2/l^2): D = 12 sqrt(pi) V0^2 l^-3.
const Lgauss = (l, V0) => PREF_K * Math.cbrt(2 / (12 * Math.sqrt(Math.PI) * V0 * V0 / l ** 3));
const LfromD = D => PREF_K * Math.cbrt(2 / D);
// Kaplan PRL 89 184103 (2002) Eq. 13, units xi = 1, m = 1, p = 1: b_eff = hbar^(2/3) v0^(-4/9)
const beff = (lambda, l, V0) => Math.pow(lambda / (2 * Math.PI * l), 2 / 3) * Math.pow(V0, -4 / 9);
const fmt = (x, d = 3) => x.toExponential(d);

console.log('# constants');
console.log('Ai(0) =', Ai0.toFixed(9), ' Bi(0) =', Bi0.toFixed(9));
console.log('pi^2 (Ai0^2+Bi0^2) =', PREF_K.toFixed(4));
const pref_l = PREF_K * Math.cbrt(2 / (12 * Math.sqrt(Math.PI)));
console.log('l_caustic = ', pref_l.toFixed(4), ' l V0^(-2/3)   [m = v = 1, E = 1/2]');
console.log('          = ', (pref_l * Math.pow(2, 2 / 3)).toFixed(4), ' l eps^(-2/3), eps = sigma_V/E = 2 V0');
console.log('Kaplan t0 = v0^(-2/3) xi = ', Math.pow(2, 2 / 3).toFixed(4), ' xi eps^(-2/3) (a time scale, not the mean distance)');

// ---------- 1. Topinka et al. 2001: E_F 16 meV, rms 8 % E_F, l about 25 nm, lambda_F 37 nm
{
  const eps = 0.08, l = 25e-9, lam = 37e-9, V0 = eps / 2;
  console.log('\n# 2DEG, Topinka 2001');
  console.log('L_caustic =', fmt(Lgauss(l, V0)), 'm;  b_eff/l =', beff(lam, l, V0).toFixed(3));
}

// ---------- 2. Soap film, Lin and Ma arXiv:2112.03176 Sec. 4: m = k0 nbar = 1.53e7 /m,
// sigma_V = 9.11e5 (same units), l_c = 0.202 mm, measured first branching 5.15 mm.
{
  const V0 = 9.11e5 / 1.53e7, l = 0.202e-3;
  console.log('\n# soap film, Lin and Ma');
  console.log('V0 = sigma_V/m =', V0.toFixed(4), '; l_c (m/sigma_V)^(2/3) =', fmt(l * Math.pow(V0, -2 / 3)), 'm');
  console.log('predicted mean first caustic =', fmt(Lgauss(l, V0)), 'm; measured 5.15e-3 m; ratio',
    (5.15e-3 / Lgauss(l, V0)).toFixed(2));
}

// ---------- 3. Laser plasma, Jiang et al. arXiv:2109.14327: n_e = 0.08 n_c, variation ~30 %,
// l_c = 4.8 um, lambda 1.06 um. n = sqrt(1 - n_e/n_c): sigma_n ~ 0.3*0.08/2 (linear, rms assumed)
{
  const sn = 0.3 * 0.08 / 2, l = 4.8e-6;
  console.log('\n# laser plasma, Jiang et al.');
  console.log('sigma_n =', sn, '; linear L_caustic =', fmt(Lgauss(l, sn)), 'm (PIC first caustic 19.8e-6 m)',
    '; b_eff/l =', beff(1.06e-6, l, sn).toFixed(3));
}

// ---------- 4. Turbulent air, Kolmogorov with inner-scale cutoff.
// Phi_n = 0.033 Cn2 k^(-11/3) exp(-k^2/km^2), km = 5.92/l0 (Cox et al. 2021 Eq. 9; Kulikov et al. 1112.6033)
// D = 2 pi int dky dkz ky^4 Phi(0,ky,kz) = 2 pi * 0.033 Cn2 * (3 pi/4) * Gamma(7/6)/2 * km^(7/3)
// V = -delta n (n ~ 1). Rytov: sigma_R^2 = 1.23 Cn2 k^(7/6) L^(11/6) (Cox et al. Eq. 10)
{
  const lam = 538.2e-9, k = 2 * Math.PI / lam;
  console.log('\n# turbulent air, lambda =', lam);
  console.log('Cn2         l0     D            L_ray(m)     sqrt(lam L_ray)  L_Rytov=1(m)  sqrt(lam L_Ryt)  V0eq        b_eff/l0');
  for (const Cn2 of [1e-17, 1e-15, 1e-13]) for (const l0 of [1e-3, 1e-2]) {
    const km = 5.92 / l0;
    const D = 2 * Math.PI * 0.033 * Cn2 * (3 * Math.PI / 4) * gamma(7 / 6) / 2 * Math.pow(km, 7 / 3);
    const L = LfromD(D);
    const LR = Math.pow(1 / (1.23 * Cn2 * Math.pow(k, 7 / 6)), 6 / 11);
    const V0eq = Math.sqrt(D * l0 ** 3 / (12 * Math.sqrt(Math.PI)));
    console.log(fmt(Cn2, 0), ' ', fmt(l0, 0), ' ', fmt(D, 2), ' ', fmt(L, 2), ' ', fmt(Math.sqrt(lam * L), 2),
      '       ', fmt(LR, 2), '     ', fmt(Math.sqrt(lam * LR), 2), '       ', fmt(V0eq, 2), ' ', beff(lam, l0, V0eq).toFixed(3),
      '  aspect L/l0', fmt(pref_l * Math.pow(V0eq, -2 / 3), 2), '  angle factor vs drawn eps 0.1', fmt(Math.pow(0.1 / (2 * V0eq), 2 / 3), 2));
  }
}

// ---------- 5. Interstellar medium, single-scale Gaussian model:
// l = 1e8 m (ARS 1995 inner-scale upper bound; the dominant scale 1e10 cm in Scalo and Elmegreen 2004)
// sigma_ne = 5e-6 cm^-3 = 5 m^-3 (Cordes et al. 1985 via Scalo and Elmegreen 2004, high latitude)
// delta n = r_e lambda^2 delta n_e / (2 pi)  (cold plasma n = sqrt(1 - wp^2/w^2))
{
  const l = 1e8, sne = 5;
  console.log('\n# interstellar medium, l = 1e8 m, sigma_ne = 5 m^-3');
  console.log('lambda        sigma_n      L_caustic(m)   L(kpc)        b_eff/l');
  for (const [name, lam] of [['538.2 nm', 538.2e-9], ['609.1 um C I 3P1-3P0', 609135.337e-9], ['0.3 m (1 GHz)', 0.3]]) {
    const sn = re * lam * lam * sne / (2 * Math.PI);
    const L = Lgauss(l, sn);
    console.log(name.padEnd(22), fmt(sn, 2), ' ', fmt(L, 2), ' ', fmt(L / (1e3 * pc), 2), ' ', fmt(beff(lam, l, sn), 2));
  }
  console.log('L ratio 538.2 nm / 0.3 m =', fmt(Math.pow(0.3 / 538.2e-9, 4 / 3), 2), '(lambda^(-4/3))');
}

// ---------- 6. Photoelectron de Broglie wavelength lambda = h / sqrt(2 m E)
console.log('\n# photoelectron wavelength');
for (const E of [0.5, 1, 3, 5, 10]) {
  const lam = h / Math.sqrt(2 * me * E * qe);
  console.log(E, 'eV:', (lam * 1e9).toFixed(4), 'nm =', (lam / a0).toFixed(2), 'bohr; speed', fmt(Math.sqrt(2 * E * qe / me), 3), 'm/s');
}
// Coulomb deflection strength at impact parameter b: e^2/(4 pi eps0 b E) = (alpha hbar c / b) / E
for (const b of [1e-9, 1e-6]) console.log('3 eV electron, Coulomb V/E at b =', b, 'm:', fmt(alpha * hbar * c / b / (3 * qe), 2));

// ---------- 7. Welton: <dr^2> = (2 alpha/pi)(hbar/mc)^2 ln(1/(pi alpha))
{
  const lc = hbar / (me * c);
  const dr2 = 2 * alpha / Math.PI * lc * lc * Math.log(1 / (Math.PI * alpha));
  console.log('\n# Welton vacuum jitter: rms dr =', fmt(Math.sqrt(dr2), 3), 'm =', fmt(Math.sqrt(dr2) / a0, 3), 'bohr');
}

// ---------- 8. Numerical check of the prefactor: paraxial rays in a Gaussian random field.
// V(x,y) = V0 sqrt(2/N) sum cos(kx_i x + ky_i y + phi_i), k ~ N(0, 2/l^2) per component
// gives <V V> = V0^2 exp(-r^2/l^2). Units l = 1, m = v = 1, x is time.
// Point source: J(0) = 0, J'(0) = 1; plane wave: J(0) = 1, J'(0) = 0; J'' = -V_yy J; caustic at J = 0.
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gauss(r) { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
function field(N, V0, r) {
  const kx = new Float64Array(N), ky = new Float64Array(N), ph = new Float64Array(N);
  for (let i = 0; i < N; i++) { kx[i] = gauss(r) * Math.SQRT2; ky[i] = gauss(r) * Math.SQRT2; ph[i] = 2 * Math.PI * r(); }
  return { N, kx, ky, ph, A: V0 * Math.sqrt(2 / N) };
}
function derivs(f, x, y, out) { // out[0] = V_y, out[1] = V_yy
  let s1 = 0, s2 = 0;
  for (let i = 0; i < f.N; i++) { const a = f.kx[i] * x + f.ky[i] * y + f.ph[i];
    s1 -= f.ky[i] * Math.sin(a); s2 -= f.ky[i] * f.ky[i] * Math.cos(a); }
  out[0] = f.A * s1; out[1] = f.A * s2;
}
function firstCaustic(f, y0, point, xmax, hstep) {
  let x = 0, y = y0, p = 0, J = point ? 0 : 1, Jp = point ? 1 : 0;
  const d = [0, 0]; derivs(f, x, y, d);
  while (x < xmax) {
    // velocity Verlet with x as time
    const pH = p - 0.5 * hstep * d[0], JpH = Jp - 0.5 * hstep * d[1] * J;
    const yN = y + hstep * pH, JN = J + hstep * JpH;
    derivs(f, x + hstep, yN, d);
    p = pH - 0.5 * hstep * d[0]; Jp = JpH - 0.5 * hstep * d[1] * JN;
    if (x > 0 && J > 0 && JN <= 0) return x + hstep * J / (J - JN);
    if (x === 0 && point && JN <= 0) return x + hstep; // not expected
    x += hstep; y = yN; J = JN;
  }
  return NaN;
}
function meanCaustic(eps, N, point, rays, seed) {
  const V0 = eps / 2, r = rng(seed), pred = pref_l * Math.pow(V0, -2 / 3);
  const xs = []; let lost = 0; const perField = 10;
  for (let f = 0; f < rays / perField; f++) {
    const F = field(N, V0, r);
    for (let j = 0; j < perField; j++) {
      const v = firstCaustic(F, 7 * j, point, 25 * pred, 0.04);
      if (Number.isNaN(v)) lost++; else xs.push(v);
    }
  }
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
  return { m, se: sd / Math.sqrt(xs.length), sd, n: xs.length, lost, pred };
}
if (process.argv[2] === 'converge') { // node onset.js converge: mode-count convergence of the mean onset
  console.log('\n# convergence in N, point source, 500 rays');
  for (const [eps, N] of [[0.03, 64], [0.03, 128], [0.03, 1024], [0.01, 1024]]) {
    const R = meanCaustic(eps, N, true, 500, 777 + N + Math.round(eps * 1000));
    console.log('eps', eps, 'N', N, 'rays', R.n, 'lost', R.lost, 'mean', R.m.toFixed(2), 's.e.', R.se.toFixed(2),
      'L/(l eps^-2/3)', (R.m / Math.pow(eps, -2 / 3)).toFixed(3), '+-', (R.se / Math.pow(eps, -2 / 3)).toFixed(3));
  }
  process.exit(0);
}
console.log('\n# prefactor check, paraxial rays, l = 1');
console.log('source  eps    N     rays  mean L      s.e.    L/(l eps^-2/3)   theory(point) 3.592   lost');
const t0 = Date.now();
for (const [eps, N] of [[0.01, 256], [0.03, 256], [0.1, 256], [0.03, 8], [0.03, 16], [0.03, 32]]) {
  const R = meanCaustic(eps, N, true, 1000, 1234 + N + Math.round(eps * 1000));
  console.log('point  ', eps.toFixed(2), String(N).padStart(4), ' ', R.n, ' ', R.m.toFixed(2).padStart(8), ' ',
    R.se.toFixed(2).padStart(6), '  ', (R.m / Math.pow(eps, -2 / 3)).toFixed(3), '            pred',
    R.pred.toFixed(2), '        ', R.lost);
}
for (const eps of [0.01, 0.03]) {
  const R = meanCaustic(eps, 256, false, 1000, 99 + Math.round(eps * 1000));
  console.log('plane  ', eps.toFixed(2), ' 256  ', R.n, ' ', R.m.toFixed(2).padStart(8), ' ', R.se.toFixed(2).padStart(6),
    '  ', (R.m / Math.pow(eps, -2 / 3)).toFixed(3), '            (no source formula)   ', R.lost);
}
console.log('ray check took', ((Date.now() - t0) / 1000).toFixed(1), 's');

// ---------- 9. How many Fourier modes: excess kurtosis of V and error of one realization's correlation
console.log('\n# modes: kurtosis of V over space, and max |C_hat(r) - exp(-r^2)| for r in [0,3], 200 realizations');
{
  const r = rng(7);
  for (const N of [4, 8, 16, 32, 64, 128, 256]) {
    let kurtSum = 0, errSum = 0; const R = 200;
    for (let t = 0; t < R; t++) {
      const F = field(N, 1, r);
      // one realization's spatial autocorrelation along a random direction = (1/N) sum cos(k_i . r)
      let maxErr = 0; const th = 2 * Math.PI * r(), ux = Math.cos(th), uy = Math.sin(th);
      for (let s = 0; s <= 60; s++) { const d = s * 0.05; let cs = 0;
        for (let i = 0; i < N; i++) cs += Math.cos((F.kx[i] * ux + F.ky[i] * uy) * d);
        maxErr = Math.max(maxErr, Math.abs(cs / N - Math.exp(-d * d))); }
      errSum += maxErr;
      // kurtosis of V over a 200 x 200 sample of points in a 100 l square
      let m2 = 0, m4 = 0; const M = 4000;
      for (let q = 0; q < M; q++) { const x = 100 * r(), y = 100 * r(); let v = 0;
        for (let i = 0; i < N; i++) v += Math.cos(F.kx[i] * x + F.ky[i] * y + F.ph[i]);
        v *= F.A; m2 += v * v; m4 += v ** 4; }
      m2 /= M; m4 /= M; kurtSum += m4 / (m2 * m2) - 3;
    }
    console.log('N =', String(N).padStart(3), ' excess kurtosis', (kurtSum / R).toFixed(3), ' (random-phase theory -3/(2N) =',
      (-1.5 / N).toFixed(3) + ')', ' mean max corr error', (errSum / R).toFixed(3));
  }
}
