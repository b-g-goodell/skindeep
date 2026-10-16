#!/usr/bin/env python3
"""Neutral carbon (C I) data for the Carbon mode (issue #144, Phase 1).

  carbon_data.py build DLDIR OUT   build the data file from downloaded sources
  carbon_data.py check JSON        check the data file's internal consistency

DLDIR holds the downloads named in SOURCES (NIST ASD 5.12 CSV exports, the
NIST MCHF lifetime table, the CCL copy of the Bunge 1993 RHF tables). The
check reads the data file alone. Run Python with -I on downloaded files.
"""
import csv
import json
import math
import os
import re
import sys

ASD = 'https://physics.nist.gov/cgi-bin/ASD/'
LEVELS_Q = ('energy1.pl?de=0&spectrum=C+I&submit=Retrieve+Data&units={u}&format=2'
            '&output=0&page_size=15&multiplet_ordered=0&conf_out=on&term_out=on'
            '&level_out=on&unc_out=1&j_out=on&lande_out=on&perc_out=on&biblio=on&temp=')
LINES_Q = ('lines1.pl?spectra=C+I&limits_type=0&low_w=&upp_w=&unit=1&submit=Retrieve+Data'
           '&de=0&format=2&line_out=0&en_unit=0&output=0&bibrefs=1&page_size=15'
           '&show_obs_wl=1&show_calc_wl=1&unc_out=1&order_out=0&max_low_enrg='
           '&max_upp_enrg=&tsb_value=0&min_str=&A_out=0&f_out=on&S_out=on&intens_out=on'
           '&max_str=&allowed_out=1&forbid_out=1&min_accur=&min_intens=&conf_out=on'
           '&term_out=on&enrg_out=on&J_out=on&g_out=on&remove_js=on&show_wn=1&show_av={av}')
ACCESSED = '2026-10-15'

SOURCES = {
    'asd': {
        'cite': 'Kramida, A., Ralchenko, Yu., Reader, J., and NIST ASD Team (2024). '
                'NIST Atomic Spectra Database (ver. 5.12). National Institute of Standards '
                'and Technology, Gaithersburg, MD. DOI 10.18434/T4W30F',
        'version': '5.12', 'accessed': ACCESSED, 'url': 'https://physics.nist.gov/asd',
        'files': {'levels.csv': ASD + LEVELS_Q.format(u=0),
                  'levels_ev.csv': ASD + LEVELS_Q.format(u=1),
                  'lines_av3.csv': ASD + LINES_Q.format(av=3),
                  'lines_av2.csv': ASD + LINES_Q.format(av=2)}},
    'hk2017': {
        'cite': 'K. Haris and A. Kramida, Critically evaluated spectral data for neutral '
                'carbon (C I), Astrophys. J. Suppl. Ser. 233, 16 (2017), '
                'DOI 10.3847/1538-4365/aa86ab, arXiv:1704.07474',
        'version': 'arXiv v1 PDF', 'accessed': ACCESSED,
        'url': 'https://arxiv.org/pdf/1704.07474'},
    'mchf': {
        'cite': 'NIST MCHF/MCDHF Collection, version 2 (C. Froese Fischer, G. Tachiev), '
                'C I energy levels and lifetimes, Breit-Pauli. Its reference list '
                '(references.pl) returned HTTP 500, so the paper behind the table '
                'is not named here',
        'version': '2, last update 2010-09-15', 'accessed': ACCESSED,
        'url': 'https://nlte.nist.gov/MCHF/Elements/C/C_6.4.LT-lev.lt.db',
        'files': {'mchf/lt.db': 'https://nlte.nist.gov/MCHF/Elements/C/C_6.4.LT-lev.lt.db'}},
    'bunge1993': {
        'cite': 'C. F. Bunge, J. A. Barrientos and A. V. Bunge, Roothaan-Hartree-Fock '
                'ground-state atomic wave functions: Slater-type orbital expansions and '
                'expectation values for Z = 2-54, At. Data Nucl. Data Tables 53, 113 (1993), '
                'file RHF.TABLES as mirrored by the Computational Chemistry List',
        'version': 'RHF.TABLES of 1993-09-13', 'accessed': ACCESSED,
        'url': 'https://ccl.net/cca/data/atomic-RHF-wavefunctions/tables',
        'files': {'ccl/tables.txt': 'https://ccl.net/cca/data/atomic-RHF-wavefunctions/tables'}},
    'cie1931': {
        'cite': 'CIE (2019), Colour-matching functions of CIE 1931 standard colorimetric '
                'observer (data table, 1 nm, from CIE 018:2019 Table 6), International '
                'Commission on Illumination, Vienna, DOI 10.25039/CIE.DS.xvudnb9b',
        'version': 'CIE_xyz_1931_2deg.csv, md5 17cca777db64b17170f06f67ce9d3ab7', 'accessed': ACCESSED,
        'url': 'https://files.cie.co.at/Publications-datasets/CIE_xyz_1931_2deg.csv',
        'files': {'cie/cmf.csv': 'https://files.cie.co.at/Publications-datasets/CIE_xyz_1931_2deg.csv'}},
    'css4': {
        'cite': 'W3C, CSS Color Module Level 4, Candidate Recommendation Draft of '
                '2026-10-09, section 19, XYZ_to_lin_sRGB and gam_sRGB',
        'version': '2026-10-09', 'accessed': ACCESSED,
        'url': 'https://www.w3.org/TR/css-color-4/'},
}

