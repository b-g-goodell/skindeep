# The neutral carbon atom beyond one configuration

Status: current, issue #154, gathered 2026-10-15. It builds on Phase 1
(`docs/research/carbon-atom.md`, cited as phase1) and
`docs/research/carbon-photon.md`, and does not repeat them. Research
only: no mode is built under this issue. Every number comes from a
source in section 1 or from a script in `scripts/research/carbon_beyond/`,
whose header says how to run it: `carbon_casscf.py`, cited as "run"
(PySCF 2.14.0, Python 3.12.3, 4 OpenMP threads, basis cc-pCVTZ of 43
functions, $D_{2h}$ symmetry, output in
`docs/research/carbon-beyond-casscf.out`), `carbon_compare.py`, cited as
"compare" (published numbers against the NIST levels of
`docs/research/carbon-atom-data.json`), `part_b_calc.py`, cited as
"calc" with its output section A to K, and `onset.js`, `bench.js` and
`picture.js`, cited by name (Node v22.23.3, AMD Ryzen 7 7800X3D, a
shared host at load average 24, so the timings are pessimistic).

## 0. Summary

- Precise solutions (Q1). The best variational bound on the
  nonrelativistic ground energy is $-37.844889402$ Eh, its extrapolation
  $-37.844906(4)$ Eh (Strasburger 2019). The correlation energy is
  $-0.156287$ Eh, 4.25 eV. No high-precision C I wave function exists as
  a file one can load. Large MCHF/CI puts ${}^1D$ and ${}^1S$ within 30
  $\mathrm{cm^{-1}}$ of experiment.
- Corrections (Q2). Only the relativistic fine structure (2 to 60
  $\mathrm{cm^{-1}}$ per triplet term) is large enough to see on the
  mode's scales, and only in the ground-term inset. QED, mass and isotope
  shifts, field shift and hyperfine structure are under a pixel. The
  ${}^{13}$C isotope shift reaches $+0.70\ \mathrm{cm^{-1}}$ (21 GHz) on
  the $2s^2 2p^2 \to 2s2p^3$ lines, and its sign flips between $2s \to
  2p$ and $2p \to nl$ excitations because the specific mass shift
  dominates.
- Correlation (Q3). About 2 % of the ground state is $2p^4$
  ($|c_2| \approx 0.14$ to $0.15$, computed here, no published value).
  Correlation contracts the density by 0.3 % in $\langle r \rangle$. The
  Fermi hole is exact within Hartree-Fock and computable from the orbitals
  the mode already holds. The Coulomb hole is about a fifth of it at the
  reference electron and cuts the on-top pair density by 42 % (computed
  here, 87 % of the correlation energy).
- Dynamics (Q4). Zeeman precession is the one dynamic with C I data that
  falls on the event clock with no new clock: 14 Hz on screen per mT per
  unit $g_J$. It is filed as issue #158. Fine-structure beats, hyperfine
  beats and Rydberg Kepler periods fall between the event clock and the
  light clock. Rabi flopping fits the event clock only on the 119 to 136
  nm lines to $2p4d$ levels. Above 11.26 eV NIST lists real autoionizing
  levels, and photoionization from the ground term is 18.3 Mb at
  threshold.
- Open codes (Q5). PySCF does every correlation calculation of Q3 on this
  host in under a minute. GRASP2018 is the one open code that writes
  correlated numerical radial orbitals directly.
- Prior art (Q6). Every density viewer found draws hydrogen or one
  electron. Published carbon pair-density and Coulomb-hole results are
  plots only.
- Branched flow. The QED vacuum gives no random medium and bound orbitals
  have no flow to branch. A C I line branches in a real medium only past
  350 m in strong air turbulence, and not within the Galaxy in the
  interstellar medium. No smooth random potential surrounds a free atom
  for a photoelectron to branch in. The onset distance has an exact
  point-source formula, $L = 3.592\,l\,\epsilon^{-2/3}$, checked here by
  ray tracing to a few percent. A ray renderer through a cached Gaussian
  field fits the frame budget, as a separate view at its own scale.

## 1. Sources

| key | citation | version | accessed |
| --- | --- | --- | --- |
| phase1 | `docs/research/carbon-atom.md` and `docs/research/carbon-atom-data.json`, this repository, Phase 1 of #144 (NIST ASD 5.12 levels and lines, Bunge 1993 orbitals) | in hand | 2026-10-15 |
| photon | `docs/research/carbon-photon.md`, this repository | in hand | 2026-10-15 |
| dec0015 | `docs/decisions/0015-visualization.md` on branch `feat/carbon-mode`, section "2026-10-15: Carbon": event clock (rates divided by $10^6$), light clock ($c/10^{17}$, 2.4189 s per atomic unit of time), pane 400 by 380 px, spectrum strip log 110 nm to 10 $\mu$m, Carbon median 7.9 ms per frame | in hand | 2026-10-15 |
| asd | A. Kramida, Yu. Ralchenko, J. Reader and NIST ASD Team, NIST Atomic Spectra Database, DOI 10.18434/T4W30F. C I levels as in phase1, and re-exported with the Phase 1 query URL (`LEVELS_Q` in `scripts/research/carbon_data.py`) without the Phase 1 energy cap: 435 rows, Lande $g$ column | 5.12, CSV | 2026-10-15 |
| hk2017 | K. Haris and A. Kramida, Critically evaluated spectral data for neutral carbon (C I), ApJS 233, 16 (2017), DOI 10.3847/1538-4365/aa86ab. Sections 1, 2.7, 2.8, 4, 7, Tables 5 to 8 | arXiv:1704.07474 v1 PDF | 2026-10-15 |
| glab18 | W. L. Glab, K. Haris and A. Kramida, Revision of the ionization energy of neutral carbon, J. Phys. Commun. (2018), DOI 10.1088/2399-6528/aac421 | arXiv:1805.04700 PDF | 2026-10-15 |
| mchf | NIST MCHF/MCDHF Collection (C. Froese Fischer, G. Tachiev), C I levels and lifetimes, Breit-Pauli, https://nlte.nist.gov/MCHF/Elements/C/C_6.4.LT-lev.lt.db | version 2, last update 2010-09-15 | 2026-10-15 |
| ff2006 | C. Froese Fischer, Some improved transition probabilities for neutral carbon, J. Phys. B 39, 2159 (2006), DOI 10.1088/0953-4075/39/9/005, https://nlte.nist.gov/MCHF/all/p289.pdf. Section 2, text on compositions | PDF | 2026-10-15 |
| bunge1993 | C. F. Bunge, J. A. Barrientos and A. V. Bunge, Roothaan-Hartree-Fock ground-state atomic wave functions, At. Data Nucl. Data Tables 53, 113 (1993), as RHF.TABLES (phase1) | RHF.TABLES of 1993-09-13 | 2026-10-15 |
| str2019 | K. Strasburger, Explicitly correlated wave functions of the ground state and the lowest quintuplet state of the carbon atom, Phys. Rev. A 99, 052512 (2019), erratum Phys. Rev. A 99, 069901 (2019). Tables I to IV, section III | arXiv:1903.06051 v4 PDF (2020) | 2026-10-15 |
| seth2011 | P. Seth, P. Lopez Rios and R. J. Needs, Quantum Monte Carlo study of the first-row atoms and ions, J. Chem. Phys. 134, 084105 (2011), DOI 10.1063/1.3554625. Tables II, IV, V, VI | arXiv:1012.0709 v4 PDF | 2026-10-15 |
| brown2007 | M. D. Brown, J. R. Trail, P. Lopez Rios and R. J. Needs, Energies of the first row atoms from quantum Monte Carlo, J. Chem. Phys. 126, 224110 (2007), DOI 10.1063/1.2743972 | arXiv:1011.4343 PDF | 2026-10-15 |
| cg2011 | T. Carette and M. R. Godefroid, A theoretical study of the C$^-$ ${}^4S^o_{3/2}$ and ${}^2D^o_{3/2,5/2}$ bound states and C ground configuration: fine and hyperfine structures, isotope shifts and transition probabilities, Phys. Rev. A 83, 062505 (2011), DOI 10.1103/PhysRevA.83.062505. Tables I, VII, IX, X | arXiv:1101.5318 v1 PDF | 2026-10-15 |
| rt2017 | M. B. Ruiz and R. Troger, Configuration interaction study of the ${}^3P$ ground state of the carbon atom, Adv. Quantum Chem. 76, 223 (2018). Tables 2, 4, 5, abstract | arXiv:1707.09738 PDF | 2026-10-15 |
| pfau2020 | D. Pfau, J. S. Spencer, A. G. de G. Matthews and W. M. C. Foulkes, Ab initio solution of the many-electron Schroedinger equation with deep neural networks, Phys. Rev. Research 2, 033429 (2020), DOI 10.1103/PhysRevResearch.2.033429. Table I | arXiv:1909.02487 PDF | 2026-10-15 |
| chak1993 | S. J. Chakravorty, S. R. Gwaltney, E. R. Davidson, F. A. Parpia and C. Froese Fischer, Ground-state correlation energies for atomic ions with 3 to 18 electrons, Phys. Rev. A 47, 3649 (1993), DOI 10.1103/PhysRevA.47.3649 | abstract only, paywalled. Its carbon value relayed through seth2011 Table II and str2019 Table II | 2026-10-15 |
| vn2022 | M. Via-Nadal, M. Rodriguez-Mayorga, E. Ramos-Cordoba and E. Matito, Range separation of the Coulomb hole, J. Chem. Phys. (2022), DOI 10.1063/5.0085284. Section 3, Figures 7, 8, S4 | arXiv:2201.05550 v1 PDF | 2026-10-15 |
| th2021 | L. G. Todd and J. W. Hollett, Measuring correlated electron motion in atoms with the momentum-balance density, J. Chem. Phys. (2021), DOI 10.1063/5.0039387. Abstract, Figure 6 | arXiv:2012.01543 v1 PDF | 2026-10-15 |
| b06 | J. C. Berengut, V. V. Flambaum and M. G. Kozlov, Calculation of isotope shifts and relativistic shifts in C I, C II, C III and C IV, Phys. Rev. A 73, 012504 (2006). Section II, Tables IV to VII | arXiv:physics/0509253 PDF | 2026-10-15 |
| rz26 | P. Rzhevskii, D. Tumakov, T. Shomenov and S. Bubin, Fine-structure splittings in low-lying triplet states of the carbon atom, Phys. Rev. Research 8, 013126 (2026), DOI 10.1103/v4jk-j7c9 | abstract page only | 2026-10-15 |
| rz25 | P. Rzhevskii, Highly accurate calculations of spin-dependent relativistic corrections in small atoms with one and two p-electrons, master's thesis, Nazarbayev University (2025), https://nur.nu.edu.kz/items/dc5e9f9f-999a-4d82-89f6-1428257d7e42/full | abstract page only, the PDF link returned HTML | 2026-10-15 |
| mu25 | P. Mueller et al., The nuclear charge radius of ${}^{13}$C, Nature Communications 16, 6234 (2025), DOI 10.1038/s41467-025-60280-9. Table II, Eqs. 3 and 4 | arXiv:2507.05680 PDF | 2026-10-15 |
| verner | D. A. Verner, G. J. Ferland, K. T. Korista and D. G. Yakovlev, Atomic data for astrophysics II: new analytic fits for photoionization cross sections of atoms and ions, ApJ 465, 487 (1996). Eq. 1, Table 1 row C I | arXiv:astro-ph/9601009 v2 PDF | 2026-10-15 |
| cheng24 | Y. Cheng, Relativistic and electron correlation effects in static dipole polarizabilities for main-group elements (2024). Group 14 table | arXiv:2408.10513 v2 PDF | 2026-10-15 |
| steck | D. A. Steck, Rubidium 87 D Line Data, http://steck.us/alkalidata, Eqs. 49, 50, 61 | revision 2.3.4, 2025-08-08 | 2026-10-15 |
| nistiso | NIST, Atomic Weights and Isotopic Compositions for Carbon, https://physics.nist.gov/cgi-bin/Compositions/stand_alone.pl?ele=C: ${}^{13}$C 13.00335483507(23) u, abundance 0.0107(8) | page | 2026-10-15 |
| codata | 2022 CODATA recommended values, NIST, https://physics.nist.gov/cuu/Constants and Table/allascii.txt: $1\ \mathrm{Eh} = 219474.63136314(24)\ \mathrm{cm^{-1}}$, $\mu_B/h = 1.39962449171(44)\times10^{10}$ Hz/T, $m_e = 5.485799090441(97)\times10^{-4}$ u, $u = 1.66053906892(52)\times10^{-27}$ kg, atomic unit of time $2.4188843265864(26)\times10^{-17}$ s, atomic unit of field $5.14220675112(80)\times10^{11}$ V/m, $r_e$ | 2022 | 2026-10-15 |
| cantu81 | A. M. Cantu, M. Mazzoni, M. Pettini and G. P. Tozzi, Photoionization spectrum of the ${}^3P$ ground state of neutral carbon, Phys. Rev. A 23, 1223 (1981) | APS abstract only | 2026-10-15 |
| lab05 | I. Labazan, E. Reinhold, W. Ubachs and V. V. Flambaum, Wavelength calibration of the C I line at 94.5 nm for comparison with quasar data, Phys. Rev. A 71, 040501(R) (2005) | APS abstract only | 2026-10-15 |
| wzb13 | Y. Wang, O. Zatsarinny and K. Bartschat, B-spline R-matrix-with-pseudostates calculations for electron-impact excitation and ionization of carbon, Phys. Rev. A 87, 012704 (2013) | APS abstract only, its autoionization rate relayed through hk2017 | 2026-10-15 |
| codes | GitHub repositories, licence and tree read by `gh api`: compas/grasp, pyscf/pyscf, psi4/psi4, QMCPACK/qmcpack, filippi-claudia/champ, ghb24/NECI_STABLE, sanshar/Dice, block-hczhai/block2-preview, susilehtola/HelFEM, google-deepmind/ferminet, atsp-org/atsp. ATSP2K terms: https://nlte.nist.gov/cgi-bin/MCHF/download.pl?d=ATSP2K. CASINO terms: https://vallico.net/casinoqmc/ | repository heads | 2026-10-15 |
| heller2021 | E. J. Heller, R. Fleischmann and T. Kramer, Branched flow, Physics Today 74(12), 44 (2021), DOI 10.1063/PT.3.4902 | arXiv:1910.07086 v1 PDF (2019) | 2026-10-15 |
| kaplan2002 | L. Kaplan, Statistics of branched flow in a weak correlated random potential, Phys. Rev. Lett. 89, 184103 (2002) | arXiv:nlin/0206040 PDF | 2026-10-15 |
| topinka2001 | M. A. Topinka, B. J. LeRoy, R. M. Westervelt, S. E. J. Shaw, R. Fleischmann, E. J. Heller, K. D. Maranowski and A. C. Gossard, Coherent branched flow in a two-dimensional electron gas, Nature 410, 183 (2001) | arXiv:cond-mat/0010348 PDF | 2026-10-15 |
| patsyk2020 | A. Patsyk, U. Sivan, M. Segev and M. A. Bandres, Observation of branched flow of light, Nature 583, 60 (2020), DOI 10.1038/s41586-020-2376-8 | abstract only, body paywalled | 2026-10-15 |
| patsyk2022 | A. Patsyk, Y. Sharabi, U. Sivan and M. Segev, Incoherent branched flow of light, Phys. Rev. X 12, 021007 (2022), DOI 10.1103/PhysRevX.12.021007 | open access HTML | 2026-10-15 |
| barkhofen2013 | S. Barkhofen, J. J. Metzger, R. Fleischmann, U. Kuhl and H.-J. Stoeckmann, Experimental observation of a fundamental length scale of waves in random media, Phys. Rev. Lett. 111, 183902 (2013). Eq. 2 | arXiv:1308.1583 PDF | 2026-10-15 |
| maryenko2012 | D. Maryenko, F. Ospald, K. v. Klitzing, J. H. Smet, J. J. Metzger, R. Fleischmann, T. Geisel and V. Umansky, How branching can change the conductance of ballistic semiconductor devices, Phys. Rev. B 85, 195329 (2012). Appendix A, from Metzger's thesis | arXiv:1204.3775, appendix read as rendered pixels, printed page 6 | 2026-10-15 |
| metzger2014 | J. J. Metzger, R. Fleischmann and T. Geisel, Statistics of extreme waves in random media, Phys. Rev. Lett. 112, 203903 (2014). Eqs. 4, 5 | arXiv:1311.4578 PDF | 2026-10-15 |
| metzger2010 | J. J. Metzger, R. Fleischmann and T. Geisel, Universal statistics of branched flows, Phys. Rev. Lett. 105, 020601 (2010) | abstract as quoted by search only, not on arXiv, paywalled | 2026-10-15 |
| linma2021 | H. Lin and X. Ma, Theoretical and experimental investigation into the branched flow phenomenon of light, student preprint. Eq. 2.2.2.5, Sec. 4 | arXiv:2112.03176, Eq. 2.2.2.5 read as rendered pixels | 2026-10-15 |
| jiang2022 | K. Jiang et al., Branched flow of intense laser light in plasma with uneven density distribution | arXiv:2109.14327 v2 (2022) | 2026-10-15 |
| dg1998 | W. Dittrich and H. Gies, Light propagation in non-trivial QED vacua, Phys. Rev. D 58, 025004 (1998). Eq. 1 | arXiv:hep-ph/9804375 PDF | 2026-10-15 |
| urban2013 | M. Urban, F. Couchot, X. Sarazin and A. Djannati-Atai, The quantum vacuum as the origin of the speed of light, Eur. Phys. J. D 67, 58 (2013) | arXiv:1302.6165 PDF | 2026-10-15 |
| lambwiki | Wikipedia, Lamb shift, Welton's derivation, secondary for T. A. Welton, Phys. Rev. 74, 1157 (1948), which was not read | web page | 2026-10-15 |
| cox2021 | M. A. Cox, N. Mphuthi, I. Nape, N. P. Mashaba, L. Cheng and A. Forbes, Structured light in turbulence, IEEE J. Sel. Top. Quantum Electron. 27(2), 1 (2021), DOI 10.1109/JSTQE.2020.3023790. Eqs. 9, 10, citing Andrews and Phillips | arXiv:2005.14586 PDF | 2026-10-15 |
| kulikov2011 | V. A. Kulikov, M. S. Andreeva, A. V. Koryabin and V. I. Shmalhausen, Method of estimation of turbulence characteristic scales | arXiv:1112.6033 PDF | 2026-10-15 |
| ars1995 | J. W. Armstrong, B. J. Rickett and S. R. Spangler, Electron density power spectrum in the local interstellar medium, ApJ 443, 209 (1995) | abstract only, at https://www.cita.utoronto.ca/~mamd/BIB/armstrong95.html | 2026-10-15 |
| se2004 | J. Scalo and B. G. Elmegreen, Interstellar turbulence II: implications and effects, ARA&A 42, 275 (2004). Eq. 9, and Cordes, Weisberg and Boriakoff (1985) relayed through it | arXiv:astro-ph/0404452 PDF | 2026-10-15 |
| kramer | T. Kramer, branch (kick-drift script), https://github.com/tobiaskramer/branch, GPL-2.0 | repository head | 2026-10-15 |
| dauger | Dauger Research, Atom in a Box, https://www.daugerresearch.com/orbitals/index.shtml | web page | 2026-10-15 |
| falstadmo | P. Falstad, Molecular orbitals applet, https://www.falstad.com/qmmo/ | web page | 2026-10-15 |
| orbitron | M. Winter, The Orbitron, Sheffield, https://winter.group.shef.ac.uk/orbitron/ | web page | 2026-10-15 |
| quvis | QuVis, University of St Andrews, https://www.st-andrews.ac.uk/physics/quvis/ | web page | 2026-10-15 |
| 3b1b | 3Blue1Brown, sitemap (204 URLs) and lesson barber-pole-2, https://www.3blue1brown.com/lessons/barber-pole-2 | web pages | 2026-10-15 |
| aps1999 | APS News, Creating art from classical and quantum chaos (December 1999), https://www.aps.org/apsnews/1999/12/creating-art-from-classical-and-quantum-chaos | web page | 2026-10-15 |
| mit2001 | MIT News, art from chaos (2001), https://news.mit.edu/2001/artschaos-0308 | web page | 2026-10-15 |
| stodolna2013 | A. S. Stodolna et al., Hydrogen atoms under magnification: direct observation of the nodal structure of Stark states, Phys. Rev. Lett. 110, 213001 (2013), DOI 10.1103/PhysRevLett.110.213001 | abstract only | 2026-10-15 |
| goulielmakis2010 | E. Goulielmakis et al., Real-time observation of valence electron motion, Nature 466, 739 (2010), DOI 10.1038/nature09212 | Crossref record only | 2026-10-15 |
| ott2014 | C. Ott et al., Reconstruction and control of a time-dependent two-electron wave packet, Nature 516, 374 (2014), DOI 10.1038/nature14026 | Crossref record only | 2026-10-15 |
| coulson1961 | C. A. Coulson and A. H. Neilson, Electron correlation in the ground state of helium, Proc. Phys. Soc. 78, 831 (1961), DOI 10.1088/0370-1328/78/5/328 | Crossref record only | 2026-10-15 |
| becke1990 | A. D. Becke and K. E. Edgecombe, A simple measure of electron localization in atomic and molecular systems, J. Chem. Phys. 92, 5397 (1990), DOI 10.1063/1.458517 | Crossref record only | 2026-10-15 |

