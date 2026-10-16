"""Correlated wave functions of C I with PySCF: 2p4 weight, natural occupations, term energies, CISD density and Coulomb hole.

Issue #154, 2026-10-15. Research script, not app code. Cited as "run" in
docs/research/carbon-beyond.md, its output is docs/research/carbon-beyond-casscf.out.

Setup, a venv in scratch: python3 -m venv .scratch/NAME/venv &&
  .scratch/NAME/venv/bin/pip install pyscf==2.14.0
Run from the repository root:
  OMP_NUM_THREADS=4 .scratch/NAME/venv/bin/python -I scripts/research/carbon_beyond/carbon_casscf.py > docs/research/carbon-beyond-casscf.out
Environment: PySCF 2.14.0 from PyPI in a venv, Python 3.12.3, OMP threads
as set by OMP_NUM_THREADS (the run below used 4).

Stages, each timed:
  0. ROHF of the M_L = 0 component |2px 2py| of 1s2 2s2 2p2 3P.
  1. SA-CASSCF(4e, 2s2p) over the three 3P components: weight of 2p4,
     natural occupations. In this space the 3P has exactly two CSFs,
     2s2 2p2 and 2p4, since 2s 2p3 is odd.
  2. SA-CASSCF(4e, 2s2p) over all nine components of 3P, 1D, 1S, equal
     weights: term energies.
  3. and 4. The same two with the larger active space 2s2p3s3p3d.
  5. CISD of all six electrons on the ROHF reference: natural
     occupations, radial density and moments against ROHF, and the
     conditional pair density (Coulomb hole) for one electron fixed at
     (1, 0, 0) bohr, in the 2px lobe, and the on-top pair density there.
Basis: cc-pCVTZ (core-valence triple zeta), symmetry D2h.
"""
import time
import numpy as np
from pyscf import gto, scf, mcscf, fci, ci, lib
from pyscf.dft import LebedevGrid

HARTREE_CM = 219474.63136314  # CODATA 2022 hartree-inverse meter, in cm^-1
T0 = time.time()


def stamp(label, t):
    print(f"[time] {label}: {time.time() - t:.1f} s wall")


mol = gto.M(atom="C 0 0 0", basis="cc-pcvtz", spin=2, symmetry="D2h",
            verbose=0)
print("basis functions:", mol.nao_nr(), " threads:", lib.num_threads())

# 0. ROHF of |1s2 2s2 2px 2py|, the 3P M_L = 0 component about z.
t = time.time()
mf = scf.ROHF(mol)
mf.irrep_nelec = {"Ag": (2, 2), "B3u": (1, 0), "B2u": (1, 0), "B1u": (0, 0)}
e_hf = mf.kernel()
print(f"ROHF energy {e_hf:.6f} Eh (Bunge 1993 numerical-quality RHF -37.688619)")
stamp("ROHF", t)


def solver(sym, spin, nroots=1):
    s = fci.direct_spin1_symm.FCI(mol)
    s.wfnsym = sym
    s.spin = spin
    s.nroots = nroots
    if spin == 0:
        fci.addons.fix_spin_(s, ss=0)   # keep Ms = 0 roots singlet
    return s


def sa_cas(cas_nocc, which):
    """SA-CASSCF. which = '3P' (three triplet components) or 'all' (9)."""
    ncas = sum(cas_nocc.values())
    mc = mcscf.CASSCF(mf, ncas, 4)
    mo = mcscf.sort_mo_by_irrep(mc, mf.mo_coeff, cas_nocc, {"Ag": 1})
    if which == "3P":
        solvers = [solver(s, 2) for s in ("B1g", "B2g", "B3g")]
        weights = [1 / 3] * 3
    else:
        solvers = [solver(s, 2) for s in ("B1g", "B2g", "B3g")]
        solvers += [solver("Ag", 0, 3)]
        solvers += [solver(s, 0) for s in ("B1g", "B2g", "B3g")]
        weights = [1 / 9] * 9
    mcscf.state_average_mix_(mc, solvers, weights)
    mc.natorb = True
    mc.conv_tol = 1e-9
    mc.max_cycle_macro = 100
    mc.kernel(mo)
    return mc, solvers