# The terms the mode uses, as NIST names them. Closed under radiative decay:
# every NIST-listed decay of a selected level ends on a selected level (the
# check reports the coverage).
TERMS = [
    ('2s2.2p2', '3P'), ('2s2.2p2', '1D'), ('2s2.2p2', '1S'),
    ('2s.2p3', '5S*'),
    ('2s2.2p.3s', '3P*'), ('2s2.2p.3s', '1P*'),
    ('2s.2p3', '3D*'),
    ('2s2.2p.3p', '1P'), ('2s2.2p.3p', '3D'), ('2s2.2p.3p', '3S'),
    ('2s2.2p.3p', '3P'), ('2s2.2p.3p', '1D'), ('2s2.2p.3p', '1S'),
    ('2s.2p3', '3P*'),
    ('2s2.2p.3d', '1D*'), ('2s2.2p.4s', '3P*'), ('2s2.2p.3d', '3F*'),
    ('2s2.2p.3d', '3D*'), ('2s2.2p.4s', '1P*'), ('2s2.2p.3d', '1F*'),
    ('2s2.2p.3d', '1P*'), ('2s2.2p.3d', '3P*'),
    ('2s2.2p.4p', '1P'), ('2s2.2p.4p', '3D'), ('2s2.2p.4p', '3S'),
    ('2s2.2p.4p', '3P'), ('2s2.2p.4p', '1D'), ('2s2.2p.4p', '1S'),
    ('2s2.2p.4d', '1D*'), ('2s2.2p.5s', '3P*'), ('2s2.2p.4d', '3F*'),
    ('2s2.2p.4d', '3D*'), ('2s2.2p.5s', '1P*'), ('2s2.2p.4d', '1F*'),
    ('2s2.2p.4d', '1P*'), ('2s2.2p.4d', '3P*'),
]

# Draw-only Rydberg series (no rates): Haris and Kramida's IE fit series.
RYDBERG = [
    ('2pnp 3D3', re.compile(r'^2s2\.2p\.(?:\(2P\*<3/2>\)\.)?(\d+)p$'), ('3D', '2[5/2]'), '3'),
    ('2pnd 3Fo4', re.compile(r'^2s2\.2p\.(\d+)d$'), ('3F*',), '4'),
]

# Rydberg constant for carbon, R_C, as Haris and Kramida (sec. 7) quote it.
R_C = 109732.303

MCHF_CONF = {'2s(2).2p(2)': '2s2.2p2', '2s.2p(3)': '2s.2p3', '2s(2).2p_2P.3s': '2s2.2p.3s'}


def clean(v):
    v = v.strip()
    if v.startswith('="') and v.endswith('"'):
        v = v[2:-1]
    return v.strip()


def read_asd(path):
    rows, hdr = [], None
    with open(path, newline='', encoding='utf-8') as fh:
        for r in csv.reader(fh):
            if not r:
                continue
            if r[0].startswith('obs_wl') or r[0] == 'Configuration':
                hdr = [h.strip() for h in r]
                continue
            rows.append({h: clean(v) for h, v in zip(hdr, r) if h})
    return rows


def num(x):
    x = (x or '').strip().strip('[]()+?')
    try:
        return float(x)
    except ValueError:
        return None


def short_conf(c):
    return c.replace('2s2.', '').replace('.', '').replace('2s2p3', '2s2p3')


def level_id(conf, term, j):
    t = term.replace('*', 'o')
    return '%s_%s_%s' % (short_conf(conf), t, j)


def parity(term):
    return 'odd' if term.endswith('*') else 'even'


def wl_band(nm):
    if nm < 200:
        return 'VUV'
    if nm < 380:
        return 'UV'
    if nm <= 780:
        return 'visible'
    return 'IR'


def read_cmf(path):
    t = {}
    for line in open(path, encoding='ascii'):
        w, x, y, z = line.strip().split(',')
        t[int(w)] = (float(x), float(y), float(z))
    return t


def srgb_hex(cmf, w):
    # CIE 1931 2-degree colour matching functions at w, linear between the
    # 1 nm rows, through CSS Color 4 XYZ_to_lin_sRGB. A spectral colour lies
    # outside the sRGB gamut: negative channels are clipped to zero and the
    # largest scaled to 1, then gam_sRGB. Clip and scale are this document's
    # convention.
    lo = int(math.floor(w))
    t = w - lo
    X, Y, Z = [(1 - t) * a + t * b for a, b in zip(cmf[lo], cmf[lo + 1])]
    M = [[12831 / 3959, -329 / 214, -1974 / 3959],
         [-851781 / 878810, 1648619 / 878810, 36519 / 878810],
         [705 / 12673, -2585 / 12673, 705 / 667]]
    rgb = [max(0.0, M[i][0] * X + M[i][1] * Y + M[i][2] * Z) for i in range(3)]
    hi = max(rgb)
    rgb = [c / hi for c in rgb]

    def gam(v):
        return 1.055 * v ** (1 / 2.4) - 0.055 if v > 0.0031308 else 12.92 * v
    return '#%02x%02x%02x' % tuple(int(round(255 * gam(c))) for c in rgb), Y