Relayed numbers. Energies reach section 2.1 through str2019 Table II
from papers not read here, each marked "relayed": Sasaki and Yoshimine,
Phys. Rev. A 9, 17 (1974), Sharkey, Bubin and Adamowicz, J. Chem. Phys.
132, 184106 (2010), Bubin et al., Chem. Rev. 113, 36 (2013), Noga,
Kedzuch, Simunek and Ten-no, J. Chem. Phys. 128, 174103 (2008),
Maldonado, Sarsa, Buendia and Galvez, J. Chem. Phys. 134, 134102
(2011), Nakatsuji, Nakashima and Kurokawa, J. Chem. Phys. 149, 114106
(2018). Measurements reach section 3 only as hk2017 quotes them: Wolber,
Figger, Haberstroh and Penselin, Phys. Lett. A 29, 461 (1969) and Z.
Phys. 236, 337 (1970) (W69, W70), Yamamoto and Saito, ApJ 370, L103
(1991) (Y91), Klein et al., ApJ 494, 125 (1998) (K98), Holmes, JOSA 41,
360 (1951) (H51), Burnett, Phys. Rev. 80, 494 (1950), Bernheim and
Kittrell (1980) (B80), Kozlov, Tupitsyn and Reimers, Phys. Rev. A 79,
022117 (2009) (K09).

## 2. Solutions of the many-electron equation (question 1)

Units: hartree (Eh) for total energies, $\mathrm{cm^{-1}}$ for level
energies, bohr for lengths, with $1\ \mathrm{Eh} = 219474.63136314(24)\
\mathrm{cm^{-1}}$ (codata). A nonrelativistic term energy is compared
with experiment against the ${}^3P$ centroid, $(0 + 3 \cdot 16.4167130 +
5 \cdot 43.4134567)/9 = 29.5908\ \mathrm{cm^{-1}}$ (compare), so that
the fine structure, which no nonrelativistic calculation holds, drops
out.

### 2.1 The nonrelativistic ground-state energy

