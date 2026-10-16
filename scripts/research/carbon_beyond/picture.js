// picture.js: write the ray-density picture of bench.js's medium as a PGM image, to look at once, issue #154.
// Run from the repository root: node scripts/research/carbon_beyond/picture.js .scratch/NAME/rays.pgm [rays, default 8000]
'use strict';
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/bench.js', 'utf8').split("const r = rng(42)")[0];
eval(src + `
const r = rng(42), l = 6, sigma = 0.05, gw = 101, gh = 96, cs = 4;
const md = modes(32, l, r), G = { f: new Float64Array(gw * gh), gx: new Float64Array(gw * gh), gy: new Float64Array(gw * gh) };
buildGrid(md, sigma, gw, gh, cs, 0, G);
const dens = new Float32Array(W * H); const NR = Number(process.argv[3] || 8000); traceRays(G, gw, gh, cs, NR, 1, dens);
const out = Buffer.alloc(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const rr = Math.hypot(x - CX, y - CY) + 1, v = dens[y * W + x] * rr / NR * 2 * Math.PI; // flux times r: 1 for no medium
  out[y * W + x] = Math.max(0, Math.min(255, Math.round(255 * Math.sqrt(v / 4))));
}
fs.writeFileSync(process.argv[2], Buffer.concat([Buffer.from('P5 ' + W + ' ' + H + ' 255\\n'), out]));
`);
