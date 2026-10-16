"""Corrections and dynamics of C I: fine structure, g_J, Zeeman, isotope and field shifts, Rabi, Stark, Rydberg, photoionization.

Issue #154, 2026-10-15. Output sections A to K are cited by letter in
docs/research/carbon-beyond.md.
Run from the repository root:
  python3 -I scripts/research/carbon_beyond/part_b_calc.py docs/research/carbon-atom-data.json

Reads the Phase 1 data file (NIST ASD 5.12 levels and lines, Bunge 1993
orbitals) and prints every derived figure the document quotes from it.
Every other input is a constant below with its source key, as cited in
docs/research/carbon-beyond.md.
"""
import json
import math
import sys

# CODATA 2022 (codata), exact SI where so
C = 299792458.0                  # m/s, exact
H = 6.62607015e-34               # J s, exact
HBAR = H / (2 * math.pi)
KB = 1.380649e-23                # J/K, exact
EPS0 = 8.8541878188e-12          # F/m
U_KG = 1.66053906892e-27         # kg, codata 2022
ME_U = 5.485799090441e-4         # electron mass in u, codata 2022
MUB_HZ_T = 1.39962449171e10      # mu_B/h in Hz/T, codata 2022
GS = 2.00231930436092            # free-electron g, codata 2022 (-g_e)
AUT = 2.4188843265864e-17        # atomic unit of time, s, codata 2022
AUE = 5.14220675112e11           # atomic unit of field, V/m, codata 2022
HARTREE_CM = 219474.63136314     # hartree in cm^-1, codata 2022
BOHR_FM = 52917.7210544          # bohr in fm, codata 2022
CM_TO_HZ = C * 100.0

# NIST isotopic compositions page (nistiso)
M12_U = 12.0
M13_U = 13.00335483507

# app clocks, decision 0015 on feat/carbon-mode (dec0015)
EVENT_SLOW = 1e6                 # every rate divided by 1e6
LIGHT_S_PER_AU = 2.4189          # screen seconds per atomic unit of time
PANE_PX = 380                    # canvas height of the measured pane (400 by 380)

# Haris and Kramida 2017, Table 7 (hk2017): IS = E(13C) - E(12C), mK
IS_LEVELS = {
    '2p2_3P_1': 0.0747, '2p2_3P_2': 0.2125, '2p2_1D_2': 5, '2p2_1S_0': 40,
    '2s2p3_5So_2': 670, '2p3s_3Po_0': -92, '2p3s_3Po_1': -92, '2p3s_3Po_2': -92,
    '2p3s_1Po_1': -116, '2s2p3_3Do_3': 704, '2s2p3_3Do_1': 704, '2s2p3_3Do_2': 704,
    '2s2p3_3Po_1': 564, '2s2p3_3Po_2': 564, '2s2p3_3Po_0': 564,
    '2p3d_1Do_2': -11, '2p4s_3Po_0': -26, '2p4s_3Po_1': -27, '2p4s_3Po_2': -29,
    '2p3d_3Fo_2': -20, '2p3d_3Fo_3': -21, '2p3d_3Do_1': -31, '2p3d_3Do_2': -31,
    '2p3d_3Do_3': -31, '2p4s_1Po_1': -34, '2p3d_1Fo_3': -34, '2p3d_1Po_1': -31,
    '2p3d_3Po_2': 63.1, '2p3d_3Po_1': 61.4, '2p3d_3Po_0': 60.8, '2p4d_1Do_2': 23,
}
IS_3S1 = (105799.1137, 511.0)    # 2s2p3 3So1 level (cm^-1), IS (mK), hk2017 Table 7

# Mueller et al. 2025 (mu25): delta <r^2>(13,12) in fm^2, F of C4+
DR2 = -0.1245
F_C4 = -211.5                    # MHz/fm^2

# Verner et al. 1996 (verner) Table 1, C I fit
VERNER_CI = dict(Eth=11.26, E0=2.144, s0=502.7, ya=62.16, P=5.101,
                 yw=9.157e-2, y0=1.133, y1=1.607)