def read_mchf(path):
    out, conf, term = {}, None, None
    pat = re.compile(r'^(\S+)?\s+(\S+)?\s+(\d)\s+(-3\d\.\d+)\s*(.*)$')
    for line in open(path, encoding='ascii'):
        m = pat.match(line.rstrip('\n'))
        if not m:
            continue
        c, t, j, e, rest = m.groups()
        if c and t is None:
            t = c
            c = None
        if c:
            conf = next(v for k, v in MCHF_CONF.items() if c.startswith(k))
        if t:
            term = t
        tau = rest.split()[-1] if rest.split() else None
        out[(conf, term, j)] = {'energy_au': float(e),
                                'tau_s': float(tau) if tau and 'e' in tau else None}
    return out


def read_bunge(path):
    txt = open(path, encoding='ascii').read()
    blk = txt[txt.index('CARBON, Z=6'):txt.index('NITROGEN, Z=7')]
    lines = blk.splitlines()
    head = lines[0].split()
    tot = re.search(r'TOTAL ENERGY.*\n\s*(\S+)\s+(\S+)\s+(\S+)\s+(\S+)', blk)
    rho0 = re.search(r'RHOat0 = (\S+)\s+Kato cusp = (\S+)', blk)
    ev = {}
    for key in ('ORB.ENERGY', '<R>', '<R**2>', '<1/R>', '<1/R**2>'):
        m = re.search(r'^' + re.escape(key) + r'\s+(\S+)\s+(\S+)\s+(?:' + re.escape(key)
                      + r')?\s*(\S+)', blk, re.M)
        ev[key] = [float(m.group(1)), float(m.group(2)), float(m.group(3))]
    m = re.search(r'<1/R\*\*3>\s+(\S+)', blk)
    ev['<1/R**3>'] = [None, None, float(m.group(1))]
    s_basis, p_basis = [], []
    for ln in lines:
        m = re.match(r'^(\d)S\s+(\S+)\s+(\S+)\s+(\S+)(?:\s+(\d)P\s+(\S+)\s+(\S+))?\s*$', ln)
        if m:
            s_basis.append({'n': int(m.group(1)), 'zeta': float(m.group(2)),
                            'c1s': float(m.group(3)), 'c2s': float(m.group(4))})
            if m.group(5):
                p_basis.append({'n': int(m.group(5)), 'zeta': float(m.group(6)),
                                'c2p': float(m.group(7))})
    return {
        'state': ' '.join(head[2:]),
        'total_energy_hartree': float(tot.group(1)),
        'kinetic_energy_hartree': float(tot.group(2)),
        'virial_ratio': float(tot.group(4)),
        'rho_at_0': float(rho0.group(1)), 'kato_cusp': float(rho0.group(2)),
        'orbital_energy_hartree': {'1s': ev['ORB.ENERGY'][0], '2s': ev['ORB.ENERGY'][1],
                                   '2p': ev['ORB.ENERGY'][2]},
        'expect': {k: {'1s': v[0], '2s': v[1], '2p': v[2]} for k, v in ev.items()
                   if k != 'ORB.ENERGY'},
        's_basis': s_basis, 'p_basis': p_basis,
        'form': 'R_nl(r) = sum_j c_j N_j r^(n_j - 1) exp(-zeta_j r), '
                'N_j = (2 zeta_j)^(n_j + 1/2) / sqrt((2 n_j)!), r in bohr',
        'src': 'bunge1993'}