def occ_label(mc):
    """Natural occupations of the active space with irrep labels."""
    ncore, ncas = mc.ncore, mc.ncas
    orbsym = mc.mo_coeff.orbsym if hasattr(mc.mo_coeff, "orbsym") else \
        scf.hf_symm.get_orbsym(mol, mc.mo_coeff)
    dm1 = mc.fcisolver.make_rdm1(mc.ci, ncas, mc.nelecas)
    occ = np.diag(dm1)
    names = [mol.irrep_name[mol.irrep_id.index(s)] for s in orbsym[ncore:ncore + ncas]]
    return occ, names


def weight_2p4(mc, ci_vec, nelec):
    """Weight of determinants with the 2s natural orbital empty and the
    three 2p natural orbitals holding four electrons, all others empty."""
    ncore, ncas = mc.ncore, mc.ncas
    occ, names = occ_label(mc)
    # 2s: the Ag orbital of largest occupation; 2p: the largest of each u irrep.
    idx_2s = max((i for i, n in enumerate(names) if n == "Ag"), key=lambda i: occ[i])
    idx_2p = [max((i for i, n in enumerate(names) if n == u), key=lambda i: occ[i])
              for u in ("B1u", "B2u", "B3u")]
    na, nb = nelec
    sa = fci.cistring.make_strings(range(ncas), na)
    sb = fci.cistring.make_strings(range(ncas), nb)
    c = ci_vec.reshape(len(sa), len(sb))

    def occs(s):
        return [i for i in range(ncas) if (int(s) >> i) & 1]

    w_lead = w_2p4 = 0.0
    valence = set([idx_2s] + idx_2p)
    for ia, a in enumerate(sa):
        oa = occs(a)
        for ib, b in enumerate(sb):
            ob = occs(b)
            if not (set(oa) <= valence and set(ob) <= valence):
                continue
            n2s = oa.count(idx_2s) + ob.count(idx_2s)
            if n2s == 2:
                w_lead += c[ia, ib] ** 2
            elif n2s == 0:
                w_2p4 += c[ia, ib] ** 2
    return w_lead, w_2p4


def report_3p(label, cas_nocc):
    t = time.time()
    mc, solvers = sa_cas(cas_nocc, "3P")
    print(f"\n== {label}: SA-CASSCF over the 3P components")
    print(f"SA energy {mc.e_tot:.6f} Eh, converged {mc.converged}")
    occ, names = occ_label(mc)
    order = np.argsort(-occ)
    print("active natural occupations (SA density):",
          ", ".join(f"{names[i]} {occ[i]:.6f}" for i in order))
    for k, s in enumerate(solvers):
        wl, w4 = weight_2p4(mc, mc.ci[k], (3, 1))
        print(f"component {s.wfnsym}: E {mc.e_states[k]:.6f}  "
              f"weight 2s2 2p2 {wl:.6f}  weight 2p4 {w4:.6f}")
    stamp(f"{label} SA-3P", t)
    return mc


def report_terms(label, cas_nocc):
    t = time.time()
    mc, solvers = sa_cas(cas_nocc, "all")
    e = np.array(mc.e_states)
    print(f"\n== {label}: SA-CASSCF over 3P, 1D, 1S (nine components)")
    print("state energies (Eh):", " ".join(f"{x:.6f}" for x in e))
    e3p = e[:3].mean()
    singlets = np.sort(e[3:])
    e1d = singlets[:5].mean()
    e1s = singlets[5]
    print(f"spread of 3P components {np.ptp(e[:3]) * HARTREE_CM:.3f} cm-1, "
          f"of 1D components {np.ptp(singlets[:5]) * HARTREE_CM:.3f} cm-1")
    print(f"1D - 3P {(e1d - e3p) * HARTREE_CM:.1f} cm-1, "
          f"1S - 3P {(e1s - e3p) * HARTREE_CM:.1f} cm-1")
    stamp(f"{label} SA-terms", t)


