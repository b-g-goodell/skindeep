"""Derived figures of C I benchmarks against NIST: energy gaps, correlation shares, term energies, moments.

Issue #154, 2026-10-15. Cited as "compare" in docs/research/carbon-beyond.md.
Run from the repository root: python3 -I scripts/research/carbon_beyond/carbon_compare.py
Inputs: published numbers typed in below, each with its source, and the
NIST ASD 5.12 level energies in docs/research/carbon-atom-data.json.
"""
import json

H = 219474.63136314  # cm^-1 per hartree, CODATA 2022 hartree-inverse meter, physics.nist.gov/cuu
lev = {l["id"]: l["energy_cm"] for l in json.load(open("docs/research/carbon-atom-data.json"))["levels"]}

# 3P centroid, NIST ASD 5.12 (J = 0, 1, 2 weights 1, 3, 5).
cen = (lev["2p2_3P_0"] + 3 * lev["2p2_3P_1"] + 5 * lev["2p2_3P_2"]) / 9
print(f"3P centroid {cen:.4f} cm-1")
exp_1d = lev["2p2_1D_2"] - cen
exp_1s = lev["2p2_1S_0"] - cen
exp_5s = lev["2s2p3_5So_2"] - cen
print(f"experiment above centroid: 1D {exp_1d:.2f}, 1S {exp_1s:.2f}, 5S {exp_5s:.2f}")

# Ground-state benchmarks (Eh). Strasburger 2019 Table II; Seth 2011 Table II;
# Pfau 2020 Table I; Carette and Godefroid 2011 text and Table I.
E_hf = -37.688619                      # Seth Table II (ATSP2K HF); Bunge 1993 -37.68861890
E_ex = -37.844906                      # Strasburger extrapolated, (4) in last digit
E_chak = -37.8450
print(f"E_corr = E_ex - E_HF = {E_ex - E_hf:.6f} Eh; against Chakravorty {E_chak - E_hf:.6f}")
rows = [
    ("CI SDTQ Sasaki-Yoshimine 1974", -37.8393),
    ("CI selected Ruiz-Troger 2017", -37.8352652),
    ("ECG K=500 Sharkey 2010", -37.84012879),
    ("ECG K=1000 Bubin 2013", -37.843333),
    ("MCHF 12k Carette-Godefroid 2011", -37.844170),
    ("MCHF/CI final Carette-Godefroid 2011", -37.844525),
    ("MCHF extrapolated Carette-Godefroid 2011", -37.84465),
    ("CCSD(T)-F12 Noga 2008", -37.844334),
    ("CCSD(T)/CBS in Pfau 2020", -37.8448),
    ("DMC Maldonado 2011", -37.84185),
    ("DMC Seth 2011", -37.84446),
    ("FermiNet VMC Pfau 2020", -37.84471),
    ("FC-CFT Nakatsuji 2018", -37.845004),
    ("ECG lobes variational Strasburger 2019", -37.844889402),
    ("NIST MCHF collection (Breit-Pauli)", -37.81158950),
    ("PySCF CISD cc-pCVTZ (this work)", -37.824777),
]
for name, e in rows:
    print(f"  {name:42s} {e:.6f}  E - E_ex = {1000 * (e - E_ex):+.3f} mEh  "
          f"corr% {100 * (e - E_hf) / (E_ex - E_hf):.2f}  (vs Chakravorty {100 * (e - E_hf) / (E_chak - E_hf):.2f})")

# Term energies against experiment.
cg = {"3P": -37.844525, "1D": -37.798111, "1S": -37.745889}   # Carette-Godefroid Table I, Final
print(f"Carette-Godefroid nonrel: 1D {(cg['1D'] - cg['3P']) * H:.1f} (exp {exp_1d:.1f}), "
      f"1S {(cg['1S'] - cg['3P']) * H:.1f} (exp {exp_1s:.1f})")
print(f"Strasburger 5S: nonrel 33605(1), +scalar rel 33713, exp above centroid {exp_5s:.3f}")

# NIST MCHF collection, Breit-Pauli level energies (cm^-1 above 3P0) against ASD.
mchf = [("2p2_3P_1", 16.33), ("2p2_3P_2", 43.03), ("2p2_1D_2", 10268.23), ("2p2_1S_0", 21818.60),
        ("2s2p3_5So_2", 33730.21), ("2p3s_3Po_0", 60679.19), ("2p3s_1Po_1", 62414.16),
        ("2s2p3_3Do_3", 64340.37), ("2s2p3_3Po_1", 76068.99)]
for i, e in mchf:
    print(f"  MCHF {i:12s} {e:9.2f}  ASD {lev[i]:10.3f}  diff {e - lev[i]:+8.2f}  ({100 * (e - lev[i]) / lev[i]:+.2f} %)")

# Maldonado 2011 DMC total energies, relayed by Ruiz-Troger 2017 Table 5.
mal = {"3P": -37.83544, "1D": -37.78966, "1S": -37.73830, "5S": -37.69026,
       "2p3s 3P": -37.56103, "2p3s 1P": -37.55352, "2s2p3 3D": -37.54374}
nist = {"1D": exp_1d, "1S": exp_1s, "5S": exp_5s, "2p3s 3P": lev["2p3s_3Po_0"] - cen,
        "2p3s 1P": lev["2p3s_1Po_1"] - cen, "2s2p3 3D": lev["2s2p3_3Do_3"] - cen}
for k, v in nist.items():
    d = (mal[k] - mal["3P"]) * H
    print(f"  DMC {k:9s} {d:9.0f}  exp {v:9.0f}  diff {d - v:+6.0f}")

# PySCF CAS term splittings (docs/research/carbon-beyond-casscf.out) against experiment.
for name, d1, d2 in (("CAS(4,4)", 12622.0, 21175.1), ("CAS(4,13)", 11781.4, 23699.7)):
    print(f"  {name}: 1D {d1:.0f} ({d1 - exp_1d:+.0f}), 1S {d2:.0f} ({d2 - exp_1s:+.0f})")

# One-electron moments: Seth 2011 DMC (Table V) against Bunge 1993 RHF sums.
bunge = {"r": (0.268443, 1.589344, 1.714495), "r2": (0.097199, 3.052064, 3.7468),
         "1/r": (5.664439, 0.896798, 0.783503)}
seth = {"r": 7.1230, "r2": 13.7401, "1/r": 14.7065}
for k in bunge:
    hf = 2 * sum(bunge[k])
    print(f"  <sum {k}>: HF {hf:.6f}  DMC {seth[k]}  diff {seth[k] - hf:+.6f} ({100 * (seth[k] - hf) / hf:+.3f} %)")
print(f"  rho(0): HF 127.45, DMC 127.2(4)")
pyscf = {"r": (7.13681, 7.11991), "r2": (13.72207, 13.67498), "1/r": (14.68931, 14.69817)}
for k, (a, b) in pyscf.items():
    print(f"  PySCF <sum {k}>: CISD - ROHF {b - a:+.5f} ({100 * (b - a) / a:+.3f} %)")
print(f"  on-top pair density at (1,0,0): CISD/HF = {0.009583 / 0.016539:.3f}")
print(f"  2p4 |c|: CAS(4,4) {0.022159 ** 0.5:.4f}, CAS(4,13) {0.018764 ** 0.5:.4f}")