def build(dl, out):
    lv = read_asd(os.path.join(dl, 'levels.csv'))
    lve = read_asd(os.path.join(dl, 'levels_ev.csv'))
    vac = read_asd(os.path.join(dl, 'lines_av3.csv'))
    air = read_asd(os.path.join(dl, 'lines_av2.csv'))
    mchf = read_mchf(os.path.join(dl, 'mchf', 'lt.db'))
    cmf = read_cmf(os.path.join(dl, 'cie', 'cmf.csv'))
    assert len(lv) == len(lve)
    want = set(TERMS)
    levels, by_key = [], {}
    limits = {}
    for r, re_ in zip(lv, lve):
        assert (r['Configuration'], r['Term'], r['J']) == (re_['Configuration'], re_['Term'], re_['J'])
        if r['Term'] == 'Limit':
            limits['2P1/2' if '1/2' in r['Configuration'] else '2P3/2'] = {
                'energy_cm': num(r['Level (cm-1)']), 'unc_cm': num(r['Uncertainty (cm-1)']),
                'energy_eV': num(re_['Level (eV)']), 'unc_eV': num(re_['Uncertainty (eV)']),
                'nist': r['Configuration'], 'src': 'asd'}
            continue
        key = (r['Configuration'], r['Term'], r['J'])
        if (key[0], key[1]) not in want:
            continue
        j = r['J']
        g = int(round(2 * eval_j(j) + 1))
        lead = r['Leading percentages'].split()
        rec = {
            'id': level_id(*key), 'conf': key[0], 'term': key[1], 'J': j, 'g': g,
            'parity': parity(key[1]),
            'energy_cm': num(r['Level (cm-1)']), 'energy_cm_str': r['Level (cm-1)'],
            'unc_cm': num(r['Uncertainty (cm-1)']), 'unc_cm_str': r['Uncertainty (cm-1)'],
            'energy_eV': num(re_['Level (eV)']), 'energy_eV_str': re_['Level (eV)'],
            'unc_eV': num(re_['Uncertainty (eV)']), 'unc_eV_str': re_['Uncertainty (eV)'],
            'lande_g': r['Lande'] or None,
            'leading_pct': int(lead[0]) if lead else None,
            'second_component': ' '.join(lead[2:]) if len(lead) > 2 else None,
            'nist_refs': r['Reference'], 'src': 'asd'}
        m = mchf.get(key)
        if m:
            rec['mchf_tau_s'] = m['tau_s']
            rec['mchf_src'] = 'mchf'
        levels.append(rec)
        by_key[key] = rec
    levels.sort(key=lambda x: x['energy_cm'])
    # Air wavelengths, keyed by the level pair.
    air_by = {}
    for r in air:
        if 'obs_wl_air(nm)' in r:
            air_by[(r['Ei(cm-1)'], r['Ek(cm-1)'], r['J_i'], r['J_k'], r['term_i'], r['term_k'])] = r
    lines = []
    for r in vac:
        if not r['Aki(s^-1)']:
            continue
        ku = (r['conf_k'], r['term_k'], r['J_k'])
        kl = (r['conf_i'], r['term_i'], r['J_i'])
        if ku not in by_key or kl not in by_key:
            continue
        a = air_by.get((r['Ei(cm-1)'], r['Ek(cm-1)'], r['J_i'], r['J_k'], r['term_i'], r['term_k']))
        wl = num(r['ritz_wl_vac(nm)']) or num(r['obs_wl_vac(nm)'])
        rec = {
            'upper': by_key[ku]['id'], 'lower': by_key[kl]['id'],
            'wl_vac_ritz_nm': num(r['ritz_wl_vac(nm)']), 'wl_vac_ritz_unc_nm': num(r['unc_ritz_wl']),
            'wl_vac_obs_nm': num(r['obs_wl_vac(nm)']), 'wl_vac_obs_unc_nm': num(r['unc_obs_wl']),
            'wl_air_ritz_nm': num(a['ritz_wl_air(nm)']) if a else None,
            'wl_air_obs_nm': num(a['obs_wl_air(nm)']) if a else None,
            'wn_cm': num(r['wn(cm-1)']),
            'A_s': num(r['Aki(s^-1)']), 'A_str': r['Aki(s^-1)'], 'acc': r['Acc'],
            'f_ik': num(r['fik']), 'f_str': r['fik'] or None, 'S_au': num(r['S(a.u.)']),
            'type': r['Type'] or 'E1', 'g_i': int(r['g_i']), 'g_k': int(r['g_k']),
            'Ei_cm': num(r['Ei(cm-1)']), 'Ek_cm': num(r['Ek(cm-1)']),
            'rel_int': r['intens'] or None,
            'tp_ref': r['tp_ref'], 'line_ref': r['line_ref'] or None,
            'band': wl_band(wl), 'src': 'asd'}
        # Spin change between LS terms: an intercombination line.
        rec['intercombination'] = ku[1][0] != kl[1][0]
        if rec['band'] == 'visible':
            c, y = srgb_hex(cmf, rec['wl_air_ritz_nm'] or wl)
            rec['rgb'] = c
            rec['cie_ybar'] = round(y, 6)
            rec['rgb_src'] = 'cie1931+css4'
        lines.append(rec)
    # Branching and lifetimes from the selected lines.
    tot = {}
    for ln in lines:
        tot[ln['upper']] = tot.get(ln['upper'], 0.0) + ln['A_s']
    for ln in lines:
        ln['branch'] = ln['A_s'] / tot[ln['upper']]
    for lv_ in levels:
        t = tot.get(lv_['id'])
        lv_['sumA_s'] = t
        lv_['tau_s'] = 1 / t if t else None
    # Coverage against every NIST-listed decay, selected or not.
    alltot = {}
    for r in vac:
        ku = (r['conf_k'], r['term_k'], r['J_k'])
        if ku in by_key and r['Aki(s^-1)']:
            alltot[ku] = alltot.get(ku, 0.0) + num(r['Aki(s^-1)'])
    for key, rec in by_key.items():
        if key in alltot:
            rec['coverage'] = tot.get(rec['id'], 0.0) / alltot[key]
    # Rydberg series, draw only.
    lim32 = limits['2P3/2']['energy_cm']
    ryd = []
    for name, pat, terms, j in RYDBERG:
        for r in lv:
            m = pat.match(r['Configuration'])
            if m and r['Term'] in terms and r['J'] == j:
                e = num(r['Level (cm-1)'])
                nstar = math.sqrt(R_C / (lim32 - e))
                ryd.append({'series': name, 'n': int(m.group(1)), 'conf': r['Configuration'],
                            'term': r['Term'], 'J': j, 'energy_cm': e,
                            'unc_cm': num(r['Uncertainty (cm-1)']),
                            'n_star': round(nstar, 5), 'quantum_defect': round(int(m.group(1)) - nstar, 5),
                            'src': 'asd'})
    # Effective quantum numbers of the outer electron, by term centroid.
    lim12 = limits['2P1/2']['energy_cm']
    centroid_limit = (2 * lim12 + 4 * lim32) / 6
    outer = []
    for conf, term in TERMS:
        m = re.match(r'^2s2\.2p\.(\d)([spd])$', conf)
        if not m:
            continue
        ls = [x for x in levels if x['conf'] == conf and x['term'] == term]
        ec = sum(x['g'] * x['energy_cm'] for x in ls) / sum(x['g'] for x in ls)
        nstar = math.sqrt(R_C / (centroid_limit - ec))
        n, l = int(m.group(1)), 'spd'.index(m.group(2))
        nr = n - 3  # radial nodes of the model: 0 for 3s, 3p, 3d
        lam = nstar - nr - 1
        outer.append({'conf': conf, 'term': term, 'n': n, 'l': l,
                      'centroid_cm': round(ec, 4), 'n_star': round(nstar, 4),
                      'quantum_defect': round(n - nstar, 4),
                      'binding_hartree': round(0.5 / nstar ** 2, 6),
                      'n_r': nr, 'lambda': round(lam, 4),
                      'mean_r_bohr': round((3 * nstar ** 2 - lam * (lam + 1)) / 2, 3)})
    bunge = read_bunge(os.path.join(dl, 'ccl', 'tables.txt'))
    angular = angular_occupations()
    data = {
        'about': 'Neutral carbon (C I) data for the Carbon mode, issue #144 Phase 1. '
                 'See docs/research/carbon-atom.md. Built by scripts/research/carbon_data.py.',
        'units': {'energy_cm': 'cm^-1', 'energy_eV': 'eV', 'wl': 'nm', 'A_s': 's^-1',
                  'tau_s': 's', 'S_au': 'atomic units', 'orbital': 'bohr, hartree'},
        'accuracy_codes': {'AAA': 0.003, 'AA': 0.01, 'A+': 0.02, 'A': 0.03, 'B+': 0.07,
                           'B': 0.10, 'C+': 0.18, 'C': 0.25, 'D+': 0.40, 'D': 0.50, 'E': None,
                           'note': 'upper bound of the relative uncertainty of A, E is over 0.50',
                           'src': 'asd'},
        'sources': SOURCES,
        'ionization': {'limits': limits,
                       'ie_hk2017': {'energy_cm': 90820.348, 'unc_cm': 0.009,
                                     'energy_eV': 11.2602880, 'unc_eV': 0.0000011, 'src': 'hk2017'},
                       'R_C_cm': R_C, 'R_C_src': 'hk2017'},
        'levels': levels, 'lines': lines,
        'rydberg_draw_only': ryd,
        'outer_electron': {'limit_centroid_cm': round(centroid_limit, 4),
                           'note': 'n* = sqrt(R_C / (limit centroid - term centroid)), '
                                   'centroids g-weighted, computed here from asd levels. '
                                   'Model orbital P(r) = N r^(lambda+1) exp(-r/n*) '
                                   'L_{n_r}^{(2 lambda + 1)}(2 r / n*), lambda = n* - n_r - 1, '
                                   'mean_r = (3 n*^2 - lambda (lambda + 1)) / 2',
                           'terms': outer},
        'orbitals': {'ground_rhf': bunge, 'angular': angular},
    }
    with open(out, 'w', encoding='ascii') as fh:
        json.dump(data, fh, indent=1, ensure_ascii=True)
        fh.write('\n')
    print('levels %d lines %d rydberg %d -> %s' % (len(levels), len(lines), len(ryd), out))