small = {"Ag": 1, "B1u": 1, "B2u": 1, "B3u": 1}
large = {"Ag": 4, "B1g": 1, "B2g": 1, "B3g": 1, "B1u": 2, "B2u": 2, "B3u": 2}
report_3p("CAS(4,4) 2s2p", small)
report_terms("CAS(4,4) 2s2p", small)
report_3p("CAS(4,13) 2s2p3s3p3d", large)
report_terms("CAS(4,13) 2s2p3s3p3d", large)

# 5. CISD of all electrons on the ROHF reference (one component, M_L = 0).
t = time.time()
myci = ci.UCISD(scf.addons.convert_to_uhf(mf))
e_corr, civec = myci.kernel()
print(f"\n== CISD (all electrons): E {myci.e_tot:.6f} Eh, "
      f"correlation {e_corr:.6f} Eh")
dm1a, dm1b = myci.make_rdm1(civec)          # MO basis of the UHF object
mo = myci.mo_coeff[0]                        # ROHF: alpha and beta MOs equal
dm1 = dm1a + dm1b
nocc, nvec = np.linalg.eigh(dm1)
print("CISD natural occupations, largest 12:",
      ", ".join(f"{x:.6f}" for x in sorted(nocc)[::-1][:12]))
print(f"sum of occupations {nocc.sum():.6f}")
orbsym_hf = scf.hf_symm.get_orbsym(mol, mo)
lab = []
for irr in set(orbsym_hf):
    idx = np.where(orbsym_hf == irr)[0]
    w = np.linalg.eigvalsh(dm1[np.ix_(idx, idx)])
    name = mol.irrep_name[mol.irrep_id.index(irr)]
    lab += [(x, name) for x in w]
lab.sort(reverse=True)
print("by irrep, largest 12:", ", ".join(f"{n} {x:.6f}" for x, n in lab[:12]))
stamp("CISD and natural orbitals", t)

# Radial density and moments, HF against CISD, on a log radial grid
# times a 110-point Lebedev sphere (weights sum to 1, times 4 pi).
t = time.time()
r = np.geomspace(1e-5, 25.0, 3000)
ang = LebedevGrid.MakeAngularGrid(110)
dirs, wang = ang[:, :3], ang[:, 3] * 4 * np.pi
dm_hf_mo = np.diag(mf.mo_occ.astype(float))


def radial(dm_mo):
    """r^2 times the angular integral of rho at each radius."""
    dm_ao = mo @ dm_mo @ mo.T
    out = np.empty(len(r))
    for k0 in range(0, len(r), 200):
        rk = r[k0:k0 + 200]
        pts = (rk[:, None, None] * dirs[None]).reshape(-1, 3)
        ao = mol.eval_gto("GTOval", pts)
        rho = np.einsum("pi,ij,pj->p", ao, dm_ao, ao).reshape(len(rk), -1)
        out[k0:k0 + 200] = rk ** 2 * (rho @ wang)
    return out


def rho0(dm_mo):
    ao = mol.eval_gto("GTOval", np.zeros((1, 3)))
    return float((ao @ (mo @ dm_mo @ mo.T) @ ao.T)[0, 0])


D_hf, D_ci = radial(dm_hf_mo), radial(dm1)
for name, D, dm in (("ROHF", D_hf, dm_hf_mo), ("CISD", D_ci, dm1)):
    mom = {n: np.trapezoid(D * r ** n, r) for n in (-1, 1, 2)}
    print(f"{name}: N {np.trapezoid(D, r):.5f}  <sum 1/r> {mom[-1]:.5f}  "
          f"<sum r> {mom[1]:.5f}  <sum r^2> {mom[2]:.5f}  rho(0) {rho0(dm):.3f}")