# Wang, Zatsarinny and Bartschat 2013 via hk2017 section 2.8: 2s2p3 3So1
A_RAD_3S1, A_AI_3S1 = 3.41e9, 1.50e9


def lev_term(lid):
    return lid.rsplit('_', 1)[0]


def jval(s):
    return float(eval(s)) if '/' in s else float(s)


def lsg(S, L, J):
    if J == 0:
        return None
    return 1 + (GS - 1) * (J * (J + 1) + S * (S + 1) - L * (L + 1)) / (2 * J * (J + 1))


LMAP = {'S': 0, 'P': 1, 'D': 2, 'F': 3, 'G': 4}


def main(path):
    d = json.load(open(path))
    levels = {l['id']: l for l in d['levels']}
    lines = d['lines']

    print('== A. fine structure of each term (from NIST levels) ==')
    terms = {}
    for l in d['levels']:
        terms.setdefault(lev_term(l['id']), []).append(l)
    print('term | span cm^-1 | span GHz | intervals cm^-1 | min natural FWHM MHz | beats per lifetime (span) | span period real ps | event clock us')
    for t, ls in terms.items():
        if len(ls) < 2:
            continue
        ls = sorted(ls, key=lambda x: x['energy_cm'])
        es = [x['energy_cm'] for x in ls]
        span = es[-1] - es[0]
        iv = ', '.join('%.3f' % (es[i + 1] - es[i]) for i in range(len(es) - 1))
        taus = [x['tau_s'] for x in ls if x['tau_s']]
        fwhm = 1 / (2 * math.pi * min(taus)) / 1e6 if taus else float('nan')
        beats = span * CM_TO_HZ * min(taus) if taus else float('nan')
        per = 1 / (span * CM_TO_HZ)
        print('%s | %.3f | %.1f | %s | %.3g | %.3g | %.3g | %.3g' % (
            t, span, span * CM_TO_HZ / 1e9, iv, fwhm, beats, per * 1e12, per * EVENT_SLOW * 1e6))

    print('\n== B. Lande g_J, LS formula with g_s, against NIST measured ==')
    ng = 0
    rows = []
    for l in d['levels']:
        term = l['term']
        S = (int(term[0]) - 1) / 2
        L = LMAP[term[1]]
        J = jval(l['J'])
        g = lsg(S, L, J)
        rows.append((l['id'], g, l['lande_g']))
    for lid, g, gm in rows:
        if gm:
            print('%s LS %.6f measured %s' % (lid, g, gm))
    gs = sorted(set(round(g, 4) for _, g, _ in rows if g is not None))
    print('distinct LS g values over the 68 levels:', gs)
    print('levels with J = 0 (no Zeeman shift):', [r[0] for r in rows if r[1] is None])
    for lid in ['2p3s_3Po_1', '2p3s_3Po_2', '2p3s_1Po_1', '2p4p_1P_1', '2p4p_1D_2',
                '2p4p_1S_0', '2p4p_3P_2', '2p4p_3D_3', '2p4d_3Fo_4']:
        print('  %s LS g %s' % (lid, [('%.4f' % g if g else 'none') for i, g, _ in rows if i == lid][0]))

    print('\n== C. Zeeman: splitting of adjacent M per unit g ==')
    for B in [5e-5, 1e-4, 1e-3, 1e-2, 0.1, 1.0, 10.0]:
        f = MUB_HZ_T * B
        print('B %g T: %.4g Hz real, %.4g cm^-1, event clock %.4g Hz, period on event clock %.4g s' % (
            B, f, f / CM_TO_HZ, f / EVENT_SLOW, EVENT_SLOW / f))
    print('cm^-1 per pixel, full diagram on %d px: %.0f' % (PANE_PX, 90820.348 / PANE_PX))
    px = math.log(10000 / 110) / 400
    print('spectrum strip, log 110 nm to 10 um over 400 px: d(lambda)/lambda per px %.4g' % px)
    print('156.1 nm isotope shift d(lambda)/lambda %.3g, fraction of a pixel %.3g' % (0.7038 / 64043.556, 0.7038 / 64043.556 / px))
    print('B for a ground-term Zeeman spread equal to the 16.4 cm^-1 interval (g=1.5, M=+-1):',
          16.4167 * CM_TO_HZ / (MUB_HZ_T * 1.5 * 2), 'T')

    print('\n== D. isotope shift 13C - 12C: normal and specific mass shift ==')
    m12n = M12_U - 6 * ME_U
    m13n = M13_U - 6 * ME_U
    kfac = ME_U / m12n - ME_U / m13n
    print('NMS factor m_e(1/M12 - 1/M13) with nuclear masses: %.6e' % kfac)
    print('level | E cm^-1 | IS mK (hk2017) | NMS mK | SMS = IS - NMS mK')
    for lid, isv in IS_LEVELS.items():
        E = levels[lid]['energy_cm']
        nms = E * kfac * 1e3
        print('%s | %.3f | %+.4g | %+.4g | %+.4g' % (lid, E, isv, nms, isv - nms))
    E, isv = IS_3S1
    print('2s2p3_3So_1 | %.3f | %+.4g | %+.4g | %+.4g' % (E, isv, E * kfac * 1e3, isv - E * kfac * 1e3))

    print('\n-- lines: IS in GHz against Doppler FWHM at 300 K and natural FWHM --')
    named = [('2s2p3_3Do_3', '2p2_3P_2', '156.1 nm'), ('2p3s_3Po_2', '2p2_3P_2', '165.7 nm'),
             ('2p3s_1Po_1', '2p2_1D_2', '193.1 nm'), ('2p3s_1Po_1', '2p2_1S_0', '247.9 nm'),
             ('2s2p3_5So_2', '2p2_3P_2', '296.7 nm'), ('2s2p3_3Po_1', '2p2_3P_0', '132.9 nm'),
             ('2p4s_3Po_1', '2p2_3P_0', '128.0 nm'), ('2p3d_3Po_1', '2p2_3P_0', '126.1 nm'),
             ('2p2_1S_0', '2p2_3P_1', '462.3 nm M1'), ('2p2_1D_2', '2p2_3P_2', '985 nm M1'),
             ('2p2_3P_1', '2p2_3P_0', '609 um 492 GHz'), ('2p2_3P_2', '2p2_3P_1', '370 um 809 GHz')]
    for up, lo, name in named:
        sig = levels[up]['energy_cm'] - levels[lo]['energy_cm']
        ism = IS_LEVELS[up] - IS_LEVELS.get(lo, 0.0)
        nu = sig * CM_TO_HZ
        dop = nu * math.sqrt(8 * KB * 300 * math.log(2) / (M13_U * U_KG * C ** 2))
        tau = levels[up]['tau_s']
        nat = 1 / (2 * math.pi * tau) if tau else float('nan')
        print('%s: sigma %.3f cm^-1, IS %+.4g mK = %+.4g MHz, Doppler FWHM(300 K) %.4g MHz, natural FWHM %.3g MHz, IS/Doppler %.3g, IS in pm %.3g' % (
            name, sig, ism, ism * 1e-3 * CM_TO_HZ / 1e6, dop / 1e6, nat / 1e6,
            ism * 1e-3 * CM_TO_HZ / dop, abs(ism * 1e-3) / sig ** 2 * 1e10))
    sig = IS_3S1[0]
    nu = sig * CM_TO_HZ
    dop = nu * math.sqrt(8 * KB * 300 * math.log(2) / (M13_U * U_KG * C ** 2))
    print('94.5 nm 3S1: IS 511 mK = %.4g MHz, Doppler FWHM(300 K) %.4g MHz' % (0.511 * CM_TO_HZ / 1e6, dop / 1e6))

    print('\n== E. field shift: one-electron estimate for removing one 2s electron ==')
    rb = d['orbitals']['ground_rhf']['s_basis']

    def r0(key):
        s = 0.0
        for b in rb:
            if b['n'] != 1:
                continue
            N = (2 * b['zeta']) ** (b['n'] + 0.5) / math.sqrt(math.factorial(2 * b['n']))
            s += b[key] * N
        return s
    R1, R2 = r0('c1s'), r0('c2s')
    print('R1s(0) %.4f, R2s(0) %.4f, R1s^2+R2s^2 %.4f (table rho_at_0 800.79993)' % (R1, R2, R1 ** 2 + R2 ** 2))
    psi2 = R2 ** 2 / (4 * math.pi)
    dE_h = (2 * math.pi / 3) * 6 * psi2 * DR2 / BOHR_FM ** 2
    print('|psi_2s(0)|^2 = %.4f bohr^-3, field-shift factor per 2s electron %.4g MHz/fm^2, for delta<r^2> = %g fm^2: %.4g MHz = %.3g mK' % (
        psi2, (2 * math.pi / 3) * 6 * psi2 / BOHR_FM ** 2 * HARTREE_CM * CM_TO_HZ / 1e6,
        DR2, dE_h * HARTREE_CM * CM_TO_HZ / 1e6, dE_h * HARTREE_CM * 1e3))
    print('C4+ 2S-2P: F %.1f MHz/fm^2 times delta<r^2> = %.1f MHz (mu25 states 26.3(1.4) MHz)' % (F_C4, F_C4 * DR2))

    print('\n== F. 13C hyperfine (Wolber 1970 via hk2017) ==')
    for name, A, F1, F2 in [('3P1', 2.838, 0.5, 1.5), ('3P2', 149.055, 1.5, 2.5)]:
        print('%s: A %.3f MHz, A*Fmax %.3f MHz (measured splitting in hk2017 Table 8)' % (name, A, A * F2))
    for nu_ghz, name in [(492.16, '492 GHz'), (809.34, '809 GHz')]:
        dop = nu_ghz * 1e9 * math.sqrt(8 * KB * 300 * math.log(2) / (M13_U * U_KG * C ** 2))
        print('%s Doppler FWHM 300 K: %.3f MHz, at 20 K: %.3f MHz' % (
            name, dop / 1e6, dop / 1e6 * math.sqrt(20 / 300)))
    print('hyperfine 372.6 MHz on event clock: %.1f Hz' % (372.6e6 / EVENT_SLOW))

    print('\n== G. Rydberg wave packets ==')
    ie2 = 90883.743
    R_C = d['ionization']['R_C_cm']
    print('n* | T_K real | T_K event clock | T_K light clock | T_rev real | F_ion V/cm')
    for ns in [2.28, 3.30, 5, 10, 20, 30, 41.6, 50, 68.3]:
        tk = 2 * math.pi * ns ** 3 * AUT
        trev = 2 * ns / 3 * tk
        fion = AUE / 100 / (16 * ns ** 4)
        print('%.2f | %.4g s | %.4g s | %.4g s | %.4g s | %.4g' % (
            ns, tk, tk * EVENT_SLOW, 2 * math.pi * ns ** 3 * LIGHT_S_PER_AU, trev, fion))
    print('n* above which 2pnp 3D3 (limit 2P3/2) lies above the first limit: %.2f' % math.sqrt(R_C / (ie2 - 90820.348)))

    print('\n== H. Rabi frequency, two-level formula Omega = sqrt(3 lambda^3 A I /(2 pi h c)) ==')
    sel = [('2p3s_3Po_2', '2p2_3P_2'), ('2s2p3_3Do_3', '2p2_3P_2'), ('2p3s_1Po_1', '2p2_1D_2'),
           ('2p3d_1Do_2', '2p2_1D_2'), ('2p4d_3Fo_3', '2p2_3P_2'), ('2p4d_3Fo_2', '2p2_3P_1'),
           ('2p4d_1Do_2', '2p2_1D_2'), ('2p4p_1P_1', '2p3s_1Po_1'),
           ('2p2_1S_0', '2p2_3P_1'), ('2p2_1D_2', '2p2_3P_2'), ('2p2_3P_1', '2p2_3P_0')]
    for up, lo in sel:
        ln = [x for x in lines if x['upper'] == up and x['lower'] == lo][0]
        lam = 1e-2 / ln['wn_cm']
        A = ln['A_s']
        tau = levels[up]['tau_s']
        ltau = levels[lo]['tau_s']
        isat = math.pi * H * C * A / (3 * lam ** 3)        # W/m^2 for the partial rate
        def om(I_wcm2):
            return math.sqrt(3 * lam ** 3 * A * I_wcm2 * 1e4 / (2 * math.pi * H * C))
        gam_up = 1 / tau / (2 * math.pi)
        gam_lo = (1 / ltau / (2 * math.pi)) if ltau else 0.0
        need = max(gam_up, gam_lo)
        I_need = (2 * math.pi * need) ** 2 * 2 * math.pi * H * C / (3 * lam ** 3 * A) / 1e4
        cyc = max(1 / tau, (1 / ltau) if ltau else 0.0)   # one full cycle per lifetime
        I_cyc = (2 * math.pi * cyc) ** 2 * 2 * math.pi * H * C / (3 * lam ** 3 * A) / 1e4
        I30 = (2 * math.pi * 30e6) ** 2 * 2 * math.pi * H * C / (3 * lam ** 3 * A) / 1e4
        print('%s -> %s %s %.2f nm A %.3g: Isat(partial) %.3g W/cm^2, Omega/2pi at 1 W/cm^2 %.3g Hz, at 1 kW/cm^2 %.3g Hz, damping width (larger of the two levels) %.3g Hz, I for Omega/2pi = that %.3g W/cm^2, 1/tau (one cycle per lifetime) %.3g Hz, I for that %.3g W/cm^2, I for 30 MHz %.3g W/cm^2' % (
            up, lo, ln['type'], lam * 1e9, A, isat / 1e4, om(1) / (2 * math.pi), om(1e3) / (2 * math.pi), need, I_need, cyc, I_cyc, I30))

    print('\n== I. static scalar polarizability from the listed E1 lines (partial sums) ==')
    for lid in ['2p2_3P_0', '2p2_1D_2', '2p3s_3Po_2', '2p3s_1Po_1', '2p3p_3D_3', '2p3p_1P_1', '2p4p_1P_1', '2p4p_3D_3']:
        Ei = levels[lid]['energy_cm']
        gi = levels[lid]['g']
        a = 0.0
        nterm = 0
        for x in lines:
            if x['type'] != 'E1':
                continue
            if x['lower'] == lid:
                dE = (x['Ek_cm'] - Ei) / HARTREE_CM
                a += x['f_ik'] / dE ** 2
                nterm += 1
            elif x['upper'] == lid:
                dE = (x['Ei_cm'] - Ei) / HARTREE_CM
                f = -(x['g_i'] / gi) * x['f_ik']
                a += f / dE ** 2
                nterm += 1
        for F in [1e3, 1e4]:
            Fau = F * 100 / AUE
            shift = -0.5 * a * Fau ** 2 * HARTREE_CM * CM_TO_HZ
            print('%s: alpha (partial, %d lines) %.4g a.u., at %g V/cm Stark shift %.4g MHz' % (lid, nterm, a, F, shift / 1e6))

    print('\n== J. photoionization from the ground term, Verner 1996 fit to smoothed OP data ==')
    p = VERNER_CI
    for E in [11.26, 11.5, 12.0, 13.0, 15.0, 20.0, 30.0]:
        x = E / p['E0'] - p['y0']
        y = math.sqrt(x ** 2 + p['y1'] ** 2)
        F = ((x - 1) ** 2 + p['yw'] ** 2) * y ** (0.5 * p['P'] - 5.5) * (1 + math.sqrt(y / p['ya'])) ** (-p['P'])
        s = p['s0'] * F
        print('E %.2f eV (%.1f nm): sigma %.3f Mb = %.3g cm^2, rate at 1 W/cm^2 %.3g s^-1' % (
            E, 1239.84198 / E, s, s * 1e-18, s * 1e-18 * 1.0 / (E * 1.602176634e-19)))

    print('\n== K. autoionizing 2s2p3 3So1 ==')
    tot = A_RAD_3S1 + A_AI_3S1
    print('Gamma_AI/2pi %.4g MHz, total FWHM %.4g MHz, lifetime %.4g s, AI share %.3f, on event clock %.4g s' % (
        A_AI_3S1 / (2 * math.pi) / 1e6, tot / (2 * math.pi) / 1e6, 1 / tot, A_AI_3S1 / tot, EVENT_SLOW / tot))


if __name__ == '__main__':
    main(sys.argv[1])