def angular_occupations():
    # Occupation of each one-electron m in an LS state |L M_L> of p^2 (equivalent)
    # or p l' (non-equivalent). With M_L fixed the one-body density matrix is
    # diagonal in m, so rho = sum_m n_m |Y_lm|^2 R^2 for each subshell.
    from sympy.physics.quantum.cg import CG
    out = []
    pairs = [('p2', 1, 1, [('3P', 1), ('1D', 2), ('1S', 0)])]
    for lo, name in ((0, 'ps'), (1, 'pp'), (2, 'pd')):
        Ls = list(range(abs(1 - lo), 1 + lo + 1))
        pairs.append((name, 1, lo, [(None, L) for L in Ls]))
    for name, l1, l2, terms in pairs:
        for term, L in terms:
            for M in range(0, L + 1):
                occ1 = {m: 0.0 for m in range(-l1, l1 + 1)}
                occ2 = {m: 0.0 for m in range(-l2, l2 + 1)}
                for m1 in range(-l1, l1 + 1):
                    m2 = M - m1
                    if abs(m2) > l2:
                        continue
                    c2 = float(CG(l1, m1, l2, m2, L, M).doit()) ** 2
                    occ1[m1] += c2
                    occ2[m2] += c2
                if name == 'p2':
                    occ = {str(m): round(occ1[m] + occ2[m], 6) for m in occ1}
                    out.append({'shells': '2p^2', 'term': term, 'L': L, 'M_L': M, 'n_2p_m': occ})
                else:
                    out.append({'shells': '2p nl, l=%d' % l2, 'L': L, 'M_L': M,
                                'n_2p_m': {str(m): round(v, 6) for m, v in occ1.items()},
                                'n_nl_m': {str(m): round(v, 6) for m, v in occ2.items()}})
    return {'note': 'density of a subshell = sum_m n_m |Y_lm|^2 R(r)^2. '
                    'spin and M_S do not enter. Occupations from Clebsch-Gordan coefficients (sympy)',
            'states': out}