diff = D_ci - D_hf
print(f"integral of D_CISD - D_HF {np.trapezoid(diff, r):.2e} (should be 0); "
      f"integral of |D_CISD - D_HF| {np.trapezoid(abs(diff), r):.5f} electrons")
print("r (bohr), D_HF(r), D_CISD - D_HF  [D = 4 pi r^2 rho averaged]:")
for rr in (0.05, 0.1, 0.2, 0.3, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0, 6.0):
    k = np.argmin(abs(r - rr))
    print(f"  {r[k]:6.3f}  {D_hf[k]:9.5f}  {diff[k]:+.5f}")
stamp("densities", t)

# Conditional pair density: electron 1 fixed at r1 = (1, 0, 0); electron
# 2 along two lines. rho2 spin-summed, normalised
# to N(N-1). The exchange-correlation hole h(r2|r1) = rho2/rho(r1) - rho(r2);
# the Coulomb hole is h_CISD - h_HF.
t = time.time()
dm2aa, dm2ab, dm2bb = myci.make_rdm2(civec)
dm2 = dm2aa + dm2bb + dm2ab + dm2ab.transpose(2, 3, 0, 1)
# HF two-body density matrix of the ROHF determinant in its own MOs.
na = np.diag((mf.mo_occ > 0).astype(float))
nb = np.diag((mf.mo_occ > 1).astype(float))


def hf_dm2(da, db):
    J = lambda x, y: np.einsum("pq,rs->pqrs", x, y)
    K = lambda x: np.einsum("ps,rq->pqrs", x, x)
    return J(da, da) - K(da) + J(db, db) - K(db) + J(da, db) + J(db, da)


dm2_hf = hf_dm2(na, nb)


def cond(dm2_mo, dm1_mo, r1, line):
    phi1 = mol.eval_gto("GTOval", np.array([r1])) @ mo     # (1, nmo)
    phi2 = mol.eval_gto("GTOval", line) @ mo                # (npts, nmo)
    A = np.einsum("p,q,pqrs->rs", phi1[0], phi1[0], dm2_mo)
    rho2 = np.einsum("kr,rs,ks->k", phi2, A, phi2)
    rho1 = float(phi1[0] @ dm1_mo @ phi1[0])
    rho_line = np.einsum("kr,rs,ks->k", phi2, dm1_mo, phi2)
    return rho2 / rho1 - rho_line, rho1


x1 = 1.0   # electron 1 at (1, 0, 0) bohr, in the 2px lobe of |2px 2py|
s = np.linspace(-3, 3, 25)
r1 = [x1, 0, 0]
for axis, line in (("x through nucleus and r1, r2 = (s,0,0)", np.c_[s, 0 * s, 0 * s]),
                   ("y through r1, r2 = (1,s,0)", np.c_[0 * s + x1, s, 0 * s])):
    h_hf, r1hf = cond(dm2_hf, dm_hf_mo, r1, line)
    h_ci, r1ci = cond(dm2, dm1, r1, line)
    print(f"\nhole about r1 = ({x1},0,0), r2 along {axis}: "
          f"rho(r1) HF {r1hf:.5f}, CISD {r1ci:.5f}")
    print("  s      h_HF (Fermi hole)   h_CISD   Coulomb hole h_CISD - h_HF")
    for k in range(len(s)):
        print(f"  {s[k]:5.2f}  {h_hf[k]:+.5f}  {h_ci[k]:+.5f}  {h_ci[k] - h_hf[k]:+.5f}")
# On-top pair density rho2(r1, r1) = rho(r1) (rho(r1) + h(r1|r1)).
pt = np.array([r1])
for name, d2, d1 in (("HF", dm2_hf, dm_hf_mo), ("CISD", dm2, dm1)):
    h, rr1 = cond(d2, d1, r1, pt)
    print(f"on-top pair density at r1, {name}: {rr1 * (rr1 + h[0]):.6f} bohr^-6")
stamp("pair density", t)
stamp("total", T0)