All values: infinite nuclear mass, point nucleus, no relativity, ${}^3P$
ground term. $\Delta = E - E_{\rm ex}$ against str2019's extrapolated
limit $E_{\rm ex} = -37.844906(4)$. "corr" is the share of the
correlation energy $E_{\rm ex} - E_{\rm HF} = -0.156287$ Eh recovered,
with $E_{\rm HF} = -37.688619$ (seth2011 Table II, from ATSP2K, equal to
bunge1993's $-37.68861890$). $\Delta$ and corr: compare.

| method | $E$ (Eh) | $\Delta$ (mEh) | corr % | source |
| --- | --- | --- | --- | --- |
| Hartree-Fock, numerical limit | -37.688619 | +156.287 | 0 | seth2011 Table II |
| CI, selected CSFs, Slater orbitals [7s6p5d4f3g], 1080 CSFs | -37.83526523 | +9.641 | 93.83 | rt2017 abstract, Table 2 |
| CI SDTQ, $l_{\max} = 6$ | -37.8393 | +5.606 | 96.41 | relayed, str2019 Table II |
| ECG (explicitly correlated Gaussians), 500 functions | -37.84012879 | +4.777 | 96.94 | relayed, str2019 Table II |
| DMC (diffusion Monte Carlo), Maldonado et al. | -37.84185(5) | +3.056 | 98.04 | relayed, str2019 Table II |
| ECG, 1000 functions | -37.843333 | +1.573 | 98.99 | relayed, str2019 Table II |
| MCHF, active set to $n = 12$, $l \le 7$ | -37.844170 | +0.736 | 99.53 | cg2011 Table I, row 12k |
| CCSD(T)-F12 | -37.844334 | +0.572 | 99.63 | relayed, str2019 Table II |
| DMC, multideterminant-Jastrow-backflow | -37.84446(6) | +0.446 | 99.71 | seth2011 Table II |
| MCHF and CI, final, with $n = 13$ and $l = 8$ corrections | -37.844525 | +0.381 | 99.76 | cg2011 Table I, row Final |
| MCHF extrapolated in $n$ (error about $10^{-5}$ Eh in $n$, $10^{-4}$ Eh in $l$) | -37.84465 | +0.256 | 99.84 | cg2011 text after Table I |
| FermiNet (neural-network VMC) | -37.84471(5) | +0.196 | 99.87 | pfau2020 Table I |
| CCSD(T)/CBS | -37.8448 | +0.106 | 99.93 | pfau2020 Table I |
| ECG lobe functions, 5896 functions, variational | -37.844889402 | +0.017 | 99.99 | str2019 Tables I, II |
| ECG lobes, extrapolated | -37.844906(4) | 0 | 100 | str2019 Tables I, II |
| FC-CFT (free complement) | -37.845004(282) | -0.098 | 100.06 | relayed, str2019 Table II |
| "estimated exact" | -37.8450 | -0.094 | 100.06 | chak1993, via seth2011 Table II |
| NIST MCHF collection, Breit-Pauli total, for scale | -37.81158950 | +33.317 | 78.68 | mchf |
| CISD, all electrons, cc-pCVTZ | -37.824777 | +20.129 | 87.12 | run |

- str2019's extrapolation is the best estimate of the exact
  nonrelativistic energy. str2019, below Table I: "For the ground state,
  this estimate differs by about 0.1 mhartree from the previous one
  [6]", where [6] is chak1993, whose $-37.8450$ lies 0.094 mEh below.
  Every "% of correlation recovered" quoted against $-37.8450$
  (seth2011, pfau2020) is therefore low by about 0.06 percentage points:
  Seth's DMC 99.65 % against chak1993 becomes 99.71 % (compare). The
  correlation energy is 0.41 % of the total energy, 4.25 eV.
- The NIST MCHF ground energy that Phase 1 quoted is 33 mEh above the
  exact value. It is a Breit-Pauli calculation aimed at levels and
  rates, and its total includes relativistic shifts, which lower it, so
  its nonrelativistic part lies higher still.

### 2.2 What each method gives, and whether it is published

- MCHF and MCDHF (ATSP2K, GRASP2018): CSF expansions with mixing
  coefficients and numerical radial orbitals per term or level, from
  which energies, densities, natural orbitals, hyperfine constants and
  rates follow. cg2011 reports energies, the mass-polarization parameter
  $S_{\rm sms}$ and hyperfine parameters for ${}^3P$, ${}^1D$, ${}^1S$.
  ff2006 and mchf give Breit-Pauli levels, lifetimes and leading
  eigenvector components. None publishes its radial orbitals. GRASP2018
  can reproduce them (section 6).
- CI with Slater orbitals (rt2017, Sasaki and Yoshimine): energies and
  CSF lists. rt2017 Table 2 prints the energy each class of
  configuration adds (section 4.1). No orbital parameters in the arXiv
  text.
- Coupled cluster: energies only. No variational wave function, and a
  density needs the lambda equations. Reproducible with PySCF or Psi4.
- Explicitly correlated Gaussians (Sharkey, Bubin, Adamowicz,
  Strasburger): energies, $\langle L^2 \rangle$, virial ratio and
  relativistic expectation values (str2019 Tables I to IV) from up to
  5896 Gaussians in all inter-electron distances, not published as a
  file. str2019: "Realization of the present project lasted for about
  two years and engaged varying number of modern CPU cores, reaching
  several hundreds working in parallel on calculation of matrix
  elements."
- Quantum Monte Carlo (seth2011, brown2007, Maldonado et al.): energies
  with error bars and expectation values. seth2011 Table V gives
  $\langle \sum_i \delta(\mathbf r_i)\rangle$ and $\langle \sum_i r_i^n
  \rangle$, $n = -2, \ldots, 3$, Table VI the moments $\langle
  \sum_{i<j} r_{ij}^n \rangle$ and $\langle \sum_{i<j} \delta(\mathbf
  r_{ij})\rangle = 6.66(5)$ for C, without saying whether these are
  mixed or extrapolated estimators (it quotes "only the DMC values",
  not "the extrapolated estimates (2xDMC-VMC)"). Trial wave functions
  unpublished. CASINO, the code used, is free for academics on request,
  not open source.
- FermiNet (pfau2020): energy only, open code (Apache-2.0), no CPU
  figure read.

For the app: no high-precision C I wave function exists as a file. A
correlated picture must come from a build-time run of an open code
(section 6), labelled with its method and its share of the correlation
energy.

### 2.3 Excited states against experiment

Nonrelativistic term energies above the ${}^3P$ centroid, in
$\mathrm{cm^{-1}}$ (compare):

| term | experiment | cg2011 MCHF/CI final | run, SA-CASSCF(4e, 2s2p) | run, SA-CASSCF(4e, 2s2p3s3p3d) |
| --- | --- | --- | --- | --- |
| $2p^2\,{}^1D$ | 10163.07 | 10186.7 (+23.6) | 12622 (+2459) | 11781 (+1618) |
| $2p^2\,{}^1S$ | 21618.44 | 21648.1 (+29.7) | 21175 (-443) | 23700 (+2081) |
| $2s2p^3\,{}^5S^o$ | 33705.53 | | | |

For ${}^5S^o_2$, str2019 (Table III and the text after it) gives the
nonrelativistic excitation energy with the finite ${}^{12}$C mass as
$33605(1)\ \mathrm{cm^{-1}}$, and with scalar relativistic terms added
$33713\ \mathrm{cm^{-1}}$, against the experimental $33705.530$ above the
centroid, "accuracy of about 7 cm$^{-1}$" (abstract). The rest "might
stem from radiative corrections" (section 3.3).

Breit-Pauli MCHF levels (mchf) against NIST ASD, above ${}^3P_0$, in
$\mathrm{cm^{-1}}$ (compare):

| level | MCHF | ASD | MCHF - ASD |
| --- | --- | --- | --- |
| $2p^2\,{}^3P_1$ | 16.33 | 16.417 | -0.09 |
| $2p^2\,{}^3P_2$ | 43.03 | 43.413 | -0.38 |
| $2p^2\,{}^1D_2$ | 10268.23 | 10192.657 | +75.57 (+0.74 %) |
| $2p^2\,{}^1S_0$ | 21818.60 | 21648.030 | +170.57 (+0.79 %) |
| $2s2p^3\,{}^5S^o_2$ | 33730.21 | 33735.121 | -4.91 |
| $2p3s\,{}^3P^o_0$ | 60679.19 | 60333.448 | +345.74 (+0.57 %) |
| $2p3s\,{}^1P^o_1$ | 62414.16 | 61981.832 | +432.33 (+0.70 %) |
| $2s2p^3\,{}^3D^o_3$ | 64340.37 | 64086.970 | +253.40 (+0.40 %) |
| $2s2p^3\,{}^3P^o_1$ | 76068.99 | 75254.002 | +814.99 (+1.08 %) |

- Large MCHF/CI (cg2011) puts ${}^1D$ and ${}^1S$ within 30
  $\mathrm{cm^{-1}}$ (0.2 %) of experiment without relativity. The
  spectroscopic collection (mchf) is off by 0.4 to 1.1 % above the
  ground configuration, and its ground fine structure by 0.5 to 0.9 %. A
  small CASSCF is off by 10 to 25 % for ${}^1D$: the term splitting needs
  dynamic correlation, not only the $2s^2 \leftrightarrow 2p^2$ mixing.
- ff2006 prints mixing amplitudes with signs, which NIST's leading
  percentages lack. $2s2p^3\,{}^3P^o_2$ (text before its Table 3): "0.75
  $2s2p^3$ +0.36 $2p3d$ +0.28 $2s2p^2({}^3P)3p$ +0.28 $2p4s$ -0.18 $2p4d$
  -0.16 $2s2p^2({}^3P)4p$ +0.12 $2s2p^2({}^1D)3p$ -0.12 $2p3s$".
  $2p3d\,{}^3F^o$: "${}^3F_2$: 0.952 $2p3d\,{}^3F^o$ + 0.198 $2p^3
  3d\,{}^3F^o$ - 0.154 $2p3d\,{}^3D$" and "${}^3F_3$: 0.939 $2p3d\,{}^3F^o$
  + 0.196 $2p^3 3d\,{}^3F^o$ - 0.209 $2p3d\,{}^3D$ + 0.087 $2p3d\,{}^1F^o$".
- The DMC excitation energies of Maldonado et al. could not be used: two
  secondary sources disagree on its ground-state DMC energy, $-37.84185(5)$
  in str2019 Table II and $-37.83544(9)$ in rt2017 Tables 4 and 5, and the
  primary was not reached.

For the app: the level energies should stay NIST's, which no calculation
matches. Drawing a mixed level as a coherent sum of its components would
need orbitals for every component, which no source gives.

## 3. Corrections to the ideal equation (question 2)

### 3.1 What "visible" means in the Carbon mode

From dec0015 and calc C:

- Level diagram: $90\,820\ \mathrm{cm^{-1}}$ on a pane at most 380 px
  tall is $239\ \mathrm{cm^{-1}}$ per pixel. The ground-term inset
  magnifies $43.4\ \mathrm{cm^{-1}}$ to its own height.
- Spectrum strip: log wavelength from 110 nm to 10 $\mu$m on 400 px is
  $\Delta\lambda/\lambda = 1.13\,\%$ per pixel.
- Event clock: a real frequency $f$ shows at $f/10^6$. A 60 Hz frame
  resolves at most 30 Hz on screen, 30 MHz real. An oscillation shows
  only if one period fits in the lifetime, a frequency above $1/\tau$.
  So the window is $1/\tau < f <$ 30 MHz. For a $2p3s$ level ($1/\tau$ =
  347 to 367 MHz) it is empty. For $2p4p$ ($1/\tau$ = 4.1 to 13.6 MHz) it
  spans a factor 2 to 7, for $2p4d$ and $2p5s$ (6.8 to 118 MHz) at most a
  factor 4.4.
- Light clock: 2.4189 s on screen per atomic unit of time
  ($2.42\times10^{-17}$ s), a slowing of $10^{17}$.

### 3.2 Relativistic and Breit-Pauli terms

Scalar part. str2019 (Table IV) evaluates the scalar Breit-Pauli terms
with its 5896-function wave function of the ground term: mass-velocity
$-0.079046$, one-body Darwin $+0.063875$, two-body Darwin and spin-spin
contact $+0.001112$, orbit-orbit $-0.000015$ hartree, total
$\langle H_{RS}\rangle = -0.014075$ hartree ($-3089\ \mathrm{cm^{-1}}$).
On an excitation most of it cancels: on ${}^3P \to 2s2p^3\,{}^5S^o$ the
relativistic corrections total $108\ \mathrm{cm^{-1}}$, of which the
orbit-orbit term gives nearly 16 (str2019, section III: "It contributes
nearly 16 cm$^{-1}$ to the excitation energy - almost 15% of the total
contribution of relativistic corrections, amounting to 108
cm$^{-1}$"). seth2011 Table IV
gives the same terms by DMC. b06 (Table IV) gives the relativistic part
of each low transition energy as $q = d\omega/dx$, $x =
(\alpha/\alpha_0)^2 - 1$: from $-47\ \mathrm{cm^{-1}}$
($2p3s\,{}^3P^o_0$) through $+1$ ($2p3s\,{}^1P^o_1$) to $+146$
($2s2p^3\,{}^5S^o_2$) and $+144$ ($2s2p^3\,{}^3D^o_3$), with "errors of
around 10 cm$^{-1}$", 0.1 to 0.4 % of the transition.

Fine structure, from NIST's levels (calc A):

| term | span ($\mathrm{cm^{-1}}$) | intervals ($\mathrm{cm^{-1}}$, by rising energy) | span (GHz) | narrowest natural FWHM in the term (MHz) |
| --- | --- | --- | --- | --- |
| $2p^2\,{}^3P$ | 43.413 | 16.417, 26.997 | 1301.5 | $4\times10^{-14}$ |
| $2p3s\,{}^3P^o$ | 59.722 | 19.211, 40.511 | 1790.4 | 55.4 |
| $2s2p^3\,{}^3D^o$ | 4.024 | 2.929, 1.095 (order $J$ = 3, 1, 2) | 120.6 | 18.7 |
| $2p3p\,{}^3D$ | 54.558 | 21.193, 33.365 | 1635.6 | 2.93 |
| $2p3p\,{}^3P$ | 32.866 | 12.393, 20.474 | 985.3 | 4.85 |
| $2s2p^3\,{}^3P^o$ | 2.168 | 1.292, 0.876 (order $J$ = 1, 2, 0) | 65.0 | 35.5 |
| $2p4s\,{}^3P^o$ | 43.108 | 11.773, 31.335 | 1292.3 | 18.8 |
| $2p3d\,{}^3F^o$ | 50.875 | 16.449, 34.427 | 1525.2 | 6.08 |
| $2p3d\,{}^3D^o$ | 24.753 | 14.134, 10.620 | 742.1 | 40.2 |
| $2p3d\,{}^3P^o$ | 12.320 | 7.941, 4.379 | 369.3 | 31.4 |
| $2p4p\,{}^3D$ | 52.176 | 18.840, 33.336 | 1564.2 | 0.661 |
| $2p4p\,{}^3P$ | 33.000 | 14.756, 18.244 | 989.3 | 1.13 |
| $2p5s\,{}^3P^o$ | 50.992 | 12.342, 38.649 | 1528.7 | 10.6 |
| $2p4d\,{}^3F^o$ | 51.183 | 13.842, 37.342 | 1534.4 | 2.49 |
| $2p4d\,{}^3D^o$ | 28.712 | 17.915, 10.797 | 860.8 | 18.9 |
| $2p4d\,{}^3P^o$ | 18.102 | 12.991, 5.111 | 542.7 | 12.6 |

The $2s2p^3$ terms are 3 to 27 times narrower than the $2s^2 2p\,nl$
triplets, and their order is irregular (${}^3D^o$: $J = 3$ lowest,
${}^3P^o$: $J = 0$ highest). The $2p\,nl$ terms all spread by no more
than the C II core's own $63.4\ \mathrm{cm^{-1}}$, as expected if the
core's $2p$ spin-orbit coupling sets them.

Breit-Pauli theory on the ground term: cg2011 (Table IX) gives $16.39$
and $43.31\ \mathrm{cm^{-1}}$ against the measured $16.4167$ and
$43.4135$, within 0.2 to 0.3 %. rz26 adds the anomalous magnetic moment
($\propto\alpha^3$) and the leading $\alpha^4$ couplings to all-particle
explicitly correlated Gaussians for ${}^3P$, ${}^3P^e$ and ${}^3D^e$ of
${}^{12,13,14}$C, and the thesis behind it (rz25) states agreement "with
experiment at the level of 0.0001-0.01 cm$^{-1}$". Its tables were not
read.

For the app: the ground-term inset already shows the one relativistic
effect a viewer can see. An excited-term splitting is at most a quarter
pixel on the level diagram and under a tenth of a pixel on the spectrum
strip ($\Delta\lambda/\lambda \leq 10^{-3}$), so a multiplet such as
476.2 to 477.6 nm draws as one line unless a zoom is added.

### 3.3 QED

No C I-specific QED (Lamb shift) figure was found. Two bounds:

- str2019 (section III) adds finite mass and the scalar Breit-Pauli
  terms and gets $33\,713\ \mathrm{cm^{-1}}$ for ${}^3P \to {}^5S^o$,
  against the measured $33\,705.530$, a residue of $7.5\
  \mathrm{cm^{-1}}$ with an error he puts at about 2: "The missing
  contribution of at least 6 cm$^{-1}$ to the excitation energy might
  stem from radiative corrections." QED on this excitation is thus at
  most several $\mathrm{cm^{-1}}$, about $2\times10^{-4}$ of it.
- On the fine structure, what rz26 leaves out after its $\alpha^3$ and
  $\alpha^4$ terms is bounded by rz25's agreement of $10^{-4}$ to
  $10^{-2}\ \mathrm{cm^{-1}}$.

Welton's picture of the same effect, the zero-point field shaking the
electron by an rms $9.7\times10^{-4}$ bohr, is in section 8.3.

### 3.4 Finite nuclear mass

The nuclear kinetic energy $p_N^2/2M = (1/2M)\sum_i p_i^2 +
(1/M)\sum_{i<j} \mathbf p_i\cdot\mathbf p_j$ gives the normal mass shift
(a reduced-mass rescaling) and the specific mass shift, or mass
polarization (b06 Eq. 3).

- On an excitation: str2019 (section III) finds that finite mass
  "contributes $-39.78\ \mu$hartree (or $-8.731$ cm$^{-1}$) to the
  energy of ${}^3P_g \to {}^5S_u$ excitation of ${}^{12}$C",
  $2.6\times10^{-4}$ of it. str2019 Table III gives the finite-mass
  ground energies of ${}^{12}$C, ${}^{13}$C and ${}^{14}$C (${}^{12}$C
  $-37.843194(4)$ Eh).
- The normal shift of a level $E$ is $E\,m_e(1/M_{12} - 1/M_{13}) =
  3.529\times10^{-6}\,E$ (nistiso, codata, calc D). With the level
  isotope shifts of hk2017 Table 7, the specific shift is the rest
  (1 mK = $10^{-3}\ \mathrm{cm^{-1}}$, full list in calc D):

| level | $E$ ($\mathrm{cm^{-1}}$) | IS ${}^{13}$C$-{}^{12}$C (mK, hk2017) | normal (mK) | specific = IS $-$ normal (mK) |
| --- | --- | --- | --- | --- |
| $2p^2\,{}^3P_1$ | 16.417 | +0.0747 (measured) | +0.058 | +0.017 |
| $2p^2\,{}^3P_2$ | 43.413 | +0.2125 (measured) | +0.153 | +0.059 |
| $2p^2\,{}^1D_2$ | 10192.657 | +5 (calc. K09) | +36.0 | $-31.0$ |
| $2p^2\,{}^1S_0$ | 21648.030 | +40 (derived) | +76.4 | $-36.4$ |
| $2s2p^3\,{}^5S^o_2$ | 33735.121 | +670 (measured) | +119.1 | +550.9 |
| $2p3s\,{}^3P^o_J$ | 60333 to 60393 | $-92$ (calc. b06) | +213.0 | $-305.0$ |
| $2p3s\,{}^1P^o_1$ | 61981.832 | $-116$ (calc. b06) | +218.8 | $-334.8$ |
| $2s2p^3\,{}^3D^o_J$ | 64087 to 64091 | +704 (calc. b06) | +226.2 | +477.8 |
| $2s2p^3\,{}^3P^o_J$ | 75254 to 75256 | +564 (calc. b06) | +265.6 | +298.4 |
| $2p4s\,{}^3P^o_1$ | 78116.773 | $-27$ (calc. b06) | +275.7 | $-302.7$ |
| $2p3d\,{}^3D^o_J$ | 78294 to 78318 | $-31$ (calc. b06) | +276.4 | $-307.4$ |
| $2p3d\,{}^3P^o_1$ | 79318.809 | +61.4 (calc. b06) | +279.9 | $-218.5$ |
| $2p4d\,{}^1D^o_2$ | 83497.587 | +23 (calc. b06) | +294.7 | $-271.7$ |
| $2s2p^3\,{}^3S^o_1$ | 105799.114 | +511.0 (measured) | +373.4 | +137.6 |

Exciting a $2s$ electron to $2p$ gives a large positive specific shift.
Exciting a $2p$ electron to $nl$ gives about $-300$ mK, which nearly
cancels the normal one. Cross-check: b06 Table V gives $k_\mathrm{SMS} =
1419$ GHz amu for $2p3s\,{}^3P^o_0$, and $1419\ \mathrm{GHz} \times
(1/13.00335 - 1/12) = -9.12$ GHz $= -304$ mK, the residue above. For
${}^5S^o_2$, $-2588$ GHz amu gives $+555$ mK against $+551$.

### 3.5 Finite nuclear size

- Charge radii (mu25, Table II): ${}^{12}$C $2.4717(42)$ fm (electron
  scattering), ${}^{13}$C $2.4464(45)$ fm (laser spectroscopy of
  ${}^{13}$C$^{4+}$), muonic atoms $2.4829(19)$ and $2.4628(39)$ fm, a
  2.4 to 2.8 $\sigma$ disagreement that paper discusses.
  $\delta\langle r^2\rangle^{12,13} = -0.1245(66)\ \mathrm{fm^2}$ (Eq. 3).
- b06 (section II.B): "In atoms as light as carbon, the field shift is
  negligible in comparison to the mass shift: we will not consider it
  further." No C I field-shift factor was found.
- A one-electron estimate, computed here, not published (calc E): the
  field shift of removing one $2s$ electron is $(2\pi/3)\,Z\,
  |\psi_{2s}(0)|^2\,\delta\langle r^2\rangle$ with $|\psi_{2s}(0)|^2 =
  2.766\ \mathrm{bohr^{-3}}$ from Bunge's orbitals. That gives $82$
  MHz/fm$^2$ and about 10 MHz (0.34 mK) on a $2s \to 2p$ line, 0.05 % of
  its 704 mK isotope shift and below b06's quoted 4 mK uncertainty.
  mu25 finds 26.3(1.4) MHz in C$^{4+}$.

The nucleus, 2.47 fm, is $2\times10^{-4}$ of the $1s$ mean radius (0.27
bohr, phase1): the point nucleus is exact at any pane size.

### 3.6 Isotope shift ${}^{12}$C to ${}^{13}$C on named lines

Measured (hk2017 section 4 and Tables 6 and 8, with the original
references):

| line | IS ${}^{13}$C $-$ ${}^{12}$C | reference |
| --- | --- | --- |
| ${}^3P_0 - {}^3P_1$, 492 GHz | +2.238 MHz ($492\,160.651(18)$ to $492\,162.889(18)$ MHz) | Y91, hk2017 |
| ${}^3P_1 - {}^3P_2$, 809 GHz | +4.133 MHz ($809\,341.970(17)$ to $809\,346.103(44)$ MHz) | K98, hk2017 |
| ${}^3P_2 - 2s2p^3\,{}^5S^o_2$, 296.7 nm | +670(5) mK | B80 |
| ${}^1S_0 - 2p3s\,{}^1P^o_1$, 247.9 nm | $-156(2)$ mK, ${}^{14}$C: $-294(2)$ mK | H51, Burnett 1950 |
| ${}^3P_J - 2s2p^3\,{}^3S^o_1$, 94.5 nm | +510.7(13) mK, mean of three | lab05 |

Positive means the heavier isotope's line lies at shorter wavelength.
Against the line widths (calc D, Doppler FWHM for ${}^{13}$C at 300 K):

| line | IS (MHz) | Doppler FWHM 300 K (MHz) | IS / Doppler | natural FWHM (MHz) |
| --- | --- | --- | --- | --- |
| 156.1 nm, ${}^3P_2 - {}^3D^o_3$ (b06) | +21 100 | 6605 | 3.2 | 18.6 |
| 132.9 nm, ${}^3P_0 - {}^3P^o_1$ (b06) | +16 910 | 7761 | 2.2 | 35.4 |
| 165.7 nm, ${}^3P_2 - 2p3s\,{}^3P^o_2$ (b06) | $-2764$ | 6224 | 0.44 | 55.4 |
| 193.1 nm, ${}^1D_2 - 2p3s\,{}^1P^o_1$ (K09, b06) | $-3627$ | 5341 | 0.68 | 58.4 |
| 247.9 nm (H51) | $-4677$ | 4160 | 1.1 | 58.4 |
| 296.7 nm (B80) | +20 080 | 3475 | 5.8 | $5\times10^{-6}$ |
| 462.3 nm, M1 (derived) | +1197 | 2231 | 0.54 | $1\times10^{-7}$ |
| 492 GHz (Y91) | +2.24 | 1.69 | 1.3 | $1\times10^{-14}$ |
| 809 GHz (K98) | +4.13 | 2.78 | 1.5 | $4\times10^{-14}$ |

The mode's visible lines ($2p4p \to 2p3s$, $2p4d \to 2p3p$) join levels
whose shifts are each about $-30$ to $-100$ mK and largely cancel.
Neither hk2017 nor b06 lists them, and no measured value was found.

On the strip the $2s2p^3$ shifts are $1.1\times10^{-5}$ in
$\Delta\lambda/\lambda$ at 156 nm, a thousandth of a pixel. A zoomed
profile at 300 K would show ${}^{13}$C as a separate peak 1 % as tall
(abundance 1.07 %, nistiso).

### 3.7 Hyperfine structure of ${}^{13}$C ($I = 1/2$)

${}^{12}$C has $I = 0$. For ${}^{13}$C (hk2017 section 4 and Table 8,
from W70, Y91, K98):

| level | $A$ (MHz) | measured splitting (MHz) | source |
| --- | --- | --- | --- |
| $2p^2\,{}^3P_0$ | none ($J = 0$, $F = 1/2$ only) | - | - |
| $2p^2\,{}^3P_1$ | +2.838(17) | $F = 1/2 - 3/2$: 4.200(25) | W70 |
| $2p^2\,{}^3P_2$ | +149.055(10) | $F = 3/2 - 5/2$: 372.593(13) | W70 |
| $2p^2\,{}^1D_2$ | 219.61 (theory) | - | cg2011, Table VII |

cg2011 computes $A_1 = 2.84$ and $A_2 = 148.99$ MHz, and re-derives the
measured constants with its off-diagonal $J$-$J'$ interaction as $A_1 =
2.829(17)$ and $A_2 = 149.052(10)$ MHz. The hyperfine components of the
492 and 809 GHz lines are resolved in the laboratory (Y91, K98), for
example ${}^3P_1(F=3/2) - {}^3P_2(F=5/2)$ at $809\,493.70(7)$ MHz and
${}^3P_1(F=1/2) - {}^3P_2(F=3/2)$ at $809\,125.50(13)$ MHz. No measured
hyperfine constant of an excited C I level was found. ${}^{11}$C ($I =
3/2$, 20.3 min): $A({}^3P_1) = -1.308(24)$ MHz (hk2017).

The largest splitting, 372.6 MHz, is $0.0124\ \mathrm{cm^{-1}}$,
$3\times10^{-4}$ of the inset's height, and its beat on the event clock,
373 Hz, is over the frame limit.

### 3.8 Verdict

| correction | size in C I | seen on the present pane |
| --- | --- | --- |
| scalar relativistic | $-3089\ \mathrm{cm^{-1}}$ on the total energy, 10 to $150\ \mathrm{cm^{-1}}$ on a transition | no: a shift of every level, under a pixel |
| fine structure (spin-orbit, spin-spin) | 2 to $60\ \mathrm{cm^{-1}}$ per term | yes in the ground inset, no elsewhere without a zoom |
| QED | at most several $\mathrm{cm^{-1}}$ on ${}^3P \to {}^5S^o$ (str2019's residue), not published per level | no |
| finite mass (normal + specific) | $-8.7\ \mathrm{cm^{-1}}$ on ${}^3P \to {}^5S^o$, $10^{-5}$ of a level | no |
| isotope shift ${}^{13}$C | up to $0.70\ \mathrm{cm^{-1}}$, 21 GHz | only in a zoomed profile, as a separate peak |
| field shift | about 10 MHz on a $2s \to 2p$ line (estimate) | no |
| hyperfine ${}^{13}$C | 4.2 and 372.6 MHz in the ground term | no |

## 4. Electron correlation made visible (question 3)

### 4.1 The $2s^2 \leftrightarrow 2p^2$ near-degeneracy mixing

In the space of the $n = 2$ shell the even ${}^3P$ has exactly two CSFs,
$1s^2 2s^2 2p^2$ and $1s^2 2p^4$ ($2s2p^3$ is odd), so the ground state
is $c_1\,|2s^2 2p^2\rangle + c_2\,|2p^4\rangle$.

| model | weight $c_2^2$ of $2p^4$ | $|c_2|$ | weight of $2s^2 2p^2$ | $2s$ natural occupation | source |
| --- | --- | --- | --- | --- | --- |
| SA-CASSCF(4e, 2s2p), cc-pCVTZ | 0.022159 | 0.1489 | 0.977841 | 1.955683 | run |
| SA-CASSCF(4e, 2s2p3s3p3d), cc-pCVTZ, natural orbitals | 0.018764 | 0.1370 | 0.945593 | 1.925526 | run |
| NIST ASD, leading component of ${}^3P$ | not listed | | 98 % | | asd |
| NIST ASD, ${}^1S_0$ | 4 % $2p^4\,{}^1S$ | | 94 % | | asd |

The weights sum the squared CI coefficients over each configuration's
determinants, for each of the three ${}^3P$ components in $D_{2h}$ (all
agree to $10^{-6}$), with orbitals averaged over the components so the
$2p$ stay equivalent. In the two-CSF space $c_2^2 = (2 - n_{2s})/2 =
0.022159$ holds exactly.

- About 2 % of the ground state is $2p^4$, $|c_2| \approx 0.14$ to
  $0.15$, computed here. No published $c_2$ for C ${}^3P$ was found:
  NIST gives only the leading 98 %, and cg2011, rt2017 and ff2006 print
  none. The sign of $c_2$ depends on phase conventions and is not
  quoted.
- The mixing matters less than in beryllium. rt2017 (Table 2 and
  conclusions): the $ss \to pp$ class ("sspppp") lowers the energy by
  22002 microhartree, but "the excitation pdd is more important than the
  quasi-degeneration of the s and p levels as it was the case in the Be
  atom" (the class "sssppd", a $2s\,2p \to p\,d$ pair excitation, adds
  30051 microhartree, the inner $1s^2 \to p^2$ class "ppsspp" 23564).

### 4.2 Natural orbital occupations

Run, CISD of all six electrons in cc-pCVTZ, on the $M_L = 0$ component
$|1s^2 2s^2 2p_x 2p_y|$ about $z$, 87 % of the correlation energy:

| natural orbital (irrep) | occupation |
| --- | --- |
| $1s$ ($A_g$) | 1.998362 |
| $2s$ ($A_g$) | 1.936749 |
| $2p_x$ ($B_{3u}$), $2p_y$ ($B_{2u}$) | 0.991121 each |
| $2p_z$ ($B_{1u}$) | 0.037321 |
| next ($A_g$, $3s$-like) | 0.008836 |
| next (d-like and $3p$-like pairs) | 0.005860, 0.005860, 0.005072, 0.005072, 0.004090, 0.004090 |

The empty $2p_z$ of Hartree-Fock holds 0.037 electrons, about twice the
$2p^4$ weight, and the $2s$ has lost 0.063: the near-degeneracy mixing
is the largest single change. The $1s$ loses only 0.0016, and every
other natural orbital holds under 0.01. The occupations depend on basis
and method, and no published C I natural occupations were found to
compare.

### 4.3 The correlation contribution to the one-electron density

seth2011 Table V (DMC) against bunge1993 (Hartree-Fock), sums over the
six electrons (compare):

| quantity | HF (bunge1993) | DMC (seth2011) | DMC - HF |
| --- | --- | --- | --- |
| $\langle \sum r_i \rangle$ | 7.144564 | 7.1230(3) | -0.0216 (-0.30 %) |
| $\langle \sum r_i^2 \rangle$ | 13.792126 | 13.7401(7) | -0.0520 (-0.38 %) |
| $\langle \sum 1/r_i \rangle$ | 14.689480 | 14.7065(8) | +0.0170 (+0.12 %) |
| $\rho(0) = \langle \sum \delta(\mathbf r_i) \rangle$ | 127.45 | 127.2(4) | -0.25(40), not significant |

Run, CISD against ROHF in the same basis: $\langle \sum r_i \rangle$
-0.237 %, $\langle \sum r_i^2 \rangle$ -0.343 %, $\langle \sum 1/r_i
\rangle$ +0.060 % (compare). The radial density $D(r) = r^2 \int \rho\,
d\Omega$ moves by (run):

| $r$ (bohr) | $D_{\rm HF}(r)$ | $D_{\rm CISD} - D_{\rm HF}$ |
| --- | --- | --- |
| 0.10 | 4.887 | -0.0037 |
| 0.30 | 4.456 | +0.0035 |
| 0.50 | 1.820 | +0.0178 |
| 0.75 | 1.693 | +0.0221 |
| 1.00 | 2.231 | +0.0136 |
| 1.50 | 2.184 | -0.0082 |
| 2.00 | 1.429 | -0.0121 |
| 3.00 | 0.398 | -0.0019 |

$\int |D_{\rm CISD} - D_{\rm HF}|\,dr = 0.029$ electrons (run).

- Correlation contracts the density by about 0.3 % in $\langle r
  \rangle$ and 0.4 % in $\langle r^2 \rangle$, moving charge from 1.5 to
  3 bohr into 0.3 to 1 bohr. The charge moved, half the integral, is
  about 0.015 of six electrons. This answers Phase 1's "no published
  correlated density of C I was obtained to say by how much" (phase1
  section 6.4).
- seth2011 cites FCI $\langle \sum r_i^2 \rangle = 13.84$ from Cohen,
  Handy and Roos (Phys. Chem. Chem. Phys. 6, 2928 (2004), relayed),
  slightly above its own 13.7401, without resolving the difference.
- The change is two orders of magnitude below the change between levels
  (phase1: a $2p3s$ cloud is 2.7 to 2.8 times the $2p$).

### 4.4 Pair density, Fermi hole and Coulomb hole

$\rho_2(\mathbf r_1, \mathbf r_2)$ is the pair density, normalised to
$N(N-1)$. With one electron fixed at $\mathbf r_1$, the
exchange-correlation hole $h(\mathbf r_2 \mid \mathbf r_1) =
\rho_2(\mathbf r_1, \mathbf r_2)/\rho(\mathbf r_1) - \rho(\mathbf r_2)$
integrates to $-1$. For one determinant it is the Fermi hole (same spin
only). The Coulomb hole is $h_{\rm corr} - h_{\rm HF}$. The intracule
$I(s)$ is the distribution of $|\mathbf r_1 - \mathbf r_2|$, and vn2022's
$h_c(s)$ is its correlated minus Hartree-Fock difference.

Published for carbon, plots only:

- vn2022, FCI in aug-cc-pVDZ: Figure 7 plots $h_c(s)$ and its two range
  components for the ground and lowest-multiplicity states of C, N and
  O, Figure 8 the hole of C(${}^1S$) and C(${}^3P$) with its spin
  components, Figure S4 the He to Ne series. Its finding: "the Coulomb
  hole of all the atoms looks practically identical regardless of the
  multiplicity".
- th2021: the momentum-balance density from extrapolated FCI, Figure 6
  for Be to Ne: "Coulomb correlation between opposite-spin electrons
  leads to a higher probability of equimomentum, whereas Fermi
  correlation between parallel-spin electrons leads to a higher
  probability of antimomentum."
- seth2011 Table VI: $\langle \sum_{i<j} \delta(\mathbf r_{ij}) \rangle
  = 6.66(5)$, with no Hartree-Fock value beside it.

Computed (run), ROHF and CISD in cc-pCVTZ, $M_L = 0$ component, one
electron fixed at $\mathbf r_1 = (1, 0, 0)$ bohr in the $2p_x$ lobe:

| $\mathbf r_2$ | $h_{\rm HF}$ (Fermi) | $h_{\rm CISD}$ | Coulomb hole |
| --- | --- | --- | --- |
| $(1, 0, 0) = \mathbf r_1$ | -0.1416 | -0.1717 | -0.0301 |
| $(1, \pm0.5, 0)$ | -0.1037 | -0.1274 | -0.0237 |
| $(1, \pm1, 0)$ | -0.0474 | -0.0572 | -0.0098 |
| $(1, \pm2.5, 0)$ | -0.0018 | -0.0014 | +0.0005 |
| $(2, 0, 0)$, outward | -0.0234 | -0.0259 | -0.0025 |
| $(-0.5, 0, 0)$, across the nucleus | -0.0628 | -0.0506 | +0.0122 |
| $(-1, 0, 0)$, across the nucleus | -0.0338 | -0.0265 | +0.0074 |

On-top pair density $\rho_2(\mathbf r_1, \mathbf r_1)$: HF 0.016539,
CISD 0.009583 $\mathrm{bohr^{-6}}$, a 42 % reduction (run, compare).

- The Fermi hole is exact within Hartree-Fock and needs only the
  occupied orbitals. Every $M_S = 1$ component of $2p^2\,{}^3P$ is one
  determinant, so the Fermi hole of the mode's ground state follows from
  the Bunge 1993 orbitals already in `app/viz/carbon-data.js`:
  $h^{\alpha\alpha}(\mathbf r_2 \mid \mathbf r_1) = -|\sum_i
  \phi_i(\mathbf r_1)\phi_i^*(\mathbf r_2)|^2 / \rho_\alpha(\mathbf
  r_1)$ over the four $\alpha$ orbitals. It integrates to one electron
  and removes all same-spin density at $\mathbf r_1$.
- The Coulomb hole is about a fifth of the Fermi hole at the reference
  electron here. It deepens the hole near $\mathbf r_1$ and puts charge
  back on the far side of the nucleus: angular, in-out correlation, the
  physics of the $2s^2 \to 2p^2$ mixing. These numbers come from 87 % of
  the correlation energy in a Gaussian basis, which cannot form the
  electron-electron cusp, so the true hole at $\mathbf r_1$ is deeper and
  narrower. The shape far from $\mathbf r_1$ is the reliable part. Within
  0.25 bohr of the nucleus the hole swings in sign over the large $1s$
  density and should not be drawn without a finer basis.
- The hole is conditional: it needs a chosen electron and a chosen
  point. It is a picture of a probability, not of a motion.

### 4.5 What can be drawn honestly

| picture | data | in hand | honest size |
| --- | --- | --- | --- |
| Fermi hole of the ground state about a chosen electron | Bunge 1993 orbitals | yes | exact within Hartree-Fock |
| $2p^4$ admixture as a 2 % second cloud | $c_2^2$ (run) and Bunge orbitals | yes, for the two-CSF model | 2 % |
| natural occupations as bars | run | yes | basis-dependent at the third digit |
| correlated minus HF density, signed, amplified | run (radial table) or a new 3D grid | radial yes, 3D no | 0.5 %, must be amplified |
| Coulomb hole about a chosen electron | correlated 2-RDM on a grid | no, a build-time run | 20 % of the Fermi hole, cusp missing |
| intracule $h_c(s)$ curve | vn2022 Figure 7, plots only, or a run | no | published shape, no table |

## 5. Dynamics beyond spontaneous emission (question 4)

### 5.1 Quantum beats between fine-structure levels

A pulse short enough to cover a term's span excites its $J$ levels
coherently, and the light in a fixed direction and polarization beats at
the splittings: 65 GHz ($2s2p^3\,{}^3P^o$) to 1.79 THz ($2p3s\,{}^3P^o$),
periods 0.56 to 15.4 ps (calc A), from 291 ($2s2p^3\,{}^3P^o$) to
$3.8\times10^5$ ($2p4p\,{}^3D$) beats per lifetime. Exciting them takes
a pulse under 0.5 to 15 ps at 120 to 166 nm, or two photons for the even
$2p3p$ and $2p4p$ terms. No quantum-beat or Hanle observation in C I was
found.

On the event clock a 0.56 ps beat lasts 0.56 $\mu$s, on the light clock
15.5 hours. A third clock of about $10^{12}$ would put the beats at 0.06
to 1.8 Hz and stretch a $2p3s$ decay to 48 minutes.

### 5.2 Zeeman effect and the published $g_J$

Measured $g_J$ of C I (asd, Lande column, 435 levels exported): three.

| level | NIST $g_J$ | reference | LS value with $g_s$ (calc B) |
| --- | --- | --- | --- |
| $2p^2\,{}^3P_1$ | 1.5010623(50) | L3172, Beckmann et al. 1975 (phase1) | 1.501160 |
| $2p^2\,{}^3P_2$ | 1.5010469(50) | L3172 | 1.501160 |
| $2p3s\,{}^1P^o_1$ | 0.97 | L292, not identified | 1.000000 |

hk2017 also quotes the atomic-beam values of W69, 1.501052(13) and
1.501039(15). The measured ground-term values lie 1.0 and
$1.1\times10^{-4}$ below the LS value with the free-electron $g_s$, and
differ from each other by $1.5\times10^{-5}$. Every other level takes
the LS formula $g_J = 1 + (g_s - 1)[J(J+1) + S(S+1) - L(L+1)]/[2J(J+1)]$,
nine values over the 68 levels from 0.4988 to 2.0023, which fails for
the mixed levels of phase1 section 6.4 by an amount no measurement fixes.
Twelve levels have $J = 0$ and do not shift.

Per unit $g_J$, between adjacent $M$ (calc C):

| field | real frequency | $\mathrm{cm^{-1}}$ | event clock |
| --- | --- | --- | --- |
| 0.05 mT | 0.70 MHz | $2.3\times10^{-5}$ | 0.70 Hz |
| 0.1 mT | 1.40 MHz | $4.7\times10^{-5}$ | 1.40 Hz |
| 1 mT | 14.0 MHz | $4.7\times10^{-4}$ | 14.0 Hz |
| 10 mT | 140 MHz | $4.7\times10^{-3}$ | 140 Hz |
| 1 T | 14.0 GHz | 0.467 | 14 kHz |

A static Zeeman split is invisible on the level diagram at any
laboratory field, and in the ground inset below about 1 T: 1 T spreads
a $g = 1.5$, $J = 1$ level over $1.4\ \mathrm{cm^{-1}}$, 3 % of the
inset. Spreading the ground term's $M = \pm1$ over its $16.4\
\mathrm{cm^{-1}}$ interval takes 11.7 T.

The dynamic effect is different. A single $M$ state about $B$ is
stationary. A superposition of $M$ sublevels about $B$, an atom aligned
or oriented along an axis not parallel to $B$, precesses about $B$ at
$g_J\mu_B B/h$, and the source direction of its emission (the
transition dipole of photon section 2) turns with it. After a pulsed,
polarized excitation transverse to $B$, the light seen in one direction
beats at $g_J\mu_B B/h$ or twice it (Zeeman quantum beats, the
time-domain Hanle effect). For a $2p4p$ emitter ($\tau$ = 112 to 243 ms
on screen for $J > 0$, LS $g_J$ = 1.0 for ${}^1P_1$ and ${}^1D_2$, 1.334
for ${}^3D_3$, 1.501 for ${}^3P_2$) 0.3 to 1 mT gives 4 to 21 Hz on
screen, about 1 to 5 turns per lifetime. For $2p3s$ ($\tau$ = 2.7 to
2.9 ms on screen) one turn needs over 350 Hz, far over the frame limit.
No Zeeman beat measurement on C I was found.

For the app: this is the one dynamic that needs no new clock, filed as
issue #158 (candidate 1). The mode's collisional excitation is
incoherent in $M$, so ensemble beats need a pulsed, polarized
excitation.

### 5.3 Rabi oscillation in a driving field

steck Eqs. 49 and 50, $I_\mathrm{sat} = \pi h c\,\Gamma/(3\lambda^3)$
and $I/I_\mathrm{sat} = 2\Omega^2/\Gamma^2$, give $\Omega =
\sqrt{3\lambda^3 A_{ki} I/(2\pi h c)}$ with the partial rate $A_{ki}$ of
the driven line, exact for a closed, stretched $M$ pair, other pairs
differing by Clebsch-Gordan factors of order one. The damping is the
total decay rate of either level. Calc H:

| line | type | $\Omega/2\pi$ at 1 $\mathrm{W/cm^2}$ | $1/\tau$, faster level | $I$ for $\Omega/2\pi = 1/\tau$ | $I$ for $\Omega/2\pi$ = 30 MHz |
| --- | --- | --- | --- | --- | --- |
| 165.7 nm, ${}^3P_2 - 2p3s\,{}^3P^o_2$ | E1 | 26.9 MHz | 348 MHz | 168 $\mathrm{W/cm^2}$ | 1.2 $\mathrm{W/cm^2}$ |
| 156.1 nm, ${}^3P_2 - 2s2p^3\,{}^3D^o_3$ | E1 | 16.5 MHz | 117 MHz | 51 | 3.3 |
| 193.1 nm, ${}^1D_2 - 2p3s\,{}^1P^o_1$ | E1 | 38.5 MHz | 367 MHz | 91 | 0.61 |
| 148.2 nm, ${}^1D_2 - 2p3d\,{}^1D^o_2$ | E1 | 8.3 MHz | 57 MHz | 48 | 13 |
| 136.4 nm, ${}^1D_2 - 2p4d\,{}^1D^o_2$ | E1 | 5.0 MHz | 21 MHz | 18 | 36 |
| 119.4 nm, ${}^3P_2 - 2p4d\,{}^3F^o_3$ | E1 | 2.7 MHz | 15.6 MHz | 35 | 128 |
| 119.4 nm, ${}^3P_1 - 2p4d\,{}^3F^o_2$ | E1 | 2.1 MHz | 11.2 MHz | 29 | 212 |
| 538.2 nm, $2p3s\,{}^1P^o_1 - 2p4p\,{}^1P_1$ | E1 | 13.3 MHz | 367 MHz (lower level) | 763 | 5.1 |
| 462.3 nm, ${}^3P_1 - {}^1S_0$ | M1 | 372 Hz | 0.60 Hz | $2.6\times10^{-6}$ | $7\times10^9$ |
| 985.3 nm, ${}^3P_2 - {}^1D_2$ | M1 | 358 Hz | $2.9\times10^{-4}$ Hz | $7\times10^{-13}$ | $7\times10^9$ |
| 609 $\mu$m, ${}^3P_0 - {}^3P_1$ | M1 | 104 kHz | $8\times10^{-8}$ Hz | $6\times10^{-25}$ | $8\times10^4$ |

The window $1/\tau < \Omega/2\pi <$ 30 MHz is empty for the strong
ground-term lines at 156 to 193 nm: their upper levels decay before one
flop the frame can show. It opens only for the weaker 119 to 136 nm
lines to $2p4d$ levels: $2p4d\,{}^1D^o_2$ (21 to 30 MHz, 1 to 1.4 cycles
per lifetime), $2p4d\,{}^3F^o_3$ and ${}^3F^o_2$ (11 to 30 MHz, 1 to 2.7
cycles), at 18 to 212 $\mathrm{W/cm^2}$. The visible 538 nm line starts
on $2p3s\,{}^1P^o_1$, which decays in 2.7 ns, so it cannot flop on
screen. A gas at 300 K has a Doppler width of 2 to 8 GHz across atoms,
so an ensemble dephases at once. Only an atom at rest, or a drive tuned
to the drawn atom's velocity, flops as the table says.

The forbidden lines invert the picture. $\Omega/2\pi$ of 1 Hz on the 462
nm M1 line needs $(1/372)^2\ \mathrm{W/cm^2} = 7\ \mu\mathrm{W/cm^2}$,
and ${}^1S_0$ lives 1.66 s: Rabi flopping visible at real time, as on an
optical-clock transition, frozen on the event clock. A thermal atom,
detuned by a Doppler shift of order a GHz, flops only if at rest or with
the laser tuned to it.

### 5.4 Stark effect and polarizabilities

Ground term, published: $\alpha = 11.73 \pm 0.48$ a.u. for ${}^3P_0$
(Dirac-Coulomb CCSD(T), cheng24, recommended), 11.66 nonrelativistic, and
$11.3 \pm 0.2$ in the 2018 table of Schwerdtfeger and Nagle (relayed
through cheng24). cheng24 notes the relativistic and spin-orbit effects
on carbon are small. No published tensor polarizability of
${}^3P_{1,2}$ and none of any excited C I level was found.

Partial sums over the listed E1 lines (calc I, $\alpha_i = \sum_k
f_{ik}/(E_k - E_i)^2$ in atomic units, $f_{ik} < 0$ for lower $k$): for
${}^3P_0$ the 14 bound lines give 4.95 a.u., 42 % of 11.73, the rest
lying in the continuum and in levels Phase 1 left out. The excited-level
sums are indicative only: $2p3s\,{}^3P^o_2$ 485, $2p3p\,{}^3D_3$ 553,
$2p4p\,{}^1P_1$ 231, $2p4p\,{}^3D_3$ 2747 a.u. The shift $-\alpha F^2/2$
at 10 kV/cm: 0.15 MHz for the ground term, 3 to 34 MHz for these levels.

Rydberg levels: the saddle of $-1/r - Fz$ lies at $-2\sqrt F$, so a
level of effective quantum number $n^*$ ionizes at $F = 1/(16n^{*4})$
a.u.: 397 V/cm at $n^* = 30$, 15 V/cm at $n^* = 68.3$ (calc G). glab18
detected its $2pnp\,{}^3D_3$ levels ($n$ = 35 to 70) by "pulsed electric
field ionization or autoionization".

A Stark shift of a few MHz is invisible. Field ionization of a Rydberg
atom is visible as an event, the electron leaving at a threshold field
that falls as $n^{*-4}$.

### 5.5 Autoionizing states above 11.26 eV

Above the first limit ($90\,820.348\ \mathrm{cm^{-1}}$) the asd export
(435 levels) lists only $2s2p^2 nl$ and $2s2p^3$ levels. Its highest
$2s^2 2p\,nl$ level, $2p({}^2P^o_{3/2})29d$ at $90\,753.8\
\mathrm{cm^{-1}}$, lies below the limit. The $2pnp\,{}^3D_3$ levels
above it are in glab18's table:

| level | $E$ ($\mathrm{cm^{-1}}$) | what is known of its decay |
| --- | --- | --- |
| $2s^2 2p\,np\,{}^3D_3$, $n$ = 43 to 69 | 90 820 to 90 860 | above the ${}^2P^o_{1/2}$ limit for $n^* > 41.6$ (calc G), "the unperturbed $2pnp\,{}^3D_3$ series" of glab18, detected by field ionization or autoionization, no widths given |
| $2s2p^2({}^4P)3s\,{}^5P_{1,2,3}$ | 103 541.69 to 103 587.18 | autoionization "strongly forbidden by selection rules" (hk2017), decays by 143 nm lines to $2s2p^3\,{}^5S^o_2$ |
| $2s2p^3\,{}^1D^o_2$ | 103 762(19) | position from hk2017's fit, never observed, "strongly autoionizing" |
| $2s2p^3\,{}^3S^o_1$ | 105 799.1137(30) | radiative rate $3.41\times10^9$, autoionization $1.50\times10^9\ \mathrm{s^{-1}}$ (wzb13 via hk2017): 30.5 % autoionizes, total FWHM 781 MHz, $\tau$ = 0.20 ns (calc K), observed widths about 1 GHz (lab05 via hk2017) |
| $2s2p^2({}^4P)3p\,{}^3D^o_{1,2,3}$ | 115 060 to 115 080 ($\pm$40 to 60) | strong photoionization feature (cantu81, hk2017 Table 5) |
| $2s2p^3\,{}^1P^o_1$ | 115 209(19) | predicted, unresolved from the above |
| $2s2p^2({}^4P)np\,{}^3D^o$, $n$ = 4 to 14 | 124 512 to 133 256 | 34 absorption lines resolved in fine structure (cantu81), series limit C II $2s2p^2\,{}^4P$ near 43 003 $\mathrm{cm^{-1}}$ above the C II ground (hk2017) |

hk2017 adds that every autoionizing state below $133\,823.8\
\mathrm{cm^{-1}}$ (16.59 eV) can decay only to the C II ground term, and
assigns low-energy Auger peaks to further $2s2p^2 nl$ terms (Table 5).
The widths of the $2s2p^2({}^4P)np\,{}^3D^o$ resonances were not
reached.

### 5.6 Photoionization from the ground term

Opacity Project R-matrix cross sections, smoothed over resonances and
fitted by verner (Table 1, C I, accuracy class C, "regular cross
sections. In these data, smoothed resonances reliably match the
background cross section"), evaluated in calc J:

| photon energy (eV) | wavelength (nm) | $\sigma$ (Mb) |
| --- | --- | --- |
| 11.26 (threshold) | 110.1 | 18.3 |
| 12.0 | 103.3 | 17.6 |
| 13.0 | 95.4 | 16.6 |
| 15.0 | 82.7 | 14.5 |
| 20.0 | 62.0 | 10.1 |
| 30.0 | 41.3 | 5.4 |

1 Mb = $10^{-18}\ \mathrm{cm^2}$. At 1 $\mathrm{W/cm^2}$ just above
threshold the rate is 10 per second. The fit removes the autoionizing
resonances on purpose, because "the OP theoretical energy levels deviate
from experimental ones by 1-2 %" (verner). cantu81's measured relative
cross section, 385 to 1100 Angstrom, "agrees with theoretical
predictions" (abstract). The absolute values of Marrone and Wurster
(1971) were not read.

18 Mb is the area of a disc of radius 0.024 nm, 0.46 bohr, about a
quarter of the $2p$ mean radius (1.71 bohr, phase1). The
photoelectron's angular distribution and the partial cross sections to
C II ${}^2P^o_{1/2}$ and ${}^2P^o_{3/2}$ are not in any source read.

### 5.7 Rydberg wave packets

The $2pnp\,{}^3D_3$ quantum defect is $0.722$ at $n = 3$, $0.678$ at
$n = 10$ (phase1 section 2.4) and $0.67556(12)$ at $n = 69$ (glab18,
Table 2, the level at $90\,860.24(3)\ \mathrm{cm^{-1}}$). For
$2pnd\,{}^3F^o_4$, $\delta = 0.05$ to $0.07$. A packet of mean $n^*$
returns to the core every Kepler period $T_K = 2\pi n^{*3}$ a.u., and
from $E = -1/2n^{*2}$, $E'' = -3/n^{*4}$, revives after
$T_\mathrm{rev} = 4\pi n^{*4}/3 = (2n^*/3)\,T_K$ (derived here). Calc G:

| $n^*$ | $T_K$ | $T_\mathrm{rev}$ | $T_K$ on event clock | $T_K$ on light clock |
| --- | --- | --- | --- | --- |
| 2.28 ($2p3p$) | 1.80 fs | 2.7 fs | 1.8 ns | 180 s |
| 10 | 152 fs | 1.0 ps | 0.15 $\mu$s | 4.2 h |
| 30 | 4.10 ps | 82 ps | 4.1 $\mu$s | 4.7 days |
| 68.3 ($n = 69$, glab18) | 48.4 ps | 2.2 ns | 48 $\mu$s | 56 days |

No C I Rydberg wave packet experiment was found. With the
${}^2P^o_{1/2,3/2}$ core split by $63.4\ \mathrm{cm^{-1}}$, a packet of
the ${}^2P^o_{3/2}$ series above $n^* = 41.6$ lies in the
${}^2P^o_{1/2}$ continuum and can autoionize on its return to the core.

## 6. Open software (question 5)

Licences and trees as read from the repositories (codes). None of these
runs at app run time. Each could run once at build time, its output
committed as a table.

| code | method | licence | cost of a C I run | output |
| --- | --- | --- | --- | --- |
| PySCF 2.14.0 | HF, CASSCF, MRCI, CISD, CCSD(T), FCI, natural orbitals, densities on any grid | Apache-2.0 | measured: the whole `carbon_casscf.py` (ROHF, four SA-CASSCF, CISD, densities and the conditional pair density), 19.0 to 39.7 s wall on 4 threads over four complete runs of successive versions on a shared, loaded host. Largest step, SA-CASSCF(4e, 13 orbitals) over nine components, 10.5 to 19.6 s | energies, CI vectors, 1- and 2-RDMs, orbitals as Gaussian coefficients, any density on a grid |
| Psi4 | HF, CASSCF, CI, CC, densities | LGPL-3.0 | no source figure for C, not run | as PySCF |
| GRASP2018 | MCDHF and relativistic CI, numerical radial orbitals | MIT | no source figure for C, not built | levels, mixing coefficients, radial orbitals, `rdensity`: "the natural orbitals and ... the radial density" (its README), as `name.nw` and `name.(c)d` |
| ATSP2K | MCHF and Breit-Pauli CI, numerical radial orbitals | CPC non-profit licence, no redistribution "without the written permission of the author", fetched through a web form | not obtained: the download is an online form, which needs the owner's approval | levels, CSF expansions, radial orbitals |
| ATSP (1996 MCHF package) | MCHF | no licence file in atsp-org/atsp | not built | as ATSP2K, older |
| HelFEM | finite-element HF and DFT for atoms, basis-set limit | BSD-3-Clause | not run | numerical HF orbitals, as Bunge's but to any precision |
| QMCPACK | VMC and DMC | University of Illinois/NCSA Open Source Licence | not run, seth2011 gives no CPU figure | energies, densities and pair densities by sampling |
| CHAMP | VMC and DMC | GPL-3.0 | not run | as QMCPACK |
| CASINO | VMC and DMC (the code of seth2011, brown2007) | "free for academic and other non-profit use: request a copy", not open source | not obtained | as QMCPACK |
| NECI | FCIQMC | GPL-3.0 | not run | energies, sampled RDMs |
| Dice | semistochastic heat-bath CI | GPL-3.0 (licence header) | not run | energies, RDMs, via PySCF |
| block2 | DMRG | GPL-3.0 | not run | energies, RDMs, via PySCF |
| FermiNet | neural-network VMC | Apache-2.0 | not run, no cost figure for C read | energy, samples of the wave function |

- PySCF alone does everything section 4 needs, on this host, in under a
  minute, with a small basis. A larger basis (cc-pCVQZ, 84 functions
  against 43, counted by PySCF) or MRCI would sharpen the numbers at a
  cost not measured.
- GRASP2018 is the one open code that writes numerical radial orbitals
  and natural orbitals of correlated atomic states directly, the natural
  successor to the Bunge orbitals if the mode wants term-dependent or
  correlated radial functions. Its QED step would also give the per-level
  QED value section 3.3 lacks. Building it (Fortran, CMake) was not
  attempted.
- Stated costs: str2019 two years on up to several hundred cores
  (section 2.2), rt2017 "runs of 1000 configuration term functions
  within a few minutes" (abstract). seth2011 and pfau2020 give no figure
  that was read.

## 7. Prior art (question 6)

phase1 section 9 covers NIST's Grotrian diagrams, PhET, Falstad's
hydrogen applets, Atom in a Box and Orbital Viewer: all that draw a
density draw hydrogen. Additions:

- Atom in a Box (dauger): "a state formed by a superposition" of up to
  eight eigenstates, "the allowed spectral transitions between those
  eigenstates", rendering that "raytraces through a three-dimensional
  cloud density" in real time. Exact hydrogen, no many-electron atom.
  Real-time volume ray marching of a density is feasible.
- Falstad's molecular orbitals (falstadmo): "the hydrogen molecular ion
  (H2+)" in 3-D, one electron, no method named.
- The Orbitron (orbitron): orbitals 1s to 7i, "Dot-density" plots,
  "Animated plots of electron density", "Plots of radial distribution
  functions", with its own warning of "errors in orbital names, many
  typos, incorrect labels". Whether hydrogenic is not stated.
- QuVis (quvis): no atom or emission simulation, photons only in
  interferometers and cryptography.
- 3Blue1Brown (3b1b): 204 sitemap URLs searched for eleven atomic and
  optical terms, 5 hits, none on orbitals. Lesson barber-pole-2 leads to
  "Visualizing Feynman's lecture on the refractive index": an index is
  the incoming wave plus the waves of the medium's driven charges, the
  physics under every medium of section 8.
- Eric Heller's art (aps1999, mit2001): prints "produced on an Epson 3000
  inkjet printer from computer data generated in Fortran, Matlab and
  Mathematica", "more impressionistic", with transformations "intended
  to blur the line between science and art". ericjhellergallery.com now
  serves an unrelated site. The research-grade version, heller2021 Fig.
  2, shows "a point source in the center ... over the same weak random
  potential" as rays in pink and the wave solution in green, side by
  side: which features are rays and which are waves.
- stodolna2013 (abstract): "In atoms the charge distributions described
  by the wave function are rarely observed", and photoionization
  microscopy where "this nodal structure is directly observed", for
  hydrogen in a static field. The measured picture of an outgoing
  photoelectron wave on a detector.
- goulielmakis2010 and ott2014 (records only): attosecond movies of a
  superposition's density moving, which a coherent drive could follow
  and spontaneous decay must not (phase1 section 8).
- Correlation: vn2022 and th2021 (4.4) publish carbon Coulomb holes and
  momentum-balance densities as plots. coulson1961 (the Coulomb hole of
  helium) and becke1990 (the electron localization function) are the
  classic forms (records only).
- Thaller's Visual Quantum Mechanics (vqm.uni-graz.at): connection
  refused.

Lessons for the mode: print the scale and the model (none of the above
prints its scale), show rays and waves as distinct (Heller), draw the
outgoing electron as a far-field pattern (Stodolna), and keep a
superposition's motion for coherent drives (Atom in a Box, Goulielmakis).

## 8. Branched flow (the owner's addendum)

The owner asked whether small heterogeneities, for example vacuum
fluctuations, could make the emitted photons or the orbitals' waves
branch. The answer recorded on the issue holds, with two refinements
(8.1) and one reversal (8.5).

### 8.1 What branched flow is, and what it needs

heller2021: waves "weakly deflected (forward scattered) by essentially
random fluctuations in a medium with correlation lengths longer than a
wavelength", "transitioning between ballistic and diffusive behavior".
The branches are caustics of the ray flow (kaplan2002: "how such
branching naturally arises from caustics in the classical flow"), not
valleys of the potential (topinka2001: "the current paths do not simply
follow low potential routes"). Three conditions:

1. Weak: $\epsilon = \sigma_V / E \ll 1$, the rms potential over the
   kinetic energy. For light $\epsilon = 2\sigma_n/n$ (8.2).
2. Smooth, with a correlation length $l$ the wave resolves. "Above the
   wavelength", as the issue and patsyk2020's abstract say, is not
   strict: kaplan2002 asks for "a wavelength no larger than $\xi$", and
   topinka2001 saw branches with "The correlation length of the
   disordered potential is about 25 nm, i.e. on the order of the
   wavelength", $\lambda_F = 37$ nm. The working test is the smoothing
   scale $b_{eff}$ of 8.2.
3. A localized source, heller2021: "emission in many directions from a
   spatially localized point source ... or a spatially extended source
   with initially restricted propagation directions, like a plane wave."

Coherence is not needed, which the issue's answer did not say.
patsyk2022: "the primary effect of branching occurs for both coherent
and incoherent light, but each pronounced branch is accompanied by
sidelobes arising from interference, which disappear when the waves are
incoherent", and "The position of the first caustic ... remains the same
as the coherence is reduced". Spontaneous emission from an ensemble is
incoherent, so a ray-density picture without fringes is the honest one.

### 8.2 Scaling laws

| source | model and convention | onset |
| --- | --- | --- |
| kaplan2002, Eqs. 1, 3 | $\overline{V(\mathbf r)V(\mathbf r')} = v_0^2 e^{-\lvert\mathbf r - \mathbf r'\rvert^2/\xi^2}$, units $\xi = 1$, mass and momentum 1, $E_F = 1/2$, plane manifold | $t_0 \equiv v_0^{-2/3}$, $L_{Lyap} \sim \xi (v_0/E_F)^{-2/3}$, no prefactor claimed |
| barkhofen2013, Eq. 2 | $c(r) = \sigma_V^2 e^{-r^2/l_c^2}$, $\epsilon = \sigma_V/E$ | $x_c/l_c = \alpha\,\epsilon^{-2/3}$, "$\alpha$ is a proportionality factor that, e.g., depends on the functional form of the correlation function", holds also for a point source |
| heller2021 | undulations of height $\epsilon$, energy $E$, bump size $d$ | $L = d\,(E/\epsilon)^{2/3}$ |

barkhofen2013: "The scaling of $x_c$ has been found numerically to
deviate from Eq. 2 for $\epsilon \gtrsim 10\%$", while the peak of the
scintillation index keeps it "to $\epsilon \approx 40\%$". Its fitted
$\alpha = e^{1.02}, e^{1.12}, e^{1.39}$ (2.8, 3.1, 4.0) are offsets
matched to its numerics, so they bracket the prefactor and do not
measure it.

The exact formula, maryenko2012 Appendix A (from Metzger's thesis, not
reached), for a point source in a random potential and a field $B$:

$$l_{caustic} = \pi^2 \kappa \left( \mathrm{Ai}\left[-\kappa^2 B^2\right]^2 + \mathrm{Bi}\left[-\kappa^2 B^2\right]^2 \right), \qquad \kappa = (2/D)^{1/3},$$

$D = \int_{-\infty}^{\infty} \partial_y^4 c(x,y)\rvert_{y=0}\,dx$, and
"For a Gaussian correlation function $c(x,y) = V_0^2
e^{-(x^2+y^2)/l_{cor}^2}$ we obtain $D = 12\sqrt\pi V_0^2 l_{cor}^{-3}$."
At $B = 0$, with $\mathrm{Ai}(0) = 0.355028$ and $\mathrm{Bi}(0) =
\sqrt3\,\mathrm{Ai}(0)$, $\pi^2(\mathrm{Ai}(0)^2 + \mathrm{Bi}(0)^2) =
4.976$ and (onset.js)

$$l_{caustic} = 2.263\, l\, V_0^{-2/3} = 3.592\, l\, \epsilon^{-2/3}, \qquad \epsilon = \sigma_V/E .$$

The appendix states no units. Its Hamilton-Jacobi equation implies unit
mass and, with time read as distance, unit speed, so $E = 1/2$ and
$\epsilon = 2V_0$. A wrong $E$ would show in the ray check as a factor
$2^{2/3} = 1.59$.

The ray check (onset.js, section 8): paraxial rays with distance as
time, $y'' = -V_y$, the Jacobian $J'' = -V_{yy}J$, a caustic at its first
zero (point source $J(0) = 0$, $J'(0) = 1$, plane wave $J(0) = 1$,
$J'(0) = 0$), in $V = V_0\sqrt{2/N}\sum\cos(\mathbf k_i\cdot\mathbf r +
\phi_i)$ with $\mathbf k_i$ from $N(0, 2/l^2)$ per component (ensemble
correlation $V_0^2 e^{-r^2/l^2}$), velocity Verlet with step $0.04\,l$,
10 rays per realization:

| source | $\epsilon$ | modes $N$ | rays | mean $L$ ($l$) | s.e. | $L/(l\,\epsilon^{-2/3})$ |
| --- | --- | --- | --- | --- | --- | --- |
| point | 0.01 | 256 | 1000 | 81.79 | 1.58 | 3.796 |
| point | 0.03 | 256 | 1000 | 37.31 | 0.69 | 3.602 |
| point | 0.10 | 256 | 1000 | 17.38 | 0.33 | 3.744 |
| point | 0.03 | 64 | 500 | 45.17 | 1.44 | 4.361 |
| point | 0.03 | 128 | 500 | 38.81 | 1.06 | 3.747 |
| point | 0.03 | 1024 | 500 | 37.62 | 1.03 | 3.632 |
| point | 0.01 | 1024 | 500 | 78.82 | 2.33 | 3.658 |
| plane | 0.01 | 256 | 1000 | 53.24 | 1.44 | 2.471 |
| plane | 0.03 | 256 | 1000 | 25.36 | 0.67 | 2.449 |

With enough modes the point-source prefactor agrees with 3.592 within
one standard error: 3.602 (256 modes) and 3.632 (1024) at $\epsilon =
0.03$, 3.658 (1024) at $\epsilon = 0.01$. At $\epsilon = 0.01$ with 256
modes it reads 3.796, 2.8 standard errors high, because over the longer
path 256 modes are not yet a Gaussian field. At $\epsilon = 0.1$ it reads
3.744, 2.2 standard errors high, where $L$ is only 17 correlation lengths
and the white-noise approximation behind the formula weakens. The
plane-wave prefactor, about 2.46, is computed here, with no source
formula reached.

The window: metzger2014, "in weak random media this happens on a shorter
length scale than the mean free path, which scales as
$\epsilon^{-2}\ell_c$", so branching lives in $l\,\epsilon^{-2/3} \ll x
\ll l\,\epsilon^{-2}$. For light, the paraxial ray $d^2y/dx^2 =
\partial_y \delta n / n_0$ against a particle's $d^2y/dx^2 = -\partial_y
(V/2E)$ gives $\epsilon = 2\sigma_n/n_0$, $V_0 = \sigma_n/n_0$, the
mapping of linma2021 Eq. 2.2.2.5 ("$z = y$, $m = k_0\bar n$, $V(x,z) =
\frac{k_0}{2\bar n}[\bar n^2 - n_{eff}^2(x,z)]$").

Branch statistics, kaplan2002 (plane manifold, width $W$ correlation
lengths, smoothing scale $b$):

- Stretching is log-normal (Eq. 4), with exponent $\alpha$ and spread
  $\beta$, and caustics multiply as $N^{caus} \sim W e^{(\alpha +
  \beta/4)t/t_0}$ (Eq. 6).
- "The number of visible branches reaches its peak value of $N^{branch}
  \sim W b^{-1/2}$ at the time scale $t/t_0 \approx \frac12 \alpha^{-1}
  \ln b^{-1}$", then "falls off exponentially with scaled time $t/t_0$,
  at the rate $\alpha^2/\beta$" (Eq. 9), fitted $\alpha^2/\beta = 0.30$,
  $\alpha = 0.65$, $\beta = 1.42$ (Fig. 1 caption).
- The brightest branch fades as $\ln I_b^{max} \approx \frac12 \ln
  b^{-1} - \gamma t/t_0$, $\gamma = 0.17$ (Eq. 10), the covered fraction
  as $\ln f^{branch} \approx -2\gamma t/t_0 - 2\ln I_{cutoff}$ (Eq. 11),
  and the intensity tail is $P(I_b) \sim I_b^{-3}$ (Eq. 12).
- "caustics in quantum mechanics do not get resolved below an effective
  smoothing scale $b_{eff} = \hbar^{2/3} v_0^{-4/9}$" (Eq. 13), so for a
  wave $b_{eff}/l = (\lambda/2\pi l)^{2/3} V_0^{-4/9}$ (onset.js).
  topinka2001 has $b_{eff}/l = 1.6$ and plainly visible branches with
  fringes, so $b_{eff}/l$ marks where single folds stop being resolved,
  not where branches vanish.
- Kaplan's caveat: "the numerical values of the exponents $\alpha$,
  $\beta$ ... may well depend on the details of the random potential".

metzger2014: the intensity at a fold scales as $I_{fold} =
c\,(\lambda/\ell_c)^{-1/3} \epsilon^{2/9}$ (Eq. 4), the maximum across
ten correlation lengths is Frechet distributed, $P(I/[\lambda^{-1/3}
\ell_c^{1/3}\epsilon^{2/9}] \le I_{max}) = e^{-[(I_{max}-m)/s]^{-a}}$
(Eq. 5), $a = 62.5$, $m = -95.2$, $s = 101.3$ for all media simulated,
and "for Gaussian correlated potentials there is on average
approximately one focal region per six correlation lengths". metzger2010
gives, per its abstract, "an analytical expression for the number of
branches valid for all distances from a source", not reached.

Two source defects. heller2021 (arXiv v1, p. 5) writes the mean free
path as "$\ell = \langle\lvert v\rvert\rangle\tau \propto (\epsilon/E)^2
d$ is much larger than the typical branching length scale, i.e. $\ell \ll
L$", whose exponent and inequality contradict the same sentence and
metzger2014, a misprint (the published version not compared). se2004 Eq.
9 writes the radio index as $\eta = 1 - 4\pi n_e r_e/k^2$, which is
$n^2$, not $n$. onset.js uses $n$, half the deviation, which moves an
onset by $2^{2/3}$, immaterial against the gaps of 8.4.

For the app: the onset, $L = 2.263\,l\,(\sigma_n/n)^{-2/3}$ for light
and $3.592\,l\,(\sigma_V/E)^{-2/3}$ for an electron, a branch spacing of
about six correlation lengths and a branch count that peaks and decays
make a drawn medium statistically honest. They do not give the pattern
of any real realization.

### 8.3 Vacuum fluctuations do not branch a photon or an orbital

1. The empty vacuum is not a medium. dg1998 treat the vacuum
   "considered as a medium" only when "modified by various external
   environments, e.g., electromagnetic (EM) fields, temperature,
   geometric boundary configurations, gravitational background and
   non-trivial topologies". The direction-averaged velocity shift (their
   Eq. 1, the "unified formula" of Latorre, Pascual and Tarrach),
   $\delta\bar v = -\frac{44}{135}\frac{\alpha^2}{m^4}u$, is
   proportional to the background energy density $u$, zero in empty
   space. A uniform background gives a uniform shift with no correlation
   length, and a random background is an ordinary medium.
2. The fluctuations shake the electron as a fast, isotropic jitter, not
   a frozen potential. In Welton's picture (lambwiki) $\langle(\delta
   \mathbf r)^2\rangle \cong \frac{2\alpha}{\pi}
   \left(\frac{\hbar}{mc}\right)^2\ln\frac{1}{\pi\alpha}$, an rms of
   $5.1\times10^{-14}$ m, $9.7\times10^{-4}$ bohr (onset.js). It smears
   the Coulomb potential and shifts the level (the Lamb shift, 3.3), with
   no correlation length on the orbital's scale and no time to act as a
   fixed lens.
3. A bound orbital is a stationary state (phase1 section 8) with no flow
   to branch. A static random potential would shift and mix the levels.

urban2013 proposes, speculatively, transient captures by virtual pairs
that "predict fluctuations of its time of flight of the order of
$0.05\,\mathrm{fs}/\sqrt{\mathrm m}$": a jitter in arrival time, not a
transverse deflection, and unmeasured. A "vacuum" medium toggle would
show nothing true.

### 8.4 Real media around a carbon atom

Onsets (onset.js) for C I's green line, 538.2 nm ($2p4p\,{}^1P_1 \to
2p3s\,{}^1P^o_1$, photon), its fine-structure line, 609.135 $\mu$m
(${}^3P_1 \to {}^3P_0$, phase1 section 3.3), and a 0.3 m radio wave.

Turbulent air. cox2021, citing Andrews and Phillips: "Values of $C_n^2$
vary from $10^{-17}$ m$^{-2/3}$ in 'weak' turbulence and up to about
$10^{-13}$ m$^{-2/3}$ in 'strong' turbulence", the inner scale $l_0$ "is
typically on the order of millimetres", $\Phi_n = 0.033\,C_n^2
\kappa^{-11/3}$ (Eq. 9), and the Rytov variance $\sigma_R^2 = 1.23\,
C_n^2 k^{7/6} L^{11/6}$ (Eq. 10). The inner cutoff
$e^{-\kappa^2/\kappa_m^2}$, $\kappa_m = 5.92/l_0$, is kulikov2011's.
Kolmogorov turbulence has no single correlation length, so onset.js
computes $D = 2\pi(0.033\,C_n^2)\frac{3\pi}{4}
\frac{\Gamma(7/6)}{2}\kappa_m^{7/3}$ and $l_{caustic} = 4.976\,
(2/D)^{1/3}$, a two-dimensional formula on a three-dimensional medium
that overestimates the distance by a factor of order one.

| $C_n^2$ (m$^{-2/3}$) | $l_0$ | ray onset $L_{ray}$ | $\sqrt{\lambda L_{ray}}$ | Rytov $\sigma_R^2 = 1$ at | equivalent $V_0$ | $b_{eff}/l_0$ |
| --- | --- | --- | --- | --- | --- | --- |
| $10^{-17}$ | 1 mm | 5.6 km | 55 mm | 53 km | $2.6\times10^{-10}$ | 35 |
| $10^{-17}$ | 10 mm | 33 km | 134 mm | 53 km | $5.6\times10^{-10}$ | 5.4 |
| $10^{-15}$ | 1 mm | 1.2 km | 25 mm | 4.3 km | $2.6\times10^{-9}$ | 12.7 |
| $10^{-15}$ | 10 mm | 7.2 km | 62 mm | 4.3 km | $5.6\times10^{-9}$ | 1.9 |
| $10^{-13}$ | 1 mm | 258 m | 12 mm | 350 m | $2.6\times10^{-8}$ | 4.6 |
| $10^{-13}$ | 10 mm | 1.5 km | 29 mm | 350 m | $5.6\times10^{-8}$ | 0.70 |

The Fresnel scale $\sqrt{\lambda L}$ exceeds the inner scale in every
row, so diffraction blurs the inner-scale lenses and the observable is
scintillation, with onset at the Rytov distance, 350 m to 53 km, within
a factor of 5 of the ray estimate (the last row lies on the border). The
branches are threads $1.6\times10^5$ to $5.6\times10^6$ times longer
than wide ($L/l \approx 2.263\,V_0^{-2/3}$), and drawn at $\epsilon =
0.1$ their angles are exaggerated $9.3\times10^3$ to $3.3\times10^5$
times. The everyday sight is a star's twinkling, studied "as far back as
1977 by Berry" (kaplan2002, Berry not read).

The interstellar medium, where carbon radiates its 609 and 370 $\mu$m
lines. ars1995 (abstract): a structure function "approximately power law
over $2\times10^6$ m < scale < $10^{13}$ m", "an upper limit to the
inner scale, $l_o \lesssim 10^8$ m", index "$\approx 3.7$". se2004:
"$\langle\delta n_e^2\rangle^{1/2} \sim 5 \times 10^{-6}$ cm$^{-3}$ for
the high latitude medium" at "the dominant scale $\delta x \sim 10^{10}$
cm" (Cordes et al. 1985, relayed). se2004 quotes the ars1995 range in
centimetres, the abstract in metres, and the abstract is followed. A
cold plasma has $\delta n = r_e\lambda^2 \delta n_e/(2\pi)$. Model: one
Gaussian scale $l = 10^8$ m and $\sigma_{n_e} = 5$ m$^{-3}$, inputs from
two papers:

| wavelength | $\sigma_n$ | onset $L$ | in kpc | $b_{eff}/l$ |
| --- | --- | --- | --- | --- |
| 538.2 nm | $6.5\times10^{-28}$ | $3.0\times10^{26}$ m | $9.8\times10^6$ | 109 |
| 609.135 $\mu$m | $8.3\times10^{-22}$ | $2.6\times10^{22}$ m | $8.3\times10^2$ | 23 |
| 0.3 m | $2.0\times10^{-16}$ | $6.6\times10^{18}$ m | 0.21 | 5.8 |

The onset scales as $l\,\lambda^{-4/3}\sigma_{n_e}^{-2/3}$, falling by
$4.6\times10^7$ from 538.2 nm to 0.3 m. At radio it matches the
distances of ars1995's pulsars ("nearby ($\lesssim 1$ kpc)"), the
"earliest studied example" of branched flow (heller2021), here the
interference-decorated kind ($b_{eff}/l = 5.8$). Carbon's light does not
branch in the interstellar plasma within the Galaxy: ten million
kiloparsecs at 538.2 nm, 830 kpc at 609 $\mu$m.

Plasma. The index differs from 1 by $r_e\lambda^2 n_e/(2\pi)$, about
$1.3\times10^{-28}$ m$^3$ times $n_e$ at 538.2 nm, so visible light
branches only in a dense, uneven plasma. The one case found is
simulated, jiang2022: density "0.08$n_c$", "coefficient of density
variation is $\sim$30%", "isotropic correlation length $l_c = 4.8$
$\mu$m", $\lambda_0 = 1.06$ $\mu$m, "the laser breaks up into several
filaments after the first caustics at $\sim$19.8 $\mu$m". Taking the
30 % as an rms (an assumption), $\sigma_n \approx 0.012$ and the linear
onset is 0.21 mm (onset.js), ten times theirs, which their text
explains: "photoionization by the laser can locally enhance the density
variations along the laser paths and thus the branching". A carbon atom
there would be ionized.

The soap film. patsyk2020 (abstract): "smooth thickness variations in
the film act as a correlated disordered potential, focusing the light
into filaments that display the features of branched flow: scaling of
the distance to the first branching point and the probability
distribution of the intensity". patsyk2022 (532 nm cw) shows in Fig.
1(d) "BF generated by a localized source coupled to the film (the fiber
tip seen on the left)", the geometry of an atom emitting into a medium.
The film's parameters are paywalled. linma2021, a student preprint, Sec.
4: $\bar n = 1.2968$, $m \approx 1.53\times10^7$ m$^{-1}$, $\sigma_V
\approx 9.11\times10^5$, $l_c \approx 0.202$ mm, first branching by eye
at 5.15 mm. With $V_0 = 0.0595$ the formula predicts 3.0 mm, so the
measurement is 1.72 times the prediction, in the direction barkhofen2013
says the onset should not lie. No claim on the prefactor rests on it.

Electrons, the calibration. topinka2001: $E_F = 16$ meV, $\lambda_F = 37$
nm, rms potential "about 8% $E_F$", correlation length "about 25 nm",
mean free path 11 $\mu$m. The formula gives a first caustic at 0.48
$\mu$m, inside the mean free path, $b_{eff}/l = 1.6$. The potential is
smooth because "The donors are located in a $\delta$-layer displaced
from the 2DEG by 22nm".

### 8.5 The outgoing photoelectron

The issue's answer said an electron ionized past 11.26 eV "leaves as an
outgoing wave that does branch in a random potential". Its de Broglie
wavelength (onset.js, codata):

| energy | wavelength | in bohr | speed |
| --- | --- | --- | --- |
| 0.5 eV | 1.734 nm | 32.8 | $4.19\times10^5$ m/s |
| 1 eV | 1.226 nm | 23.2 | $5.93\times10^5$ m/s |
| 3 eV | 0.708 nm | 13.4 | $1.03\times10^6$ m/s |
| 10 eV | 0.388 nm | 7.3 | $1.88\times10^6$ m/s |

Branching needs a smooth weak potential with $l \gtrsim \lambda$, about
a nanometre, and no medium around a free carbon atom offers one:

- A neutral gas: each molecule's potential is short-ranged, the
  opposite of smooth, so each collision scatters through a large angle
  and the motion is a random walk. The N$_2$ cross sections that would
  give the mean free path were not reached.
- A plasma: a sum of point charges. A 3 eV electron at impact parameter
  $b$ feels $V/E = \alpha\hbar c/(bE)$, 0.48 at 1 nm and
  $4.8\times10^{-4}$ at 1 $\mu$m (onset.js), and the curvature statistic
  $D$ is dominated by the closest approaches (a derivation made here,
  the Debye-screened form not sourced). That is Coulomb collisions, not
  branched flow. The 2DEG is smooth only because its charges sit 22 nm
  away.
- The C$^+$ ion left behind: one Coulomb field, not random.

The parts disagreed here. The dynamics research (5.5, 5.6) tied an
autoionization or ionizing excitation to "the case where the issue's
comment says branching can occur". The branched-flow research, which
looked for the medium, found none, and this document follows it:
drawing branching photoelectrons would be drawing a 2DEG around a carbon
atom. The honest photoelectron picture is the outgoing wave and its
far-field pattern on a detector (stodolna2013), and in a gas a random
walk.

### 8.6 A renderer for the pane

The Carbon mode costs a median 7.9 ms per frame on a 400 by 380 canvas
at full activity under swiftshader (dec0015), and three panes ran at 7
to 8 frames a second on a loaded host. bench.js (median of 15 to 30
runs, ms, blit not included since Node has no canvas):

| step | cost |
| --- | --- |
| field on a 400 x 380 grid, 32 modes, separable cos/sin products | 9.99 |
| field on a 101 x 96 grid (4 px cells), 16 modes | 0.44 |
| field on a 101 x 96 grid, 32 modes | 0.75 |
| field on a 101 x 96 grid, 128 modes | 2.54 |
| field on a 101 x 96 grid, 256 modes | 5.64 |
| 2000 rays from a point source, 1 px steps, bilinear gradient, density deposit | 12.6 |
| 4000 rays, 1 px steps | 25.1 |
| 8000 rays, 1 px steps | 49.1 |
| 4000 rays, 0.5 px steps | 50.1 |
| split-step paraxial beam, 512 transverse points, 400 steps, 2 FFTs per step | 15.3 |

Ray cost grows with rays times steps, independent of grid and mode
count. With $l = 6$ px and $\sigma_n = 0.05$ ($\epsilon = 0.1$, onset
100 px) the scintillation index of the 8000-ray density on a circle of
radius 150 px is 2.85 (bench.js), well into the branched regime. Looked
at once (picture.js, another realization): bright, forking threads in
all directions, dark voids between them, the fan uniform within about 60
px of the source. At 2000 rays the main branches are as plain, and
single rays show as fine lines in the voids and at the rim.

The mode count matters. onset.js (section 9): the field's excess
kurtosis is $-0.19$, $-0.10$, $-0.045$ at 8, 16, 32 modes (random-phase
value $-3/(2N)$), and the largest error of one realization's correlation
against $e^{-r^2/l^2}$ is 0.35, 0.25, 0.17 at 8, 16, 32 modes, 0.06 at
256. At $\epsilon = 0.03$ the mean first caustic is 12.5
$l\,\epsilon^{-2/3}$ at 8 modes (a lower bound, a quarter of the rays
never focusing within 25 times the predicted distance), 9.5 at 16, 5.6
at 32, 4.4 at 64, 3.7 at 128, 3.6 at 256 and 1024. A few modes make a
quasi-periodic field that focuses too little and too late. At least 128
modes are needed at this strength, more for weaker media (256 still read
6 % high at $\epsilon = 0.01$), at 2.54 to 5.64 ms per rebuild: too much
every frame beside 7.9 ms, nothing if built once.

Designs: (1) a static medium traced once at a mode change, 30 to 55 ms,
then a blit per frame of the cached density, revealed inside the radius
of the existing expanding front, with rays accumulated over frames to
remove striations. (2) A drifting medium retraced each frame: a 33 ms
frame leaves room beside 7.9 ms for a 128-mode field and about 3000
rays, with decay across frames or a light blur hiding single rays. (3)
The paraxial wave picture, 15 ms a pass, a one-directional beam with
interference that incoherent emission does not show, not right for the
atom. The reference implementation is kramer's kick-drift script, named
in heller2021: it maps an image of phase space through random kicks and
drifts, the thin-lens form of the same ray flow.

### 8.7 What a "medium" toggle would honestly show

The atom's view is 24 bohr (1.3 nm). The shortest onset for a C I line
in a real medium is 350 m, which the light clock ($c/10^{17}$, 2.998 nm
a second on screen) would take $1.2\times10^{11}$ s to cover. So a
toggle cannot overlay branches on the existing fronts. It can only open
a separate view, printed with: "medium view: not to the atom's scale, 1
px = [scale]", the medium, its $l$, $\sigma_n$ and onset (for air the
Rytov distance), "ray density, point source, incoherent light, no
fringes", "angles exaggerated: drawn $\epsilon$ = 0.1, real $\epsilon$ =
$5\times10^{-10}$ to $10^{-7}$", and for the interstellar medium the
visible line's onset (about $10^7$ kpc) beside the radio one, with no
branches drawn for the visible line. It must not imply that the vacuum,
the orbital or the photon near the atom branches.

## 9. Candidates, ranked

Criterion: a picture of the real atom at its real scale with data in
hand first, then one that must be amplified or exaggerated to be seen,
then one whose data needs a new run or source, and within each the
lesser effort first. Zeeman precession leads because the owner has
filed it.

1. Zeeman precession, filed as issue #158 (5.2). A $B$ control, 0 to
   about 2 mT, and axis at an angle to $z$. The cloud and the source
   direction of the next jump turn about $B$ at 14 Hz on screen per mT
   per unit $g_J$, 1 to 5 turns per lifetime for $2p4p$ emitters. Data:
   three measured $g_J$ (asd), the rest by the LS formula (calc B),
   $\mu_B/h$ (codata), in hand once the LS values join the data file.
   Shows a real precession at its real ratio to the decay. Not a split
   level, and the LS $g_J$ of mixed levels is a model, labelled so.
2. Fermi hole probe (4.4). A click places a test electron in the ground
   cloud, and the same-spin density dims by the exact Hartree-Fock Fermi
   hole. Data: the Bunge orbitals in `app/viz/carbon-data.js`, in hand.
   Shows Pauli exclusion, a large effect. Not Coulomb correlation, and
   only for the one-determinant components of the ground configuration.
3. Coherent drive (5.3). A laser on a 119 to 136 nm line to a $2p4d$
   level, populations flopping one to three times at 11 to 30 Hz on the
   event clock while the superposition density oscillates, or the 462 nm
   M1 line at real time, 1 to 10 Hz. Data: $A$ values in hand, steck's
   formula. The one case where an oscillating cloud is right. Near the
   frame limit, and for a gas only with the Doppler caveat printed.
4. The continuum above 11.26 eV (5.5, 5.6, 8.5). The autoionizing levels
   above the dashed limit, with widths where known, and an ionizing
   excitation (110 nm or shorter, 18 Mb) that removes an electron,
   drawn as an outgoing wave whose far-field pattern lands on the pane's
   edge as the photon's detection does. Data: asd levels above the limit
   (re-exportable with the Phase 1 query), the verner fit, the
   ${}^3S^o_1$ rates, in hand. The photoelectron's angular distribution
   is not. No resonance profiles (most widths not reached), and no
   branching (8.5).
5. Two-configuration ground state (4.1). The $2p^4$ component at 2 %
   weight beside the $2s^2 2p^2$ cloud, or the 2 % flow of charge from
   $2s$ into the empty $2p$, weight printed. Data: run plus Bunge
   orbitals, in hand for the two-CSF model. Shows why one configuration
   is not the whole atom. A 2 % effect, drawn faint or amplified, its
   weight computed here, not published.
6. Natural occupations as bars, $1s$ to the first correlating orbitals
   (4.2). In hand from the run. A summary, not a picture of space.
7. ${}^{13}$C isotope view (3.6, 3.7). A toggle or a mixed ensemble at
   1.07 % ${}^{13}$C, a zoomed line profile with the ${}^{13}$C peak at
   the hk2017 shift beside the Doppler width, and ${}^{13}$C's hyperfine
   levels in the ground inset. Data: hk2017 Tables 6 to 8, not yet in
   the data file. Shows measured shifts of 0.5 to 0.7
   $\mathrm{cm^{-1}}$ on the $2s2p^3$ lines and the sign flip. Needs a
   zoom, and the visible lines' shifts are not published.
8. Medium view, static (8.6, 8.7). A separate view toggled from the
   Carbon pane: rays of incoherent light from a point source through a
   cached Gaussian field of 256 or more modes, revealed by the expanding
   front, labelled as in 8.7, the onset printed for air (Rytov, 350 m to
   53 km at 538.2 nm) and the interstellar medium. Data in hand. Shows
   what branched flow looks like and where it starts. Angles exaggerated
   $10^4$ to $3\times10^5$ times for air, no real medium's pattern, and
   nothing of the atom.
9. Coulomb hole probe, the correlated version of 2 (4.4). Data: a
   correlated pair density tabulated at build time by PySCF, not in hand
   (the run gives slices only). Shows electrons avoiding each other
   beyond Pauli, about 20 % of the Fermi hole and a 42 % cut of the
   on-top pair density, labelled with method and 87 %. Not the cusp.
10. Rydberg packet with its own clock (5.7, 5.4). A radial packet on the
    $2pnp\,{}^3D_3$ ladder at $n^* \approx 10$ to 30, breathing at $T_K$
    and reviving at $T_\mathrm{rev}$, on a stated clock of about
    $10^{11}$ to $10^{12}$, with field ionization at $1/(16n^{*4})$.
    Quantum defects in hand. The packet's shape is a model, labelled.
11. Wavelength contrast in the interstellar medium (8.4). One medium,
    two panels: a 0.3 m wave branching at 0.21 kpc, the 538.2 nm line
    not branching for $10^7$ kpc, the $\lambda^{-4/3}$ law printed. In
    hand, the single-scale model labelled. Shows why pulsars scintillate
    and carbon's light does not.
12. Correlation difference map (4.3). Signed $\rho_{\rm corr} -
    \rho_{\rm HF}$, amplified by a printed factor near 100. Radial data
    in hand, a 3D grid not. Shows a 0.3 to 0.4 % contraction, nothing
    else.
13. Fine-structure beats (5.1), under a third clock of about $10^{12}$
    in which a $2p3s$ decay takes 48 minutes. Data in hand.
14. Soap-film analogue (8.4). A point source in a film, onset a few
    millimetres, labelled "laboratory analogue". Only the student
    preprint's numbers. Nothing around a carbon atom.
15. Panels of numbers: each correction of 3.8 with its size in
    $\mathrm{cm^{-1}}$ and pixels, and the benchmark ladder of 2.1 as a
    log chart of $\Delta$. In hand. Charts of precision, not pictures of
    the atom.

Not candidates: a vacuum-fluctuation medium (8.3), branching orbitals
(8.3), branching photoelectrons around a free atom (8.5).

## 10. Open questions for the owner

The magnetic-field question is settled by issue #158, which asks for
the $B$ control and LS $g_J$ labelled as a model.

1. Correlation by probe: is a view that needs a click, a test electron
   placed in the cloud (candidates 2 and 9), welcome in the Carbon mode,
   or should correlation be shown without input?
2. Amplified pictures: is an effect worth drawing if it must be
   magnified to be seen, with the factor printed: a 2 % admixture, a
   0.5 % density change amplified near 100 times, or branches whose
   angles are exaggerated $10^4$ to $3\times10^5$ times (candidates 5,
   8, 12)?
3. Build-time runs: may a research script install PySCF in a venv, as
   the run here did, to produce committed tables? It would not ship
   with the app.
4. A zoom: should the pane gain a zoom per multiplet or per line, so that
   fine structure, the ${}^{13}$C shift and hyperfine structure can be
   seen at all? And is a ${}^{13}$C toggle worth it, given that its
   measured shifts sit on ultraviolet lines, not the visible ones?
5. A third clock: beats and Rydberg packets need a slowing of $10^{11}$
   to $10^{12}$. A separate view with its own stated clock, or printed
   numbers?
6. The medium view: it must sit at its own scale, metres to kiloparsecs,
   beside the 24-bohr atom. Is a separate view wanted, or should the
   idea be dropped? If kept, turbulent air (the nearest real case) or
   the interstellar medium (carbon's home, where its light does not
   branch)?

## 11. Not reached

- chak1993's full text (paywalled): its estimated exact energies and
  their uncertainty.
- Maldonado et al. 2011 (not on arXiv): VMC and DMC energies for about
  17 C I terms, which would settle the disputed ground value (2.3).
- Froese Fischer, Brage and Jonsson, Computational Atomic Structure
  (1997), and Clementi and Veillard's degeneracy-correlation papers,
  which may print a two-configuration $c_2$ for C ${}^3P$.
- The data behind vn2022's and th2021's figures. Natural occupations of
  C I from a converged method: none found.
- rz26's tables and rz25's PDF: ab initio ${}^3P_{1,2}$, ${}^3P^e$ and
  ${}^3D^e$ intervals of ${}^{12,13,14}$C with the $\alpha^3$ and
  $\alpha^4$ parts separate, the best measure of QED on the fine
  structure. A per-level C I QED value: none found (a GRASP2018 run would
  give one).
- Widths and Fano parameters of the $2s2p^2({}^4P)np\,{}^3D^o$
  resonances (cantu81's full text or an R-matrix paper). Marrone and
  Wurster 1971 (JQSRT 11, 327), the absolute cross section at four
  wavelengths.
- TOPbase (https://cdsweb.u-strasbg.fr/topbase/xsections.html) and
  ATSP2K: both only through a web form, not submitted without the
  owner's approval. TOPbase would give the unsmoothed OP cross sections
  with resonances.
- NIST reference L292 behind $g_J(2p3s\,{}^1P^o_1) = 0.97$ (the
  bibliography query returned an error page). The Schwerdtfeger and
  Nagle polarizability table itself (Mol. Phys. 117, 1200, 2019).
- Any measured hyperfine constant of an excited ${}^{13}$C I level, any
  C I quantum-beat, Hanle or Rydberg wave-packet experiment, and the C I
  photoelectron angular distribution: none found.
- patsyk2020's body (the film's thickness, $l$, $\sigma_n$, onset
  scaling), metzger2010 (the branch-number formula), Metzger's thesis
  (HTTP 403), Welton 1948 (read through Wikipedia), Berry 1977.
- The N$_2$ electron cross sections (Itikawa, J. Phys. Chem. Ref. Data
  35, 31, 2006, Song et al. 52, 2023): pages without the tables.
- jiang2022's published version, Nonlinear branched flow of intense
  laser light in randomly uneven media, Matter Radiat. Extremes 8,
  024402 (2023, per Crossref): not compared.
- Point-source and three-dimensional first-caustic statistics (Kulkarny
  and White, Phys. Fluids 25, 1770, 1982, and Klyatskin). The 2D formula
  is applied to 3D media here and labelled so.
- Thaller's Visual Quantum Mechanics (connection refused). PhET's pages
  render only with JavaScript.