def eval_j(j):
    if '/' in j:
        a, b = j.split('/')
        return int(a) / int(b)
    return int(j)


def check(path):
    d = json.load(open(path, encoding='ascii'))
    lv = {x['id']: x for x in d['levels']}
    ok = True

    def bad(msg):
        nonlocal ok
        ok = False
        print('FAIL', msg)
    print('levels %d, lines %d' % (len(lv), len(d['lines'])))
    # 1. Ordering and degeneracy.
    es = [x['energy_cm'] for x in d['levels']]
    ie = d['ionization']['limits']['2P1/2']['energy_cm']
    if es != sorted(es) or es[0] != 0 or max(es) >= ie or len(set(lv)) != len(es):
        bad('level order')
    print('1 order: %d levels sorted by energy, unique ids, from %g to %g cm^-1, all below the IE %g'
          % (len(es), es[0], es[-1], ie))
    for ln in d['lines']:
        u, l_ = lv[ln['upper']], lv[ln['lower']]
        if not u['energy_cm'] > l_['energy_cm']:
            bad('upper not above lower %s %s' % (ln['upper'], ln['lower']))
        if ln['g_k'] != u['g'] or ln['g_i'] != l_['g']:
            bad('g mismatch %s' % ln['upper'])
        if ln['Ek_cm'] != u['energy_cm'] or ln['Ei_cm'] != l_['energy_cm']:
            bad('level energy mismatch %s -> %s' % (ln['upper'], ln['lower']))
    print('1 every line: E_upper > E_lower, g = 2J+1 on both ends, line energies equal level energies')
    # 2. Wavelength from level difference against NIST Ritz (vacuum).
    worst, worst_sig, n = 0.0, 0.0, 0
    for ln in d['lines']:
        if ln['wl_vac_ritz_nm'] is None:
            continue
        u, l_ = lv[ln['upper']], lv[ln['lower']]
        wl = 1e7 / (u['energy_cm'] - l_['energy_cm'])
        res = wl - ln['wl_vac_ritz_nm']
        # Rounding of the listed Ritz value: half a unit of its last digit.
        s = ('%r' % ln['wl_vac_ritz_nm'])
        dec = len(s.split('.')[1]) if '.' in s else 0
        half = 0.5 * 10 ** -dec
        n += 1
        if abs(res) / ln['wl_vac_ritz_nm'] > abs(worst):
            worst = res / ln['wl_vac_ritz_nm']
            wline = (ln['upper'], ln['lower'], ln['wl_vac_ritz_nm'], wl)
        unc = ln['wl_vac_ritz_unc_nm'] or 0
        sig = abs(res) / max(unc, half)
        worst_sig = max(worst_sig, sig)
        if abs(res) > max(unc, half) + half:
            bad('Ritz residual %s -> %s: %.3g nm (unc %.3g)' % (ln['upper'], ln['lower'], res, unc))
    print('2 Ritz vac: %d lines, max |relative residual| %.2e (%s -> %s listed %r, from levels %.7f), '
          'max residual / max(unc, rounding) %.2f' % (n, abs(worst), wline[0], wline[1], wline[2], wline[3], worst_sig))
    # 2b. Observed against Ritz.
    oo = [(abs(ln['wl_vac_obs_nm'] - ln['wl_vac_ritz_nm']) / (ln['wl_vac_obs_unc_nm'] or 1e9), ln)
          for ln in d['lines'] if ln['wl_vac_obs_nm'] and ln['wl_vac_ritz_nm'] and ln['wl_vac_obs_unc_nm']]
    oo.sort(key=lambda t: -t[0])
    big = [t for t in oo if t[0] > 3]
    print('2b obs - Ritz: %d lines with both, %d beyond 3 sigma of the observed uncertainty, worst %.1f sigma (%s -> %s)'
          % (len(oo), len(big), oo[0][0], oo[0][1]['upper'], oo[0][1]['lower']))
    # 3. Air against vacuum: the ratio is the refractive index of standard air.
    nm1 = [(ln['wl_vac_ritz_nm'] / ln['wl_air_ritz_nm'] - 1, ln['wl_air_ritz_nm'])
           for ln in d['lines'] if ln['wl_air_ritz_nm']]
    nm1.sort(key=lambda t: t[1])
    # Tolerance: the rounding of the two listed values.
    def rnd(x):
        t = '%r' % x
        return 0.5 * 10 ** -(len(t.split('.')[1]) if '.' in t else 0) / x
    tol = {ln['wl_air_ritz_nm']: rnd(ln['wl_air_ritz_nm']) + rnd(ln['wl_vac_ritz_nm'])
           for ln in d['lines'] if ln['wl_air_ritz_nm']}
    mono = all(b[0] <= a[0] + tol[a[1]] + tol[b[1]] for a, b in zip(nm1, nm1[1:]))
    print('3 air: %d lines, n - 1 from %.4e at %.1f nm to %.4e at %.1f nm, %s with wavelength within rounding'
          % (len(nm1), nm1[0][0], nm1[0][1], nm1[-1][0], nm1[-1][1],
             'non-increasing' if mono else 'NOT monotone'))
    if not mono:
        bad('air index not monotone')
    for ln in d['lines']:
        w = ln['wl_vac_ritz_nm'] or ln['wl_vac_obs_nm']
        s = 1e7 / w
        has = ln['wl_air_ritz_nm'] is not None
        if (5000 < s < 50000) != has:
            bad('air convention %s -> %s' % (ln['upper'], ln['lower']))
    print('3 air convention: air given exactly for 5000 < sigma < 50000 cm^-1')
    # 4. A, f and lifetimes.
    def sig_round(t):
        # Relative half unit of the last listed digit of a NIST number string.
        mant = t.lower().split('e')[0]
        digits = mant.replace('.', '').lstrip('0') or '0'
        dec = len(mant.split('.')[1]) if '.' in mant else 0
        last = 10 ** -dec if '.' in mant else 1
        return 0.5 * last / float(mant) if len(digits) else 1
    worst, over = 0, 0
    for ln in d['lines']:
        if ln['f_ik'] is None:
            continue
        w = (ln['wl_vac_ritz_nm'] or ln['wl_vac_obs_nm']) * 10
        f = ln['A_s'] * 1.49919e-16 * ln['g_k'] / ln['g_i'] * w * w
        rel = abs(f - ln['f_ik']) / ln['f_ik']
        if rel > sig_round(ln['A_str']) + sig_round(ln['f_str']):
            over += 1
        if rel > worst:
            worst, wl_ = rel, ln
    print('4 f from A (NIST formula f = 1.49919e-16 A (g_k/g_i) lambda^2, lambda in angstrom): '
          'max relative deviation %.3f (%s -> %s, A = %s), %d lines beyond the rounding of A and f'
          % (worst, wl_['upper'], wl_['lower'], wl_['A_str'], over))
    if over:
        bad('f against A')
    sums = {}
    for ln in d['lines']:
        sums[ln['upper']] = sums.get(ln['upper'], 0) + ln['branch']
    dev = max(abs(v - 1) for v in sums.values())
    print('4 branching ratios: %d upper levels, max |sum - 1| %.1e' % (len(sums), dev))
    cov = [x for x in d['levels'] if 'coverage' in x]
    mc = min(cov, key=lambda x: x['coverage'])
    print('4 closure: min coverage %.10f (%s): selected lower levels carry that share of the NIST-listed rate'
          % (mc['coverage'], mc['id']))
    print('4 lifetimes, 1/sum(A) against MCHF:')
    for x in d['levels']:
        if x.get('mchf_tau_s') and x['tau_s']:
            print('   %-14s 1/sumA %.4g s   MCHF %.4g s   ratio %.3f' % (x['id'], x['tau_s'], x['mchf_tau_s'],
                                                                      x['tau_s'] / x['mchf_tau_s']))
    s1 = [ln for ln in d['lines'] if ln['upper'] == '2p2_1S_0']
    no_e2 = sum(ln['A_s'] for ln in s1 if ln['lower'] != '2p2_1D_2')
    print('   2p2_1S_0 without its E2 decay to 2p2_1D_2: 1/sumA %.4g s' % (1 / no_e2))
    # 5. Cascade: every level reaches the ground level by listed decays.
    down = {}
    for ln in d['lines']:
        down.setdefault(ln['upper'], []).append(ln['lower'])
    g0 = d['levels'][0]['id']
    stuck = []
    for x in d['levels']:
        seen, todo = set(), [x['id']]
        while todo:
            y = todo.pop()
            if y in seen:
                continue
            seen.add(y)
            todo.extend(down.get(y, []))
        if g0 not in seen:
            stuck.append(x['id'])
    print('5 cascade: %d of %d levels reach %s, stuck: %s' % (len(lv) - len(stuck), len(lv), g0, stuck or 'none'))
    if stuck:
        bad('cascade')
    # 6. eV against cm^-1: one conversion factor.
    rat = [x['energy_eV'] / x['energy_cm'] for x in d['levels'] if x['energy_cm'] > 1000]
    print('6 eV / cm^-1: %.10e to %.10e' % (min(rat), max(rat)))
    # 7. Orbitals: normalization, orthogonality, expectation values against the table.
    o = d['orbitals']['ground_rhf']
    # Exact integrals of STO products: int r^m exp(-a r) dr = m! / a^(m+1).
    def integral(b1, k1, b2, k2, power):
        tot = 0.0
        for x in b1:
            for y in b2:
                n1 = (2 * x['zeta']) ** (x['n'] + 0.5) / math.sqrt(math.factorial(2 * x['n']))
                n2 = (2 * y['zeta']) ** (y['n'] + 0.5) / math.sqrt(math.factorial(2 * y['n']))
                m = x['n'] + y['n'] + power
                tot += x[k1] * y[k2] * n1 * n2 * math.factorial(m) / (x['zeta'] + y['zeta']) ** (m + 1)
        return tot
    orb = {'1s': (o['s_basis'], 'c1s'), '2s': (o['s_basis'], 'c2s'), '2p': (o['p_basis'], 'c2p')}
    print('7 RHF orbitals (Bunge 1993), exact integrals against the table:')
    names = [('<R>', 1), ('<R**2>', 2), ('<1/R>', -1), ('<1/R**2>', -2), ('<1/R**3>', -3)]
    worst = 0
    for k, (b, c) in orb.items():
        nrm = integral(b, c, b, c, 0)
        row = ['norm %.7f' % nrm]
        worst = max(worst, abs(nrm - 1))
        for nm, pw in names:
            ref = o['expect'][nm][k]
            if ref is None:
                continue
            val = integral(b, c, b, c, pw)
            row.append('%s %.6f/%.6f' % (nm, val, ref))
            worst = max(worst, abs(val - ref) / abs(ref))
        print('   %s: %s' % (k, ', '.join(row)))
    ov = integral(o['s_basis'], 'c1s', o['s_basis'], 'c2s', 0)
    print('   <1s|2s> = %.2e, worst relative deviation from the table %.1e' % (ov, worst))
    # Only the 1S functions (n = 1) are nonzero at r = 0.
    r0 = {c: sum(b[c] * (2 * b['zeta']) ** 1.5 / math.sqrt(2) for b in o['s_basis'] if b['n'] == 1)
          for c in ('c1s', 'c2s')}
    print('   R1s(0)^2 + R2s(0)^2 = %.4f (table RHOat0 %.5f), electron density at the nucleus '
          '2(R1s(0)^2 + R2s(0)^2)/(4 pi) = %.4f bohr^-3'
          % (r0['c1s'] ** 2 + r0['c2s'] ** 2, o['rho_at_0'], 2 * (r0['c1s'] ** 2 + r0['c2s'] ** 2) / (4 * math.pi)))
    if abs(ov) > 1e-5:
        bad('orthogonality')
    if worst > 1e-4:
        bad('orbital expectation values')
    # 8. Outer-electron model orbitals: norm and <r> by quadrature.
    def lag(k, a, x):
        p0, p1 = 1.0, 1.0 + a - x
        if k == 0:
            return p0
        for i in range(1, k):
            p0, p1 = p1, ((2 * i + 1 + a - x) * p1 - (i + a) * p0) / (i + 1)
        return p1
    worst = 0
    for t in d['outer_electron']['terms']:
        ns, lam, nr = t['n_star'], t['lambda'], t['n_r']
        h = 0.002
        nrm = mr = 0.0
        for i in range(1, int(60 * ns * ns / h)):
            r = i * h
            pr = r ** (lam + 1) * math.exp(-r / ns) * lag(nr, 2 * lam + 1, 2 * r / ns)
            nrm += pr * pr * h
            mr += pr * pr * r * h
        mean = (3 * ns * ns - lam * (lam + 1)) / 2
        worst = max(worst, abs(mr / nrm - mean) / mean)
    print('8 outer-electron model: %d terms, <r> by quadrature against (3 n*^2 - lambda(lambda+1))/2, '
          'max relative deviation %.1e' % (len(d['outer_electron']['terms']), worst))
    if worst > 1e-3:
        bad('outer model <r>')
    ang = d['orbitals']['angular']['states']
    dev = max(abs(sum(s['n_2p_m'].values()) + sum(s.get('n_nl_m', {}).values()) - 2) for s in ang)
    print('8 angular occupations: %d states, max |sum of occupations - 2| %.1e' % (len(ang), dev))
    print('RESULT', 'PASS' if ok else 'FAIL')
    return ok


if __name__ == '__main__':
    if len(sys.argv) == 4 and sys.argv[1] == 'build':
        build(sys.argv[2], sys.argv[3])
    elif len(sys.argv) == 3 and sys.argv[1] == 'check':
        sys.exit(0 if check(sys.argv[2]) else 1)
    else:
        sys.exit(__doc__)
