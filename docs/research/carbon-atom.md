# The neutral carbon atom (C I) for the Carbon mode

Status: current, Phase 1 of issue #144, gathered 2026-10-15. Every number
below comes from a source in section 1 or from a computation in
`scripts/research/carbon_data.py` on those sources. The numbers the mode
uses are in `docs/research/carbon-atom-data.json`, one row per level,
line and orbital, each row naming its source key. Phase 2 is built from
this document and that file alone.

## 0. Summary

- The atom: 68 levels of C I, all J-resolved, every level below
  $84\,122\ \mathrm{cm^{-1}}$ (10.43 eV) except the twelve $2p4f$ levels.
  The set is closed under radiative decay: every decay NIST lists from a
  chosen level ends on a chosen level (section 2.2).
- The lines: 559 NIST lines among those levels with transition
  probabilities, 550 electric dipole (E1) and 9 magnetic dipole (M1) or
  electric quadrupole (E2). 57 lie in the visible (380 to 780 nm), 112 in
  the vacuum ultraviolet, 4 in the near ultraviolet, 386 in the infrared.
- The colours come from the $2p4p \to 2p3s$ lines (blue 477 nm, cyan 493,
  green 505 and 538), the $2p4p \to 2s2p^3$ lines (yellow 580), the
  $2p4d, 2p5s \to 2p3p$ lines (red 659, 683, 711, 748, 766 nm), and the
  forbidden blue 462 nm line of the ground configuration.
- Allowed decays take 2.7 to 243 ns. Forbidden ones take 33 ms
  ($2s2p^3\,{}^5S^o_2$), 1.66 s (${}^1S_0$), 57 min (${}^1D_2$) and 44 to
  146 days (${}^3P_{1,2}$). A frame is 16.7 ms.
- The density: the ground configuration from the Roothaan-Hartree-Fock
  orbitals of Bunge, Barrientos and Bunge (1993), transcribed and checked
  to $5\times10^{-6}$. An excited configuration: the $1s^2 2s^2 2p$ core
  from the same orbitals plus one outer orbital from a quantum-defect
  model fixed by the NIST energy alone.
- The consistency checks pass: Ritz wavelengths from level differences
  agree with NIST to $1.4\times10^{-7}$ relative, branching ratios sum to
  one, NIST and MCHF lifetimes agree within 4 % for the levels both give,
  save three explained cases (section 4).

## 1. Sources

| key | citation | version | accessed |
| --- | --- | --- | --- |
| asd | A. Kramida, Yu. Ralchenko, J. Reader and NIST ASD Team (2024), NIST Atomic Spectra Database, NIST, Gaithersburg, MD, DOI 10.18434/T4W30F, https://physics.nist.gov/asd. C I levels and lines. Its primary data sources for C I, as the lines page names them: levels and wavelengths Haris and Kramida 2017, transition probabilities Wiese et al. 1996, Wiese and Fuhr 2007, Haris and Kramida 2017 | 5.12 | 2026-10-15 |
| hk2017 | K. Haris and A. Kramida, Critically evaluated spectral data for neutral carbon (C I), Astrophys. J. Suppl. Ser. 233, 16 (2017), DOI 10.3847/1538-4365/aa86ab, read as arXiv:1704.07474 | arXiv PDF | 2026-10-15 |
| hk5s | K. Haris and A. Kramida, Radiative rates of transitions from the $2s2p^3\,{}^5S^o_2$ level of neutral carbon, arXiv:1705.09397 | arXiv PDF | 2026-10-15 |
| mchf | NIST MCHF/MCDHF Collection (C. Froese Fischer, G. Tachiev), C I energy levels and lifetimes, Breit-Pauli, https://nlte.nist.gov/MCHF/Elements/C/C_6.4.LT-lev.lt.db | version 2, last update 2010-09-15 | 2026-10-15 |
| bunge1993 | C. F. Bunge, J. A. Barrientos and A. V. Bunge, Roothaan-Hartree-Fock ground-state atomic wave functions, At. Data Nucl. Data Tables 53, 113-162 (1993), as the ASCII file RHF.TABLES, mirrored at https://ccl.net/cca/data/atomic-RHF-wavefunctions/tables | RHF.TABLES announced 1993-09-13 | 2026-10-15 |
| cie1931 | CIE (2019), Colour-matching functions of CIE 1931 standard colorimetric observer, 1 nm data table from CIE 018:2019 Table 6, DOI 10.25039/CIE.DS.xvudnb9b, https://files.cie.co.at/Publications-datasets/CIE_xyz_1931_2deg.csv | md5 17cca777db64b17170f06f67ce9d3ab7, as published | 2026-10-15 |
| css4 | W3C, CSS Color Module Level 4, section 19, `XYZ_to_lin_sRGB` and `gam_sRGB`, https://www.w3.org/TR/css-color-4/ | Candidate Recommendation Draft, 2026-10-09 | 2026-10-15 |
| codata | 2022 CODATA recommended values, NIST, https://physics.nist.gov/cuu/Constants: Boltzmann constant in inverse meter per kelvin $69.50348004\ \mathrm{m^{-1}K^{-1}}$ (exact), Bohr radius $5.29177210544(82)\times10^{-11}$ m | 2022 | 2026-10-15 |

The NIST transition-probability references the lines cite, from NIST's
bibliography pages:

| code | reference |
| --- | --- |
| T7851 | C. Froese Fischer, Some improved transition probabilities for neutral carbon, J. Phys. B 39, 2159 (2006) |
| T6070 | A. Hibbert, E. Biemont, M. Godefroid and N. Vaeck, Accurate f values of astrophysical interest for neutral carbon, Astron. Astrophys. Suppl. Ser. 99, 179 (1993) |
| T5520 | D. Luo and A. K. Pradhan, Atomic data for opacity calculations XI, the carbon isoelectronic sequence, J. Phys. B 22, 3377 (1989) |
| T9787 | Haris and Kramida 2017 (hk2017) |
| T7333 | G. Tachiev and C. Froese Fischer, Breit-Pauli energy levels and transition rates for the carbonlike sequence, Can. J. Phys. 79, 955 (2001) |
| T4828 | H. Nussbaumer and P. J. Storey, Bound-bound radiative transitions in C I, Astron. Astrophys. 140, 383 (1984) |
| L20057 | Haris and Kramida 2017, the source of every level energy used |
| L3172 | A. Beckmann, K. D. Boklen, G. Bremer and D. Elke, $g_J$ factors of ${}^{12}$C in ${}^3P_1$ and ${}^3P_2$, Z. Phys. A 272, 143 (1975) |

The exact query URLs of the four NIST exports are in `SOURCES` in
`scripts/research/carbon_data.py` and in the data file's `sources`.

## 2. Levels

### 2.1 Ionization energy

Haris and Kramida (2017, section 7) give the ionization energy of C I as
$90\,820.348(9)\ \mathrm{cm^{-1}}$, $11.2602880(11)$ eV, from a four-term
modified Ritz fit to the $2pnp\,{}^3D_3$ series ($n = 3$ to 10 and 40 to
69). NIST ASD lists the same value as the limit
$\mathrm{C\,II}\ (2s^2 2p\ {}^2P^o_{1/2})$, and the second limit
${}^2P^o_{3/2}$ at $90\,883.743(9)\ \mathrm{cm^{-1}}$, $11.2681480(11)$ eV.
Their earlier recommended value, $90\,820.42(10)$ (Johansson 1966), lies
within $0.08\ \mathrm{cm^{-1}}$. The Rydberg constant for carbon they use,
$R_\mathrm{C} = 109\,732.303\ \mathrm{cm^{-1}}$, is the one used here.

### 2.2 Which levels, and why

The mode needs a cascade that is real: an excited level must decay only
to levels the mode holds, with the probabilities NIST gives. The test of
a candidate set is its coverage, for each upper level the share of its
NIST-listed decay rate that ends on a level in the set.

1. Ground configuration and metastables: $2s^2 2p^2\ {}^3P_{0,1,2},
   {}^1D_2, {}^1S_0$ and $2s2p^3\ {}^5S^o_2$. Every cascade ends here.
2. $2p3s$, $2s2p^3\,{}^3D^o$, $2p3p$ and $2s2p^3\,{}^3P^o$: coverage 1.
   But they give no visible light of note. $2p3s \to 2p^2$ lies at 161 to
   258 nm (VUV and UV), $2s2p^3\,{}^3D^o \to 2p^2$ at 156 nm, and the
   $2p3p \to 2p3s$ lines carrying any share of a decay at 834 to 1454 nm
   (infrared). Their one visible line, 734 nm, is an intercombination
   line of grade E with a branch under $2\times10^{-4}$.
3. Adding $2p4p$, whose $\to 2p3s$ lines are the blue and green ones:
   coverage of the $2p4p$ levels falls to 0.08 to 0.44, because they decay
   mostly into $2p4s$ and $2p3d$ (in the infrared, 2.4 to 8.1 $\mu$m).
   Adding all of $2p4s$ and $2p3d$ restores coverage 1.
4. Adding $2p4d$ and $2p5s$ gives the red lines (659 to 769 nm) and keeps
   coverage 1, save $2p4d\,{}^1F^o_3$, whose NIST-listed decays to $2p4f$
   carry $3\times10^{-9}$ of its rate.
5. The $2p4f$ levels (83 920 to 84 036 $\mathrm{cm^{-1}}$) are left out.
   NIST labels them in $jK$ coupling, $2p({}^2P^o_{1/2,3/2})4f\ [K]_J$,
   because LS coupling fails for them (section 7), they add no new colour
   (their visible lines, 501 to 504 nm, sit beside the 505 nm green), and
   no chosen level decays into them by more than $3\times10^{-9}$.
6. Nothing higher: above $2p4d$ the levels crowd toward the limit. The
   $2pnp\,{}^3D_3$ and $2pnd\,{}^3F^o_4$ series go in the data file to
   draw as the converging ladder, with no rates (section 2.4).

The result: 68 levels in 36 terms, every C I level below
$84\,122\ \mathrm{cm^{-1}}$ except $2p4f$. The check (section 5) finds
the minimum coverage 0.9999999971 and every level reaching
$2p^2\,{}^3P_0$ by listed decays.

The Grotrian diagram should draw terms, not levels: the fine structure
of a term spans at most $60\ \mathrm{cm^{-1}}$ ($2p3s\,{}^3P^o$) against
the $84\,000\ \mathrm{cm^{-1}}$ of the diagram, under one part in a
thousand of its height. The ground term's $43\ \mathrm{cm^{-1}}$ is the
one fine structure the owner may want shown, as an inset (section 10).

### 2.3 The levels

From NIST ASD 5.12 (source asd, references L20057, L3172). The energy and
its uncertainty are NIST's strings. NIST gives the uncertainty of
$2p3p\,{}^3P_2$ as `0.00000`, recorded as given. "Leading %" is the
percentage of the level's eigenvector in its own LS term, and the second
component its next largest, from NIST's leading percentages. $\tau$ is
$1/\sum A$ over the selected lines (section 4), and the MCHF lifetime is
the Breit-Pauli value of source mchf where it exists. Level ids are the
data file's: configuration without closed shells, term with `o` for odd
parity, $J$.

| id | configuration, term | $J$ | $E$ ($\mathrm{cm}^{-1}$) | unc. | $E$ (eV) | unc. (eV) | leading % | second component % | $\tau = 1/\sum A$ | $\tau$ MCHF |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2p2_3P_0 | 2s2.2p2 3P | 0 | 0.0000000 | 0.0013 | 0.0000000000 | 0.00000016 | 98 |  | - | - |
| 2p2_3P_1 | 2s2.2p2 3P | 1 | 16.4167130 | 0.0013 | 0.0020354130 | 0.00000016 | 98 |  | 146 d | 148 d |
| 2p2_3P_2 | 2s2.2p2 3P | 2 | 43.4134567 | 0.0013 | 0.0053825826 | 0.00000016 | 98 |  | 43.7 d | 45.1 d |
| 2p2_1D_2 | 2s2.2p2 1D | 2 | 10192.657 | 0.003 | 1.2637284 | 0.0000004 | 98 |  | 3.41e+03 s | 3.42e+03 s |
| 2p2_1S_0 | 2s2.2p2 1S | 0 | 21648.030 | 0.003 | 2.6840136 | 0.0000004 | 94 | 4 2p4 1S | 1.66 s | 430 s |
| 2s2p3_5So_2 | 2s.2p3 5So | 2 | 33735.121 | 0.018 | 4.1826219 | 0.0000022 | 100 |  | 33.3 ms | 34.4 ms |
| 2p3s_3Po_0 | 2s2.2p.3s 3Po | 0 | 60333.4476 | 0.0005 | 7.48039414 | 0.00000006 | 96 |  | 2.88 ns | 2.78 ns |
| 2p3s_3Po_1 | 2s2.2p.3s 3Po | 1 | 60352.6584 | 0.0003 | 7.48277598 | 0.00000004 | 96 |  | 2.88 ns | 2.77 ns |
| 2p3s_3Po_2 | 2s2.2p.3s 3Po | 2 | 60393.1693 | 0.0004 | 7.48779869 | 0.00000005 | 96 |  | 2.87 ns | 2.77 ns |
| 2p3s_1Po_1 | 2s2.2p.3s 1Po | 1 | 61981.83211 | 0.0004 | 7.68476777 | 0.00000005 | 97 |  | 2.72 ns | 2.67 ns |
| 2s2p3_3Do_3 | 2s.2p3 3Do | 3 | 64086.96961 | 0.00010 | 7.945771557 | 0.000000012 | 96 |  | 8.55 ns | 7.88 ns |
| 2s2p3_3Do_1 | 2s.2p3 3Do | 1 | 64089.8990 | 0.0006 | 7.94613476 | 0.00000007 | 96 |  | 8.51 ns | 7.86 ns |
| 2s2p3_3Do_2 | 2s.2p3 3Do | 2 | 64090.99351 | 0.0003 | 7.94627046 | 0.00000004 | 96 |  | 8.53 ns | 7.87 ns |
| 2p3p_1P_1 | 2s2.2p.3p 1P | 1 | 68856.35208 | 0.0004 | 8.53709962 | 0.00000005 | 97 |  | 116 ns | - |
| 2p3p_3D_1 | 2s2.2p.3p 3D | 1 | 69689.49393 | 0.00022 | 8.64039604 | 0.00000003 | 98 |  | 54.3 ns | - |
| 2p3p_3D_2 | 2s2.2p.3p 3D | 2 | 69710.68728 | 0.00018 | 8.643023685 | 0.000000022 | 98 |  | 54.2 ns | - |
| 2p3p_3D_3 | 2s2.2p.3p 3D | 3 | 69744.05213 | 0.00014 | 8.647160399 | 0.000000017 | 98 |  | 54.2 ns | - |
| 2p3p_3S_1 | 2s2.2p.3p 3S | 1 | 70743.97227 | 0.00013 | 8.771134696 | 0.000000016 | 99 |  | 41.3 ns | - |
| 2p3p_3P_0 | 2s2.2p.3p 3P | 0 | 71352.54344 | 0.00025 | 8.84658790 | 0.00000003 | 98 |  | 32.9 ns | - |
| 2p3p_3P_1 | 2s2.2p.3p 3P | 1 | 71364.93596 | 0.00019 | 8.848124381 | 0.000000024 | 98 |  | 32.8 ns | - |
| 2p3p_3P_2 | 2s2.2p.3p 3P | 2 | 71385.40992 | 0.00000 | 8.850662829 | 0.000000000 | 98 |  | 32.8 ns | - |
| 2p3p_1D_2 | 2s2.2p.3p 1D | 2 | 72610.73530 | 0.00021 | 9.00258381 | 0.00000003 | 96 |  | 34.4 ns | - |
| 2p3p_1S_0 | 2s2.2p.3p 1S | 0 | 73975.92785 | 0.0003 | 9.17184612 | 0.00000004 | 88 | 9 2s2.2p.4p 1S | 28.5 ns | - |
| 2s2p3_3Po_1 | 2s.2p3 3Po | 1 | 75254.0017 | 0.0003 | 9.33030708 | 0.00000004 | 79 | 15 2s2.2p.3d 3Po | 4.5 ns | 3.49 ns |
| 2s2p3_3Po_2 | 2s.2p3 3Po | 2 | 75255.29373 | 0.00013 | 9.330467271 | 0.000000016 | 79 | 15 2s2.2p.3d 3Po | 4.56 ns | 3.5 ns |
| 2s2p3_3Po_0 | 2s.2p3 3Po | 0 | 75256.1696 | 0.0003 | 9.33057587 | 0.00000004 | 79 | 15 2s2.2p.3d 3Po | 4.48 ns | 3.48 ns |
| 2p3d_1Do_2 | 2s2.2p.3d 1Do | 2 | 77679.83311 | 0.00019 | 9.631071843 | 0.000000024 | 98 |  | 17.4 ns | - |
| 2p4s_3Po_0 | 2s2.2p.4s 3Po | 0 | 78105.00058 | 0.0003 | 9.68378589 | 0.00000004 | 93 | 7 2s2.2p.3d 3Po | 9.3 ns | - |
| 2p4s_3Po_1 | 2s2.2p.4s 3Po | 1 | 78116.77336 | 0.00014 | 9.685245529 | 0.000000017 | 92 | 7 2s2.2p.3d 3Po | 9.05 ns | - |
| 2p4s_3Po_2 | 2s2.2p.4s 3Po | 2 | 78148.10824 | 0.00012 | 9.689130559 | 0.000000015 | 92 | 8 2s2.2p.3d 3Po | 8.48 ns | - |
| 2p3d_3Fo_2 | 2s2.2p.3d 3Fo | 2 | 78199.09144 | 0.00021 | 9.69545167 | 0.00000003 | 86 | 13 2s2.2p.3d 3Do | 30.9 ns | - |
| 2p3d_3Fo_3 | 2s2.2p.3d 3Fo | 3 | 78215.54012 | 0.00017 | 9.697491047 | 0.000000021 | 76 | 22 2s2.2p.3d 3Do | 26.2 ns | - |
| 2p3d_3Fo_4 | 2s2.2p.3d 3Fo | 4 | 78249.96676 | 0.00014 | 9.701759406 | 0.000000017 | 100 |  | 38.5 ns | - |
| 2p3d_3Do_1 | 2s2.2p.3d 3Do | 1 | 78293.51263 | 0.00024 | 9.70715841 | 0.00000003 | 97 |  | 4.07 ns | - |
| 2p3d_3Do_2 | 2s2.2p.3d 3Do | 2 | 78307.64625 | 0.00017 | 9.708910751 | 0.000000021 | 84 | 14 2s2.2p.3d 3Fo | 3.96 ns | - |
| 2p3d_3Do_3 | 2s2.2p.3d 3Do | 3 | 78318.26602 | 0.00009 | 9.710227435 | 0.000000011 | 75 | 23 2s2.2p.3d 3Fo | 4.03 ns | - |
| 2p4s_1Po_1 | 2s2.2p.4s 1Po | 1 | 78340.29782 | 0.00023 | 9.71295903 | 0.00000003 | 80 | 18 2s2.2p.3d 1Po | 11.6 ns | - |
| 2p3d_1Fo_3 | 2s2.2p.3d 1Fo | 3 | 78529.64651 | 0.00022 | 9.73643528 | 0.00000003 | 99 |  | 5.19 ns | - |
| 2p3d_1Po_1 | 2s2.2p.3d 1Po | 1 | 78731.2956 | 0.0004 | 9.76143658 | 0.00000005 | 81 | 18 2s2.2p.4s 1Po | 6.16 ns | - |
| 2p3d_3Po_2 | 2s2.2p.3d 3Po | 2 | 79310.86822 | 0.00009 | 9.833294423 | 0.000000011 | 77 | 15 2s.2p3 3Po | 5.24 ns | - |
| 2p3d_3Po_1 | 2s2.2p.3d 3Po | 1 | 79318.8093 | 0.0003 | 9.83427899 | 0.00000004 | 77 | 15 2s.2p3 3Po | 5.12 ns | - |
| 2p3d_3Po_0 | 2s2.2p.3d 3Po | 0 | 79323.1883 | 0.0005 | 9.83482192 | 0.00000006 | 78 | 15 2s.2p3 3Po | 5.07 ns | - |
| 2p4p_1P_1 | 2s2.2p.4p 1P | 1 | 80562.88550 | 0.00021 | 9.98852478 | 0.00000003 | 96 |  | 227 ns | - |
| 2p4p_3D_1 | 2s2.2p.4p 3D | 1 | 80782.44916 | 0.00021 | 10.01574721 | 0.00000003 | 97 |  | 243 ns | - |
| 2p4p_3D_2 | 2s2.2p.4p 3D | 2 | 80801.28887 | 0.00015 | 10.018083033 | 0.000000019 | 98 |  | 241 ns | - |
| 2p4p_3D_3 | 2s2.2p.4p 3D | 3 | 80834.62491 | 0.00013 | 10.022216175 | 0.000000016 | 98 |  | 243 ns | - |
| 2p4p_3S_1 | 2s2.2p.4p 3S | 1 | 81105.06418 | 0.00014 | 10.055746371 | 0.000000017 | 89 | 9 2s2.2p.4p 3P | 206 ns | - |
| 2p4p_3P_0 | 2s2.2p.4p 3P | 0 | 81311.0544 | 0.0003 | 10.08128590 | 0.00000004 | 98 |  | 143 ns | - |
| 2p4p_3P_1 | 2s2.2p.4p 3P | 1 | 81325.81077 | 0.00020 | 10.083115460 | 0.000000025 | 89 | 9 2s2.2p.4p 3S | 144 ns | - |
| 2p4p_3P_2 | 2s2.2p.4p 3P | 2 | 81344.05485 | 0.00011 | 10.085377438 | 0.000000014 | 98 |  | 141 ns | - |
| 2p4p_1D_2 | 2s2.2p.4p 1D | 2 | 81769.87089 | 0.00024 | 10.13817190 | 0.00000003 | 93 | 4 2s2.2p.5p 1D | 112 ns | - |
| 2p4p_1S_0 | 2s2.2p.4p 1S | 0 | 82251.82041 | 0.0003 | 10.19792602 | 0.00000004 | 79 | 13 2s2.2p.5p 1S | 73.5 ns | - |
| 2p4d_1Do_2 | 2s2.2p.4d 1Do | 2 | 83497.58690 | 0.0003 | 10.35238138 | 0.00000004 | 97 |  | 47.5 ns | - |
| 2p5s_3Po_0 | 2s2.2p.5s 3Po | 0 | 83740.0964 | 0.0010 | 10.38244873 | 0.00000012 | 94 | 6 2s2.2p.4d 3Po | 17.9 ns | - |
| 2p4d_3Fo_2 | 2s2.2p.4d 3Fo | 2 | 83747.43248 | 0.0003 | 10.38335829 | 0.00000004 | 86 | 13 2s2.2p.4d 3Do | 89.4 ns | - |
| 2p5s_3Po_1 | 2s2.2p.5s 3Po | 1 | 83752.4388 | 0.0006 | 10.38397899 | 0.00000007 | 89 | 6 2s2.2p.4d 3Po | 17.3 ns | - |
| 2p4d_3Fo_3 | 2s2.2p.4d 3Fo | 3 | 83761.27417 | 0.00018 | 10.385074438 | 0.000000022 | 78 | 19 2s2.2p.4d 3Do | 64 ns | - |
| 2p5s_3Po_2 | 2s2.2p.5s 3Po | 2 | 83791.0880 | 0.0005 | 10.38877088 | 0.00000006 | 74 | 11 2s2.2p.4d 3Do | 15 ns | - |
| 2p4d_3Fo_4 | 2s2.2p.4d 3Fo | 4 | 83798.61582 | 0.00016 | 10.389704212 | 0.000000020 | 100 |  | 146 ns | - |
| 2p4d_3Do_1 | 2s2.2p.4d 3Do | 1 | 83820.1576 | 0.0008 | 10.39237505 | 0.00000010 | 94 | 4 2s2.2p.4d 1Po | 8.67 ns | - |
| 2p4d_3Do_2 | 2s2.2p.4d 3Do | 2 | 83838.0728 | 0.0004 | 10.39459625 | 0.00000005 | 75 | 16 2s2.2p.5s 3Po | 8.44 ns | - |
| 2p4d_3Do_3 | 2s2.2p.4d 3Do | 3 | 83848.8700 | 0.0003 | 10.39593494 | 0.00000004 | 80 | 20 2s2.2p.4d 3Fo | 8.57 ns | - |
| 2p5s_1Po_1 | 2s2.2p.5s 1Po | 1 | 83877.305 | 0.006 | 10.3994604 | 0.0000007 | 65 | 28 2s2.2p.4d 1Po | 27.2 ns | - |
| 2p4d_1Fo_3 | 2s2.2p.4d 1Fo | 3 | 83947.2231 | 0.0004 | 10.40812917 | 0.00000005 | 97 |  | 9.14 ns | - |
| 2p4d_1Po_1 | 2s2.2p.4d 1Po | 1 | 84032.1471 | 0.0007 | 10.41865840 | 0.00000009 | 67 | 30 2s2.2p.5s 1Po | 11.5 ns | - |
| 2p4d_3Po_2 | 2s2.2p.4d 3Po | 2 | 84103.1238 | 0.0004 | 10.42745839 | 0.00000005 | 87 | 9 2s2.2p.5s 3Po | 14.1 ns | - |
| 2p4d_3Po_1 | 2s2.2p.4d 3Po | 1 | 84116.1152 | 0.0005 | 10.42906912 | 0.00000006 | 89 | 6 2s2.2p.5s 3Po | 13 ns | - |
| 2p4d_3Po_0 | 2s2.2p.4d 3Po | 0 | 84121.2260 | 0.0018 | 10.42970278 | 0.00000022 | 91 | 6 2s2.2p.5s 3Po | 12.7 ns | - |

### 2.4 Rydberg series, to draw only

The two series Haris and Kramida fitted for the limit. $n^* =
\sqrt{R_\mathrm{C}/(E_\infty - E)}$ with $E_\infty$ the
${}^2P^o_{3/2}$ limit, $\delta = n - n^*$. For $n \geq 8$ NIST labels the
$np$ level $2p({}^2P^o_{3/2})np\ [5/2]_3$, the same state in $jK$
notation, 98 to 99 % pure. The near-constant $\delta$ is the mark of a
Rydberg series and makes the ladder's convergence drawable from
$E_n = E_\infty - R_\mathrm{C}/(n-\delta)^2$.

| series | $n$ | NIST label | $E$ ($\mathrm{cm}^{-1}$) | unc. | $n^*$ | $\delta$ |
| --- | --- | --- | --- | --- | --- | --- |
| 2pnp 3D3 | 3 | 2s2.2p.3p 3D 3 | 69744.05213 | 0.00014 | 2.27834 | 0.72166 |
| 2pnp 3D3 | 4 | 2s2.2p.4p 3D 3 | 80834.62491 | 0.00013 | 3.30448 | 0.69552 |
| 2pnp 3D3 | 5 | 2s2.2p.5p 3D 3 | 84985.0033 | 0.002 | 4.31308 | 0.68692 |
| 2pnp 3D3 | 6 | 2s2.2p.6p 3D 3 | 87002.31 | 0.03 | 5.31706 | 0.68294 |
| 2pnp 3D3 | 7 | 2s2.2p.7p 3D 3 | 88135.84 | 0.04 | 6.31926 | 0.68074 |
| 2pnp 3D3 | 8 | 2s2.2p.(2P*<3/2>).8p 2[5/2] 3 | 88836.15 | 0.04 | 7.32058 | 0.67942 |
| 2pnp 3D3 | 9 | 2s2.2p.(2P*<3/2>).9p 2[5/2] 3 | 89299.13 | 0.04 | 8.32158 | 0.67842 |
| 2pnp 3D3 | 10 | 2s2.2p.(2P*<3/2>).10p 2[5/2] 3 | 89621.09 | 0.04 | 9.32235 | 0.67765 |
| 2pnd 3Fo4 | 3 | 2s2.2p.3d 3Fo 4 | 78249.96676 | 0.00014 | 2.94714 | 0.05286 |
| 2pnd 3Fo4 | 4 | 2s2.2p.4d 3Fo 4 | 83798.61582 | 0.00016 | 3.93544 | 0.06456 |
| 2pnd 3Fo4 | 5 | 2s2.2p.5d 3Fo 4 | 86369.385 | 0.005 | 4.93025 | 0.06975 |
| 2pnd 3Fo4 | 6 | 2s2.2p.6d 3Fo 4 | 87760.63 | 0.05 | 5.92753 | 0.07247 |

## 3. Transitions

### 3.1 What NIST gives

For each line: the Ritz wavelength (from the optimized levels) and the
observed wavelength where one was measured, each with its uncertainty,
the wavenumber, the Einstein coefficient $A_{ki}$ in $\mathrm{s^{-1}}$,
the absorption oscillator strength $f_{ik}$, the line strength $S$, an
accuracy grade, the type (blank for E1, else M1 or E2), and the
references. Wavelengths are in vacuum below 200 nm and above 2000 nm, and
in standard air between, by NIST's convention on the wavenumber $\sigma$:
vacuum for $\sigma \geq 50\,000\ \mathrm{cm^{-1}}$ or $\sigma \leq
5000\ \mathrm{cm^{-1}}$, air between. NIST computes air from vacuum with
the refractive index of E. R. Peck and K. Reeder, J. Opt. Soc. Am. 62,
958 (1972). The data file carries both for every line in the air range.

NIST's accuracy grades bound the relative uncertainty of $A$ (NIST lines
help page, and Haris and Kramida Table 10):

| grade | AAA | AA | A+ | A | B+ | B | C+ | C | D+ | D | E |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| uncertainty of $A$ | 0.3 % | 1 % | 2 % | 3 % | 7 % | 10 % | 18 % | 25 % | 40 % | 50 % | over 50 % |

The 559 selected lines by grade: A 28, B+ 28, B 209, C+ 52, C 179, D+ 4,
D 49, E 10. Some `tp_ref` codes carry the suffixes `n` or `LS`
(`T6070n`, `T5520LS`). The help page read here does not define them.
From the grade note that a multiplet "separated into its component lines
... assuming pure LS coupling" is marked, `LS` likely means that, but
this is not confirmed (section 10).

### 3.2 The cascade by terms

How each upper term decays, averaged over its $J$ levels with weights
$g_J = 2J + 1$, for shares of 5 % or more. Wavelengths in air where NIST
gives air, else vacuum. The data file has every line by $J$.

| upper term | lower term | share of decays | wavelength (nm) | band | type | grades |
| --- | --- | --- | --- | --- | --- | --- |
| 2p2_3P | 2p2_3P | 1.000 | 2.303e+05 - 6.091e+05 | IR | E2/M1 | A |
| 2p2_1D | 2p2_3P | 1.000 | 980.8 - 985 | IR | E2/M1 | C+ |
| 2p2_1S | 2p2_1D | 0.996 | 872.7 | IR | E2 | B |
| 2s2p3_5So | 2p2_3P | 1.000 | 296.5 - 296.7 | UV | E1 | D |
| 2p3s_3Po | 2p2_3P | 1.000 | 165.6 - 165.8 | VUV | E1 | A |
| 2p3s_1Po | 2p2_1D | 0.923 | 193.1 | VUV | E1 | A |
| 2p3s_1Po | 2p2_1S | 0.076 | 247.9 | UV | E1 | C+ |
| 2s2p3_3Do | 2p2_3P | 1.000 | 156 - 156.1 | VUV | E1 | A |
| 2p3p_1P | 2p3s_1Po | 0.997 | 1454 | IR | E1 | B |
| 2p3p_3D | 2p3s_3Po | 0.998 | 1068 - 1075 | IR | E1 | B |
| 2p3p_3S | 2p3s_3Po | 1.000 | 960.3 - 965.8 | IR | E1 | B |
| 2p3p_3P | 2p3s_3Po | 0.987 | 906.1 - 911.2 | IR | E1 | B |
| 2p3p_1D | 2p3s_1Po | 1.000 | 940.6 | IR | E1 | B+ |
| 2p3p_1S | 2p3s_1Po | 1.000 | 833.5 | IR | E1 | B+ |
| 2s2p3_3Po | 2p2_3P | 0.994 | 132.9 - 133 | VUV | E1 | B |
| 2p3d_1Do | 2p2_1D | 0.610 | 148.2 | VUV | E1 | B |
| 2p3d_1Do | 2p3p_1P | 0.354 | 1133 | IR | E1 | B |
| 2p4s_3Po | 2p2_3P | 0.826 | 128 - 128.1 | VUV | E1 | B+ |
| 2p4s_3Po | 2p3p_3D | 0.100 | 1182 - 1190 | IR | E1 | B |
| 2p4s_3Po | 2p3p_3S | 0.058 | 1350 - 1358 | IR | E1 | C+ |
| 2p3d_3Fo | 2p3p_3D | 0.839 | 1175 - 1182 | IR | E1 | B |
| 2p3d_3Fo | 2p2_3P | 0.142 | 127.9 | VUV | E1 | D |
| 2p3d_3Do | 2p2_3P | 0.918 | 127.7 - 127.8 | VUV | E1 | A B+ |
| 2p3d_3Do | 2p3p_3P | 0.050 | 1440 - 1447 | IR | E1 | B |
| 2p4s_1Po | 2p2_1D | 0.638 | 146.7 | VUV | E1 | A |
| 2p4s_1Po | 2p2_3P | 0.188 | 127.6 - 127.7 | VUV | E1 | C+ |
| 2p4s_1Po | 2p3p_1D | 0.087 | 1745 | IR | E1 | B+ |
| 2p3d_1Fo | 2p2_1D | 0.928 | 146.3 | VUV | E1 | B+ |
| 2p3d_1Fo | 2p3p_1D | 0.064 | 1689 | IR | E1 | B |
| 2p3d_1Po | 2p2_1S | 0.517 | 175.2 | VUV | E1 | B+ |
| 2p3d_1Po | 2p2_1D | 0.339 | 145.9 | VUV | E1 | B |
| 2p3d_1Po | 2p3p_1P | 0.123 | 1012 | IR | E1 | C+ |
| 2p3d_3Po | 2p2_3P | 0.891 | 126.1 - 126.2 | VUV | E1 | B |
| 2p3d_3Po | 2p3p_3P | 0.063 | 1255 - 1261 | IR | E1 | B |
| 2p4p_1P | 2p3s_1Po | 0.422 | 538 | visible | E1 | B |
| 2p4p_1P | 2p3d_1Do | 0.268 | 3469 | IR | E1 | B |
| 2p4p_1P | 2p4s_1Po | 0.168 | 4499 | IR | E1 | C+ |
| 2p4p_1P | 2p3d_1Po | 0.123 | 5460 | IR | E1 | C+ |
| 2p4p_3D | 2p4s_3Po | 0.480 | 3722 - 3796 | IR | E1 | B |
| 2p4p_3D | 2p3d_3Fo | 0.280 | 3794 - 3871 | IR | E1 | B |
| 2p4p_3D | 2s2p3_3Po | 0.176 | 1792 - 1809 | IR | E1 | D |
| 2p4p_3D | 2p3d_3Do | 0.051 | 3957 - 4041 | IR | E1 | B |
| 2p4p_3S | 2p4s_3Po | 0.875 | 3333 - 3382 | IR | E1 | B |
| 2p4p_3P | 2p4s_3Po | 0.303 | 3099 - 3147 | IR | E1 | B |
| 2p4p_3P | 2p3d_3Do | 0.200 | 3278 - 3314 | IR | E1 | B |
| 2p4p_3P | 2s2p3_3Po | 0.181 | 1642 - 1651 | IR | E1 | D |
| 2p4p_3P | 2p3s_3Po | 0.152 | 476.2 - 477.6 | visible | E1 | C |
| 2p4p_3P | 2p3d_3Po | 0.087 | 4918 - 5019 | IR | E1 | B |
| 2p4p_3P | 2s2p3_3Do | 0.058 | 579.3 - 580.5 | visible | E1 | B C+ |
| 2p4p_1D | 2p4s_1Po | 0.403 | 2916 | IR | E1 | B |
| 2p4p_1D | 2p3s_1Po | 0.291 | 505.2 | visible | E1 | B |
| 2p4p_1D | 2p3d_1Fo | 0.196 | 3086 | IR | E1 | B |
| 2p4p_1S | 2p4s_1Po | 0.515 | 2557 | IR | E1 | B |
| 2p4p_1S | 2p3s_1Po | 0.441 | 493.2 | visible | E1 | B |
| 2p4d_1Do | 2p2_1D | 0.760 | 136.4 | VUV | E1 | C |
| 2p4d_1Do | 2p4p_1P | 0.152 | 3408 | IR | E1 | B |
| 2p5s_3Po | 2p2_3P | 0.810 | 119.4 - 119.5 | VUV | E1 | A B+ |
| 2p5s_3Po | 2p3p_3D | 0.068 | 708.9 - 712 | visible | E1 | B |
| 2p4d_3Fo | 2p4p_3D | 0.455 | 3373 - 3433 | IR | E1 | B |
| 2p4d_3Fo | 2p3p_3D | 0.254 | 711.1 - 713.9 | visible | E1 | B |
| 2p4d_3Fo | 2p2_3P | 0.240 | 119.4 | VUV | E1 | B+ |
| 2p4d_3Do | 2p2_3P | 0.953 | 119.3 - 119.4 | VUV | E1 | B+ |
| 2p5s_1Po | 2p2_1D | 0.381 | 135.7 | VUV | E1 | C |
| 2p5s_1Po | 2p2_3P | 0.326 | 119.2 - 119.3 | VUV | E1 | B C |
| 2p5s_1Po | 2p2_1S | 0.144 | 160.7 | VUV | E1 | C |
| 2p5s_1Po | 2p3p_1D | 0.056 | 887.3 | IR | E1 | B |
| 2p4d_1Fo | 2p2_1D | 0.951 | 135.6 | VUV | E1 | B |
| 2p4d_1Po | 2p2_1S | 0.519 | 160.3 | VUV | E1 | B |
| 2p4d_1Po | 2p2_1D | 0.346 | 135.4 | VUV | E1 | C |
| 2p4d_1Po | 2p3p_1P | 0.059 | 658.8 | visible | E1 | B |
| 2p4d_3Po | 2p2_3P | 0.903 | 118.9 - 119 | VUV | E1 | B |

### 3.3 Forbidden and intercombination lines

The forbidden lines (M1, E2) are all within $2s^2 2p^2$, with the two
intercombination lines of the metastable $2s2p^3\,{}^5S^o_2$:

| upper | lower | type | $\lambda_\mathrm{air}$ (nm) | $\lambda_\mathrm{vac}$ (nm) | $A$ ($\mathrm{s}^{-1}$) | grade | branch | source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2s2p3_5So_2 | 2p2_3P_1 | E1 | 296.48471 | 296.5713 | 9.e+00 | D | 0.3 | T7851 |
| 2s2p3_5So_2 | 2p2_3P_2 | E1 | 296.72229 | 296.80894 | 2.1e+01 | D | 0.7 | T7851 |
| 2p2_1S_0 | 2p2_3P_1 | M1 | 462.15693 | 462.28637 | 2.3e-03 | C+ | 0.00382 | T7851 |
| 2p2_1S_0 | 2p2_3P_2 | E2 | 462.73444 | 462.86404 | 2.2e-05 | C | 3.65e-05 | T7851 |
| 2p2_1S_0 | 2p2_1D_2 | E2 | 872.7131 | 872.9528 | 6.0e-01 | B | 0.996 | T7851 |
| 2p2_1D_2 | 2p2_3P_0 | E2 | 980.8295 | 981.0985 | 5.9e-08 | C | 0.000201 | T7851 |
| 2p2_1D_2 | 2p2_3P_1 | M1 | 982.4118 | 982.6812 | 7.3e-05 | C+ | 0.249 | T7851 |
| 2p2_1D_2 | 2p2_3P_2 | M1 | 985.025 | 985.2951 | 2.2e-04 | C+ | 0.751 | T7851 |
| 2p2_3P_2 | 2p2_3P_0 | E2 | - | 230343.326 | 1.72e-14 | B+ | 6.49e-08 | T7851 |
| 2p2_3P_2 | 2p2_3P_1 | M1 | - | 370415.044 | 2.65e-07 | A | 1 | T7851 |
| 2p2_3P_1 | 2p2_3P_0 | M1 | - | 609135.337 | 7.93e-08 | A | 1 | T7851 |

$2s2p^3\,{}^5S^o_2 \to 2p^2\,{}^1D_2$ at 424.8 nm appears in NIST without
an $A$ and is left out. The ${}^5S^o_2$ rates are calculations (Froese
Fischer 2006, grade D). Haris and Kramida (hk5s) find the two published
measurements in error, by factors of about 50 and 1400, and support the
calculated lifetime, 0.034 s.

E1 intercombination lines (spin change, allowed only through mixing):
159 of the 550 E1 lines, 18 of them carrying 1 % or more of their upper level's
decay. The strongest: $2p5s\,{}^1P^o_1 \to {}^3P_1$ (119.2 nm, 21 %),
$2p4d\,{}^3F^o_3 \to {}^1D_2$ (135.9 nm, 14 %), $2p4s\,{}^1P^o_1 \to
{}^3P_1$ (127.7 nm, 11 %). Each is flagged `intercombination` in the
data file.

### 3.4 Colour

A visible line's colour: the CIE 1931 2-degree colour-matching functions
$\bar x, \bar y, \bar z$ at the air wavelength, interpolated linearly
between the 1 nm rows of the CIE table, give $X, Y, Z$. CSS Color 4's
`XYZ_to_lin_sRGB` matrix gives linear sRGB. A pure spectral colour lies
outside the sRGB gamut, so negative channels are clipped to zero and the
largest channel scaled to 1 (this document's convention), then
`gam_sRGB` encodes it. The data file stores the result as `rgb` with
$\bar y$ as `cie_ybar`, the eye's sensitivity at that wavelength. The 711
nm red has $\bar y = 0.0019$: a real 711 nm photon looks dim against a
538 nm one ($\bar y = 0.94$). Drawing every photon at full brightness
overstates the reds, and drawing at $\bar y$ hides them (section 10).

The visible lines carrying 1 % or more of their upper level's decay:

| $\lambda_\mathrm{air}$ (nm) | $\lambda_\mathrm{vac}$ (nm) | upper | lower | $A$ ($\mathrm{s}^{-1}$) | grade | branch | sRGB | $\bar y$ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 476.230541 | 476.36371 | 2p4p_3P_1 | 2p3s_3Po_0 | 3.4e+05 | C | 0.049 | `#0067ff` | 0.1187 |
| 476.252473 | 476.385648 | 2p4p_3P_2 | 2p3s_3Po_1 | 2.7e+05 | C | 0.038 | `#0067ff` | 0.1188 |
| 476.66676 | 476.800045 | 2p4p_3P_1 | 2p3s_3Po_1 | 2.4e+05 | C | 0.035 | `#006aff` | 0.121 |
| 477.002376 | 477.13575 | 2p4p_3P_0 | 2p3s_3Po_1 | 1.1e+06 | C | 0.157 | `#006dff` | 0.1227 |
| 477.173374 | 477.306793 | 2p4p_3P_2 | 2p3s_3Po_2 | 8.0e+05 | C | 0.112 | `#006fff` | 0.1236 |
| 477.589266 | 477.722795 | 2p4p_3P_1 | 2p3s_3Po_2 | 4.8e+05 | C | 0.069 | `#0072ff` | 0.1258 |
| 481.737213 | 481.871842 | 2p4p_3S_1 | 2p3s_3Po_1 | 8.8e+04 | C | 0.018 | `#0096ff` | 0.1489 |
| 482.679468 | 482.814347 | 2p4p_3S_1 | 2p3s_3Po_2 | 6.3e+04 | C | 0.013 | `#009fff` | 0.1545 |
| 493.202524 | 493.340196 | 2p4p_1S_0 | 2p3s_1Po_1 | 6.0e+06 | B | 0.441 | `#00ffe9` | 0.239 |
| 505.214927 | 505.355792 | 2p4p_1D_2 | 2p3s_1Po_1 | 2.6e+06 | B | 0.291 | `#00ff75` | 0.4112 |
| 538.033014 | 538.18262 | 2p4p_1P_1 | 2p3s_1Po_1 | 1.86e+06 | B | 0.422 | `#00ff00` | 0.9402 |
| 579.311495 | 579.472133 | 2p4p_3P_2 | 2s2p3_3Do_3 | 3.4e+05 | B | 0.048 | `#ffb800` | 0.8767 |
| 580.023158 | 580.183986 | 2p4p_3P_1 | 2s2p3_3Do_1 | 1.04e+05 | C+ | 0.015 | `#ffb400` | 0.8698 |
| 580.059993 | 580.220831 | 2p4p_3P_1 | 2s2p3_3Do_2 | 3.0e+05 | B | 0.043 | `#ffb400` | 0.8694 |
| 580.52017 | 580.681131 | 2p4p_3P_0 | 2s2p3_3Do_1 | 4.1e+05 | C+ | 0.058 | `#ffb100` | 0.8647 |
| 658.76211 | 658.94406 | 2p4d_1Po_1 | 2p3p_1P_1 | 5.1e+06 | B | 0.059 | `#ff0000` | 0.06571 |
| 665.55294 | 665.73672 | 2p5s_1Po_1 | 2p3p_1P_1 | 5.0e+05 | C | 0.014 | `#ff0000` | 0.04302 |
| 682.814076 | 683.002501 | 2p4d_1Do_2 | 2p3p_1P_1 | 9.9e+05 | C | 0.047 | `#ff0000` | 0.014 |
| 710.011312 | 710.20706 | 2p5s_3Po_2 | 2p3p_3D_2 | 9.0e+05 | B | 0.014 | `#ff0000` | 0.002089 |
| 710.89263 | 711.08862 | 2p5s_3Po_1 | 2p3p_3D_1 | 1.12e+06 | B | 0.019 | `#ff0000` | 0.001968 |
| 711.145795 | 711.341849 | 2p4d_3Fo_2 | 2p3p_3D_1 | 2.17e+06 | B | 0.194 | `#ff0000` | 0.001935 |
| 711.31656 | 711.51266 | 2p4d_3Fo_4 | 2p3p_3D_3 | 2.47e+06 | B | 0.360 | `#ff0000` | 0.001913 |
| 711.5171 | 711.71325 | 2p5s_3Po_0 | 2p3p_3D_1 | 4.4e+06 | B | 0.079 | `#ff0000` | 0.001887 |
| 711.517889 | 711.714043 | 2p4d_3Fo_3 | 2p3p_3D_2 | 2.19e+06 | B | 0.140 | `#ff0000` | 0.001887 |
| 711.697758 | 711.893961 | 2p5s_3Po_2 | 2p3p_3D_3 | 3.3e+06 | B | 0.050 | `#ff0000` | 0.001864 |
| 711.96559 | 712.16187 | 2p5s_3Po_1 | 2p3p_3D_2 | 3.1e+06 | B | 0.054 | `#ff0000` | 0.001829 |
| 712.219524 | 712.415867 | 2p4d_3Fo_2 | 2p3p_3D_2 | 2.01e+05 | B | 0.018 | `#ff0000` | 0.001798 |
| 747.33178 | 747.53759 | 2p4d_3Po_0 | 2p3p_3S_1 | 1.08e+06 | C+ | 0.014 | `#ff0000` | 0.000145 |
| 747.61741 | 747.8233 | 2p4d_3Po_1 | 2p3p_3S_1 | 1.06e+06 | C+ | 0.014 | `#ff0000` | 0.000142 |
| 748.344451 | 748.550533 | 2p4d_3Po_2 | 2p3p_3S_1 | 1.01e+06 | C+ | 0.014 | `#ff0000` | 0.000135 |
| 766.242013 | 766.452924 | 2p5s_3Po_2 | 2p3p_3S_1 | 1.20e+06 | B | 0.018 | `#ff0000` | 3.9e-05 |
| 768.51859 | 768.73012 | 2p5s_3Po_1 | 2p3p_3S_1 | 1.14e+06 | B | 0.020 | `#ff0000` | 3.3e-05 |
| 769.24846 | 769.46018 | 2p5s_3Po_0 | 2p3p_3S_1 | 1.18e+06 | B | 0.021 | `#ff0000` | 3.2e-05 |

The other lines need a stated convention, as the issue asks. Proposed:
a line outside 380 to 780 nm is drawn white or grey, dashed, with its
band and wavelength printed (VUV and UV below, IR above), never in a
false colour that a viewer would read as a real one. The choice is the
owner's (section 10).

## 4. Lifetimes and branching

The radiative lifetime of a level is $\tau = 1/\sum_i A_{ki}$, summed
over its decays, and the branching ratio of one decay is $A_{ki}\,\tau$.
Both come from the selected lines. Because coverage is 1, these equal the
values over every decay NIST lists. A cascade that picks each next level
with probability $A_{ki}\,\tau$ follows NIST's probabilities exactly. Two
cautions:

- $\sum A$ counts only the decays NIST lists. A missing weak branch
  makes $\tau$ too long, never too short.
- A branching ratio is as good as the grades of the rates it divides:
  the table gives the weakest grade among each term's branches of 1 % or
  more.

The independent check is the MCHF collection's Breit-Pauli lifetimes,
which cover the levels up to $2s2p^3\,{}^3P^o$:

| term | $E$ ($\mathrm{cm}^{-1}$) | $\tau$ (NIST $1/\sum A$) | $\tau$ MCHF | weakest grade among branches of 1 % or more |
| --- | --- | --- | --- | --- |
| 2p2_3P | 0 | 43.7 d to 146 d | 45.1 d to 148 d | A |
| 2p2_1D | 10193 | 3.41e+03 s | 3.42e+03 s | C+ |
| 2p2_1S | 21648 | 1.66 s | 430 s | B |
| 2s2p3_5So | 33735 | 33.3 ms | 34.4 ms | D |
| 2p3s_3Po | 60333 | 2.87 ns to 2.88 ns | 2.77 ns to 2.78 ns | A |
| 2p3s_1Po | 61982 | 2.72 ns | 2.67 ns | C+ |
| 2s2p3_3Do | 64087 | 8.51 ns to 8.55 ns | 7.86 ns to 7.88 ns | A |
| 2p3p_1P | 68856 | 116 ns | - | B |
| 2p3p_3D | 69689 | 54.2 ns to 54.3 ns | - | B |
| 2p3p_3S | 70744 | 41.3 ns | - | B |
| 2p3p_3P | 71353 | 32.8 ns to 32.9 ns | - | B |
| 2p3p_1D | 72611 | 34.4 ns | - | B+ |
| 2p3p_1S | 73976 | 28.5 ns | - | B+ |
| 2s2p3_3Po | 75254 | 4.48 ns to 4.56 ns | 3.48 ns to 3.5 ns | B |
| 2p3d_1Do | 77680 | 17.4 ns | - | B |
| 2p4s_3Po | 78105 | 8.48 ns to 9.3 ns | - | C+ |
| 2p3d_3Fo | 78199 | 26.2 ns to 38.5 ns | - | D |
| 2p3d_3Do | 78294 | 3.96 ns to 4.07 ns | - | B |
| 2p4s_1Po | 78340 | 11.6 ns | - | C |
| 2p3d_1Fo | 78530 | 5.19 ns | - | B |
| 2p3d_1Po | 78731 | 6.16 ns | - | C+ |
| 2p3d_3Po | 79311 | 5.07 ns to 5.24 ns | - | B |
| 2p4p_1P | 80563 | 227 ns | - | C |
| 2p4p_3D | 80782 | 241 ns to 243 ns | - | D |
| 2p4p_3S | 81105 | 206 ns | - | D |
| 2p4p_3P | 81311 | 141 ns to 144 ns | - | D |
| 2p4p_1D | 81770 | 112 ns | - | D |
| 2p4p_1S | 82252 | 73.5 ns | - | C |
| 2p4d_1Do | 83498 | 47.5 ns | - | C |
| 2p5s_3Po | 83740 | 15 ns to 17.9 ns | - | C |
| 2p4d_3Fo | 83747 | 64 ns to 146 ns | - | C |
| 2p4d_3Do | 83820 | 8.44 ns to 8.67 ns | - | C |
| 2p5s_1Po | 83877 | 27.2 ns | - | C |
| 2p4d_1Fo | 83947 | 9.14 ns | - | C+ |
| 2p4d_1Po | 84032 | 11.5 ns | - | C |
| 2p4d_3Po | 84103 | 12.7 ns to 14.1 ns | - | C+ |

Where both exist they agree within 4 %, save:

- ${}^1S_0$: MCHF 430 s, NIST 1.66 s. Without the E2 decay to ${}^1D_2$
  ($A = 0.60\ \mathrm{s^{-1}}$, grade B, Froese Fischer 2006), the NIST
  rates give $1/\sum A = 430.7$ s. The MCHF table omits that E2 channel.
  NIST's value stands.
- $2s2p^3\,{}^3D^o$ (8 %) and $2s2p^3\,{}^3P^o$ (29 %): NIST's rates are
  Froese Fischer 2006 (T7851), the critically evaluated choice. The MCHF
  table is an earlier Breit-Pauli calculation whose paper the collection's
  failed reference page would name (section 11). $2s2p^3\,{}^3P^o$ is 79 % pure,
  mixed 15 % with $2p3d\,{}^3P^o$, which makes its rates sensitive to the
  calculation.

Measured lifetimes were sought and not obtained: Bergstrom, Hallstadius,
Lundberg and Persson, Chem. Phys. Lett. 155, 27 (1989), measured the
$2p3p\,{}^3P$ and ${}^3D$ lifetimes by two-photon laser excitation, but
its PDF returned a web page, not the paper (section 11).

## 5. Consistency checks

`python3 -I scripts/research/carbon_data.py check
docs/research/carbon-atom-data.json` reads the data file alone and checks
it. Its output at this commit:

```
levels 68, lines 559
1 order: 68 levels sorted by energy, unique ids, from 0 to 84121.2 cm^-1, all below the IE 90820.3
1 every line: E_upper > E_lower, g = 2J+1 on both ends, line energies equal level energies
2 Ritz vac: 559 lines, max |relative residual| 1.36e-07 (2p5s_1Po_1 -> 2p4p_1P_1 listed 3017.12, from levels 3017.1195891), max residual / max(unc, rounding) 0.16
2b obs - Ritz: 394 lines with both, 1 beyond 3 sigma of the observed uncertainty, worst 3.1 sigma (2s2p3_3Po_1 -> 2p3p_3D_1)
3 air: 242 lines, n - 1 from 3.0204e-04 at 247.9 nm to 2.7300e-04 at 1972.2 nm, non-increasing with wavelength within rounding
3 air convention: air given exactly for 5000 < sigma < 50000 cm^-1
4 f from A (NIST formula f = 1.49919e-16 A (g_k/g_i) lambda^2, lambda in angstrom): max relative deviation 0.109 (2p3p_1D_2 -> 2p3s_3Po_1, A = 4.e+03), 0 lines beyond the rounding of A and f
4 branching ratios: 67 upper levels, max |sum - 1| 2.2e-16
4 closure: min coverage 0.9999999971 (2p4d_1Fo_3): selected lower levels carry that share of the NIST-listed rate
4 lifetimes, 1/sum(A) against MCHF:
   2p2_3P_1       1/sumA 1.261e+07 s   MCHF 1.277e+07 s   ratio 0.988
   2p2_3P_2       1/sumA 3.774e+06 s   MCHF 3.896e+06 s   ratio 0.969
   2p2_1D_2       1/sumA 3412 s   MCHF 3419 s   ratio 0.998
   2p2_1S_0       1/sumA 1.66 s   MCHF 429.9 s   ratio 0.004
   2s2p3_5So_2    1/sumA 0.03333 s   MCHF 0.03435 s   ratio 0.970
   2p3s_3Po_0     1/sumA 2.882e-09 s   MCHF 2.777e-09 s   ratio 1.038
   2p3s_3Po_1     1/sumA 2.881e-09 s   MCHF 2.774e-09 s   ratio 1.039
   2p3s_3Po_2     1/sumA 2.874e-09 s   MCHF 2.768e-09 s   ratio 1.038
   2p3s_1Po_1     1/sumA 2.724e-09 s   MCHF 2.667e-09 s   ratio 1.021
   2s2p3_3Do_3    1/sumA 8.547e-09 s   MCHF 7.878e-09 s   ratio 1.085
   2s2p3_3Do_1    1/sumA 8.507e-09 s   MCHF 7.861e-09 s   ratio 1.082
   2s2p3_3Do_2    1/sumA 8.525e-09 s   MCHF 7.868e-09 s   ratio 1.084
   2s2p3_3Po_1    1/sumA 4.5e-09 s   MCHF 3.487e-09 s   ratio 1.290
   2s2p3_3Po_2    1/sumA 4.562e-09 s   MCHF 3.502e-09 s   ratio 1.303
   2s2p3_3Po_0    1/sumA 4.479e-09 s   MCHF 3.479e-09 s   ratio 1.287
   2p2_1S_0 without its E2 decay to 2p2_1D_2: 1/sumA 430.7 s
5 cascade: 68 of 68 levels reach 2p2_3P_0, stuck: none
6 eV / cm^-1: 1.2398419625e-04 to 1.2398419852e-04
7 RHF orbitals (Bunge 1993), exact integrals against the table:
   1s: norm 1.0000002, <R> 0.268443/0.268443, <R**2> 0.097199/0.097199, <1/R> 5.664439/5.664439, <1/R**2> 65.234151/65.234157
   2s: norm 0.9999985, <R> 1.589342/1.589344, <R**2> 3.052059/3.052064, <1/R> 0.896797/0.896798, <1/R**2> 3.255286/3.255303
   2p: norm 0.9999997, <R> 1.714494/1.714495, <R**2> 3.746798/3.746800, <1/R> 0.783503/0.783503, <1/R**2> 0.892065/0.892066, <1/R**3> 1.691940/1.691945
   <1s|2s> = -7.78e-07, worst relative deviation from the table 5.3e-06
   R1s(0)^2 + R2s(0)^2 = 800.7993 (table RHOat0 800.79993), electron density at the nucleus 2(R1s(0)^2 + R2s(0)^2)/(4 pi) = 127.4512 bohr^-3
8 outer-electron model: 30 terms, <r> by quadrature against (3 n*^2 - lambda(lambda+1))/2, max relative deviation 3.3e-14
8 angular occupations: 23 states, max |sum of occupations - 2| 2.0e-06
RESULT PASS
```

What each check means:

1. Levels sorted by energy, all below the ionization energy, every line's
   $E_k$ and $E_i$ identical to its levels' energies, and $g = 2J + 1$ at
   both ends.
2. $\lambda = 10^7 / (E_k - E_i)$ nm against NIST's Ritz vacuum
   wavelength: the largest residual is $1.4\times10^{-7}$ relative,
   0.16 of the larger of NIST's uncertainty and its rounding. The observed
   wavelengths agree with the Ritz ones within 3 standard deviations,
   save one line at 3.1.
3. The air wavelengths: $\lambda_\mathrm{vac}/\lambda_\mathrm{air} - 1$
   falls from $3.02\times10^{-4}$ at 248 nm to $2.73\times10^{-4}$ at
   1972 nm, monotone within the rounding of the listed values, as the
   dispersion of air requires. NIST's air-vacuum convention holds for
   every line.
4. $f_{ik} = 1.49919\times10^{-16}\,A_{ki}\,(g_k/g_i)\,\lambda^2$ (NIST's
   formula, $\lambda$ in angstroms) reproduces every listed $f$ within the
   rounding of $A$ and $f$. Branching ratios sum to 1. Lifetimes as in
   section 4.
5. Every one of the 68 levels reaches $2p^2\,{}^3P_0$ by listed decays.
6. NIST's eV and $\mathrm{cm^{-1}}$ energies share one conversion
   factor, $1.23984196\times10^{-4}$ eV per $\mathrm{cm^{-1}}$, to the
   rounding of the listed values.
7. and 8. The orbitals, section 6.

## 6. Electron density

### 6.1 Ground configuration: Roothaan-Hartree-Fock orbitals

Source bunge1993, the carbon block of RHF.TABLES, state
$1s^2 2s^2 2p^2\ {}^3P$, total energy $-37.68861890$ hartree, virial
ratio $-2.000000017$. Each radial function is a sum of normalized
Slater-type functions:

$$R_{nl}(r) = \sum_j c_j\,N_j\,r^{n_j-1}e^{-\zeta_j r},\qquad
N_j = \frac{(2\zeta_j)^{n_j+1/2}}{\sqrt{(2n_j)!}},$$

with $r$ in bohr ($a_0 = 5.29177210544\times10^{-11}$ m). The orbital
is $\phi_{nlm}(\mathbf r) = R_{nl}(r)\,Y_{lm}(\theta,\varphi)$.
Transcribed from the file (the ASCII file has no table numbers, and the
journal paper itself was not obtained):

| function | $n_j$ | $\zeta_j$ | $c_j(1s)$ | $c_j(2s)$ |
| --- | --- | --- | --- | --- |
| 1S | 1 | 8.4936 | 0.352872 | -0.071727 |
| 1S | 1 | 4.8788 | 0.473621 | 0.438307 |
| 3S | 3 | 15.4660 | -0.001199 | -0.000383 |
| 2S | 2 | 7.0500 | 0.210887 | -0.091194 |
| 2S | 2 | 2.2640 | 0.000886 | -0.393105 |
| 2S | 2 | 1.4747 | 0.000465 | -0.579121 |
| 2S | 2 | 1.1639 | -0.000119 | -0.126067 |

| function | $n_j$ | $\zeta_j$ | $c_j(2p)$ |
| --- | --- | --- | --- |
| 2P | 2 | 7.0500 | 0.006977 |
| 2P | 2 | 3.2275 | 0.070877 |
| 2P | 2 | 2.1908 | 0.230802 |
| 2P | 2 | 1.4413 | 0.411931 |
| 2P | 2 | 1.0242 | 0.350701 |

| quantity | 1s | 2s | 2p |
| --- | --- | --- | --- |
| orbital energy (hartree) | -11.325519 | -0.705627 | -0.433341 |
| `<R>` (bohr powers) | 0.268443 | 1.589344 | 1.714495 |
| `<R**2>` (bohr powers) | 0.097199 | 3.052064 | 3.7468 |
| `<1/R>` (bohr powers) | 5.664439 | 0.896798 | 0.783503 |
| `<1/R**2>` (bohr powers) | 65.234157 | 3.255303 | 0.892066 |
| `<1/R**3>` (bohr powers) | - | - | 1.691945 |

Checks (section 5, item 7), by exact integrals of the Slater products,
$\int_0^\infty r^m e^{-ar}\,dr = m!/a^{m+1}$: each orbital's norm is 1
within $1.5\times10^{-6}$, $\langle 1s|2s\rangle = -7.8\times10^{-7}$,
and every tabulated expectation value is reproduced within
$5.3\times10^{-6}$ relative, consistent with the six-digit rounding of
the coefficients. The file's `RHOat0 = 800.79993` equals
$R_{1s}(0)^2 + R_{2s}(0)^2 = 800.7993$. The electron density at the
nucleus is twice that over $4\pi$, $127.45\ \mathrm{bohr^{-3}}$.

These are Hartree-Fock orbitals of the ${}^3P$ term. They serve the
${}^1D$ and ${}^1S$ terms of the same configuration too: the single
configuration $2s^2 2p^2$ holds 98 %, 98 % and 94 % of the ${}^3P$,
${}^1D$ and ${}^1S$ eigenvectors (NIST leading percentages, and 4 % of
${}^1S$ is $2s^0 2p^4$). The term-dependence of the radial functions was
not measured here (section 11).

### 6.2 What a $2p^2$ term looks like

The density of a state of total orbital angular momentum $L$ and
projection $M_L$, in a single configuration, is

$$\rho(\mathbf r) = \frac{2}{4\pi}\left(R_{1s}^2 + R_{2s}^2\right)
+ R_{2p}(r)^2 \sum_{m} n_m\,|Y_{1m}(\theta,\varphi)|^2,$$

where $n_m$ is the occupation of the one-electron state $m$, from the
Clebsch-Gordan coefficients: $n_m = \sum_{m'}
|\langle 1 m, 1 m' | L M_L\rangle|^2 + \sum_{m'} |\langle 1 m', 1 m |
L M_L\rangle|^2$. Spin does not enter. Computed with sympy, in the data
file under `orbitals.angular`:

| term | $M_L$ | $n_{-1}$ | $n_0$ | $n_{+1}$ | shape of the $2p$ part |
| --- | --- | --- | --- | --- | --- |
| ${}^3P$ | 0 | 1 | 0 | 1 | $\propto \sin^2\theta$, a torus about the axis |
| ${}^3P$ | 1 | 0 | 1 | 1 | $\propto 1 + \cos^2\theta$ |
| ${}^1D$ | 0 | 1/3 | 4/3 | 1/3 | elongated along the axis |
| ${}^1D$ | 1 | 0 | 1 | 1 | as ${}^3P$, $M_L = 1$ |
| ${}^1D$ | 2 | 0 | 0 | 2 | $\propto \sin^2\theta$, both in $m = 1$ |
| ${}^1S$ | 0 | 2/3 | 2/3 | 2/3 | spherical |

$M_L < 0$ mirrors $M_L > 0$. The sum over $M_L$ of a term, its
statistical mixture, is spherical. A free atom in no field has no
preferred axis, so the honest default picture of any term is spherical,
and the shapes above are components that exist only once an axis is
chosen (a field, or a measurement along an axis). A picture of one
$M_L$ must say so.

What then distinguishes the three $2p^2$ terms in a picture is not their
shape but their energy. Their total densities differ only through the
small term-dependence of the radial functions.

### 6.3 Excited configurations: the core and one outer electron

Bunge 1993 gives ground states only. No published orbital set for the
excited configurations of C I was obtained (section 11). The model here
is fixed by NIST data alone and says plainly what it is.

An excited level $2s^2 2p\,nl$ is a $1s^2 2s^2 2p$ core, the C II ground
configuration, with one outer electron. Its density:

$$\rho = \frac{2}{4\pi}\left(R_{1s}^2 + R_{2s}^2\right)
+ R_{2p}^2\sum_m n_m|Y_{1m}|^2 + R_{nl}^2\sum_{m'} n'_{m'}|Y_{lm'}|^2,$$

with $n_m$, $n'_{m'}$ from the Clebsch-Gordan coefficients of
$\langle 1 m, l m' | L M_L\rangle$ (data file, `orbitals.angular`), the
core orbitals from Bunge (an approximation: the C II core relaxes when
the outer electron leaves, and that relaxation is not in this model).

The outer electron moves, outside the core, in the field of a charge
$+1$, and its binding energy is known from NIST:
$E_\mathrm{bind} = R_\mathrm{C}/n^{*2}$, with $n^* =
\sqrt{R_\mathrm{C}/(\bar E_\infty - \bar E_\mathrm{term})}$, the term's
$g$-weighted centroid $\bar E_\mathrm{term}$ and the C II limit centroid
$\bar E_\infty = (2E_{1/2} + 4E_{3/2})/6 = 90\,862.6113\ \mathrm{cm^{-1}}$.
The model replaces $l$ in the centrifugal term by a real $\lambda$ chosen
so that the radial equation

$$P'' = \left[\frac{\lambda(\lambda+1)}{r^2} - \frac{2}{r} +
\frac{1}{n^{*2}}\right]P$$

has the NIST energy as an eigenvalue. Its solutions are hydrogenic in
form:

$$P(r) = r\,R(r) = N\,r^{\lambda+1}e^{-r/n^*}\,
L_{n_r}^{(2\lambda+1)}\!\left(\frac{2r}{n^*}\right),\qquad
\lambda = n^* - n_r - 1,$$

with $L$ the generalized Laguerre polynomial of integer degree $n_r$ and
real index, by the recurrence
$L_{k+1}^{(a)}(x) = [(2k+1+a-x)L_k^{(a)}(x) - (k+a)L_{k-1}^{(a)}(x)]/(k+1)$,
$L_0 = 1$, $L_1 = 1 + a - x$. $n_r$ counts the outer electron's radial
nodes outside the core: 0 for $3s$, $3p$, $3d$, 1 for $4s$, $4p$, $4d$,
2 for $5s$. Its mean radius is $\langle r\rangle = [3n^{*2} -
\lambda(\lambda+1)]/2$ (the hydrogenic formula, which the check confirms
by quadrature within $3\times10^{-14}$). $N$ is fixed numerically by
$\int_0^\infty P^2\,dr = 1$.

| configuration, term | $n^*$ | $\delta = n - n^*$ | $n_r$ | $\lambda$ | $\langle r \rangle$ (bohr) |
| --- | --- | --- | --- | --- | --- |
| 2s2.2p.3s 3Po | 1.8971 | 1.1029 | 0 | 0.8971 | 4.55 |
| 2s2.2p.3s 1Po | 1.9492 | 1.0508 | 0 | 0.9492 | 4.77 |
| 2s2.2p.3p 1P | 2.2330 | 0.7670 | 0 | 1.2330 | 6.10 |
| 2s2.2p.3p 3D | 2.2783 | 0.7217 | 0 | 1.2783 | 6.33 |
| 2s2.2p.3p 3S | 2.3354 | 0.6646 | 0 | 1.3354 | 6.62 |
| 2s2.2p.3p 3P | 2.3729 | 0.6271 | 0 | 1.3729 | 6.82 |
| 2s2.2p.3p 1D | 2.4520 | 0.5480 | 0 | 1.4520 | 7.24 |
| 2s2.2p.3p 1S | 2.5491 | 0.4509 | 0 | 1.5491 | 7.77 |
| 2s2.2p.3d 1Do | 2.8851 | 0.1149 | 0 | 1.8851 | 9.77 |
| 2s2.2p.4s 3Po | 2.9360 | 1.0640 | 1 | 0.9360 | 12.02 |
| 2s2.2p.3d 3Fo | 2.9469 | 0.0531 | 0 | 1.9469 | 10.16 |
| 2s2.2p.3d 3Do | 2.9566 | 0.0434 | 0 | 1.9566 | 10.22 |
| 2s2.2p.4s 1Po | 2.9602 | 1.0398 | 1 | 0.9602 | 12.20 |
| 2s2.2p.3d 1Fo | 2.9829 | 0.0171 | 0 | 1.9829 | 10.39 |
| 2s2.2p.3d 1Po | 3.0076 | -0.0076 | 0 | 2.0076 | 10.55 |
| 2s2.2p.3d 3Po | 3.0826 | -0.0826 | 0 | 2.0826 | 11.04 |
| 2s2.2p.4p 1P | 3.2640 | 0.7360 | 1 | 1.2640 | 14.55 |
| 2s2.2p.4p 3D | 3.3044 | 0.6956 | 1 | 1.3044 | 14.88 |
| 2s2.2p.4p 3S | 3.3535 | 0.6465 | 1 | 1.3535 | 15.28 |
| 2s2.2p.4p 3P | 3.3936 | 0.6064 | 1 | 1.3936 | 15.61 |
| 2s2.2p.4p 1D | 3.4739 | 0.5261 | 1 | 1.4739 | 16.28 |
| 2s2.2p.4p 1S | 3.5698 | 0.4302 | 1 | 1.5698 | 17.10 |
| 2s2.2p.4d 1Do | 3.8599 | 0.1401 | 1 | 1.8599 | 19.69 |
| 2s2.2p.5s 3Po | 3.9341 | 1.0659 | 2 | 0.9341 | 22.31 |
| 2s2.2p.4d 3Fo | 3.9345 | 0.0655 | 1 | 1.9345 | 20.38 |
| 2s2.2p.4d 3Do | 3.9528 | 0.0472 | 1 | 1.9528 | 20.55 |
| 2s2.2p.5s 1Po | 3.9635 | 1.0365 | 2 | 0.9635 | 22.62 |
| 2s2.2p.4d 1Fo | 3.9834 | 0.0166 | 1 | 1.9834 | 20.84 |
| 2s2.2p.4d 1Po | 4.0081 | -0.0081 | 1 | 2.0081 | 21.08 |
| 2s2.2p.4d 3Po | 4.0310 | -0.0310 | 1 | 2.0310 | 21.30 |

What is right about it: the energy, by construction, the decay of the
radial probability at large $r$, $P^2 \propto r^{2n^*} e^{-2r/n^*}$, which the energy
alone fixes in the field of a $+1$ ion, and the size, which grows from
4.5 bohr ($3s$) to 22 bohr ($5s$) against the $2p$ orbital's 1.71. The
nearly constant $\lambda$ within each series ($0.90$ to $0.96$ for $s$,
$1.23$ to $1.57$ for $p$, $1.86$ to $2.08$ for $d$) says the model
captures one physical thing, the core's effect on each $l$. What is
wrong: inside the core (the $2p$ orbital's mean radius is 1.71 bohr)
the true orbital has inner nodes and penetrates, and the model has
neither. The core density dominates there, so a picture of the total
density hides that error, and a picture of the outer orbital alone must
not be read inside the core.

What the eye sees: an excited atom is larger. The outer electron's mean
radius is 2.7 to 2.8 times the $2p$'s at $3s$, 3.6 to 4.5 at $3p$, 8.5
to 10 at $4p$, 11.5 to 12.5 at $4d$. The mode's density picture changes size with the
level, and that change is the physically meaningful one.

### 6.4 Where the orbital picture is an approximation, and by how much

- Configuration mixing: NIST's leading percentages measure it. Of the 68
  chosen levels, 42 are 90 % or more one configuration and term. The 26
  below 90 %, with their second component (column "second component" in
  section 2.3): $2p3p\,{}^1S_0$ 88 (9 $2p4p\,{}^1S$), $2s2p^3\,{}^3P^o_{0,1,2}$
  79 (15 $2p3d\,{}^3P^o$), $2p3d\,{}^3F^o_{2,3}$ 86 and 76 (13 and 22
  $2p3d\,{}^3D^o$), $2p3d\,{}^3D^o_{2,3}$ 84 and 75 (14 and 23
  $2p3d\,{}^3F^o$), $2p4s\,{}^1P^o_1$ 80 (18 $2p3d\,{}^1P^o$),
  $2p3d\,{}^1P^o_1$ 81 (18 $2p4s\,{}^1P^o$), $2p3d\,{}^3P^o_{0,1,2}$ 77
  to 78 (15 $2s2p^3\,{}^3P^o$), $2p4p\,{}^3S_1$ and ${}^3P_1$ 89 (9, each
  other), $2p4p\,{}^1S_0$ 79 (13 $2p5p\,{}^1S$), $2p4d\,{}^3F^o_{2,3}$ 86
  and 78 (13 and 19 $2p4d\,{}^3D^o$), $2p4d\,{}^3D^o_{2,3}$ 75 and 80 (16
  $2p5s\,{}^3P^o$, 20 $2p4d\,{}^3F^o$), $2p4d\,{}^3P^o_{1,2}$ 89 and 87
  (6 and 9 $2p5s\,{}^3P^o$), $2p5s\,{}^3P^o_{1,2}$ 89 and 74 (6
  $2p4d\,{}^3P^o$, 11 $2p4d\,{}^3D^o$), $2p5s\,{}^1P^o_1$ 65 (28
  $2p4d\,{}^1P^o$), $2p4d\,{}^1P^o_1$ 67 (30 $2p5s\,{}^1P^o$).
- A picture of one configuration is then a picture of the leading
  component, and should say its percentage. Drawing the mixture of two
  densities in proportion to the percentages is the next approximation,
  and neglects the cross term between the two configurations.
- Single-configuration Hartree-Fock omits correlation: Bunge's total
  energy is $-37.68861890$ hartree, MCHF's ground energy in source mchf
  $-37.81158950$, a difference of 0.123 hartree. The density changes far
  less than the energy, and no published correlated density of C I was
  obtained to say by how much.

## 7. Selection rules and coupling

Electric dipole (E1) transitions, in LS coupling: parity changes, $\Delta
J = 0, \pm1$ (not $0 \leftrightarrow 0$), $\Delta L = 0, \pm1$ (not $0
\leftrightarrow 0$), $\Delta S = 0$, and one electron changes its $l$ by
$\pm1$. M1 and E2 connect levels of the same parity, $\Delta J = 0,
\pm1$ for M1 and $\Delta J = 0, \pm1, \pm2$ for E2. These are the
standard rules. The data obey them: every E1 line in the file joins
levels of opposite parity, and every M1 and E2 line joins levels of
$2s^2 2p^2$. Whether a line is E1, M1 or E2 is NIST's `Type`.

Where LS coupling breaks down in C I, by the data:

- Spin is not conserved exactly. 159 of the 550 E1 lines change $S$,
  and 18 carry over 1 % of their level's decay, up to 21 %
  ($2p5s\,{}^1P^o_1$, section 3.3). Their strength grows with
  excitation, as the term mixing in section 6.4 grows.
- $L$ is not conserved exactly either. $2p3d\,{}^3F^o \to 2p^2\,{}^3P$
  ($\Delta L = 2$, forbidden for E1 in pure LS coupling) carries 14 % of
  the $2p3d\,{}^3F^o$ decays and $2p4d\,{}^3F^o \to 2p^2\,{}^3P$ 24 % of
  the $2p4d\,{}^3F^o$ ones (section 3.2), through the 13 to 22 %
  ${}^3D^o$ admixture of those levels (section 6.4).
- The $2p4f$ levels and the $np$ levels from $n = 8$ are labelled in $jK$
  coupling. The twelve $2p4f$ levels fall in two groups by the core's $J$:
  83 919.7 to 83 926.4 $\mathrm{cm^{-1}}$ on C II ${}^2P^o_{1/2}$, and
  83 986.2 to 84 036.4 on ${}^2P^o_{3/2}$. The groups lie apart by about
  the core's own fine structure, $63.4\ \mathrm{cm^{-1}}$: the core's
  spin-orbit coupling outweighs the $4f$ electron's coupling to it.
- The ground configuration is LS-pure: 98 % for ${}^3P$ and ${}^1D$ (Haris
  and Kramida, hk5s: "almost pure in LS coupling"). Its ${}^1D_2 \to
  {}^3P$ and ${}^1S_0 \to {}^3P$ lines are forbidden as E1 by parity and
  change spin besides. Their $A$ are $5.9\times10^{-8}$ to
  $2.3\times10^{-3}\ \mathrm{s^{-1}}$.

How to show a forbidden line's slowness: by its lifetime, in numbers. A
forbidden decay is not a slower motion of anything. It is a smaller
probability per unit time, $A$, so the atom waits longer before the jump.
The mode can show that wait as a clock or a probability bar that fills,
with $\tau$ printed, and the jump itself as instant as an allowed one
(section 8).

## 8. What to animate

The physics, as it bears on a picture:

- A level is a stationary state. Its density does not move. Nothing
  orbits.
- Spontaneous emission from a level $k$ is a random event in time, with
  the probability of survival $e^{-t/\tau_k}$. When it happens, the atom
  is found in a lower level $i$ chosen with probability $A_{ki}\tau_k$,
  and one photon of wavenumber $E_k - E_i$ leaves. Before it happens the
  atom's own (reduced) state is a mixture, probability $e^{-t/\tau}$
  upper and $1 - e^{-t/\tau}$ lower, with no coherence between them: the
  coherence goes into the field. A density that oscillates between the
  two levels is the picture of a coherently driven atom (Falstad's
  applet, section 9), not of spontaneous decay.
- So a decay is a jump, instant on the screen: the density of the upper
  level is replaced by that of the lower. The photon is a spherical
  shell expanding from the atom at the speed of light, its colour the
  line's. Its intensity is isotropic for the $M$-averaged atom. If one
  $M$ component is drawn, it follows the dipole pattern about the axis,
  $\sin^2\Theta$ for $\Delta M = 0$ and $(1 + \cos^2\Theta)/2$ for
  $\Delta M = \pm1$. A photon is not a ball thrown from the electron.
- The emitted wave packet is long. Its length $c\tau$ is 0.86 m for
  $2p3s\,{}^3P^o_1$ (55 MHz natural width), 16 m for $2p3p\,{}^3D_3$, 68 m
  for $2p4p\,{}^1P_1$, and $5\times10^8$ m for ${}^1S_0$. A drawn shell is
  a symbol, and its thickness should not be read as the packet's.
- Excitation: a photon raises the atom only by an E1 step from its
  present level, so from the ground ${}^3P$ only to odd levels:
  $2p3s\,{}^3P^o$ at 165.7 nm, $2s2p^3\,{}^3D^o$ at 156 nm,
  $2s2p^3\,{}^3P^o$ at 132.9 nm, $2p4s, 2p3d$ at 126 to 128 nm, $2p4d,
  2p5s$ near 119 nm (triplets, and singlets by the intercombination
  lines of section 3.3). The even
  $2p3p$ and $2p4p$ levels are reached by two photons, by electron
  impact (which has no parity rule and can change spin by exchange), or
  by cascade. A mode that excites by "photon" should follow the E1 rule,
  one that excites by "collision" may reach any level, and the picture
  should say which.
- In a gas at 300 K the three ${}^3P_J$ levels are all populated, in the
  ratio 0.128 : 0.354 : 0.518 (Boltzmann factors with $g_J$ and $kT =
  208.5\ \mathrm{cm^{-1}}$, codata). Collisions, not the months-long M1
  decays, keep them so. "Relaxed to the ground state" in a picture means
  the ${}^3P$ term.

Timescales against the screen's 16.7 ms frame:

| process | real time | against a frame |
| --- | --- | --- |
| allowed decay, $2p3s$ and $2s2p^3$ | 2.7 to 8.6 ns | $2\times10^{-7}$ to $5\times10^{-7}$ |
| allowed decay, $2p3p$, $2p3d$, $2p4s$ | 4 to 116 ns | $2\times10^{-7}$ to $7\times10^{-6}$ |
| allowed decay, $2p4p$, $2p4d$, $2p5s$ | 8 to 243 ns | $5\times10^{-7}$ to $1.5\times10^{-5}$ |
| mean time of a whole allowed cascade to $2p^2$, longest start ($2p4d\,{}^3F^o_4$) | 0.34 $\mu$s | $2\times10^{-5}$ |
| $2s2p^3\,{}^5S^o_2$, intercombination | 33 ms | 2 frames |
| ${}^1S_0$, E2 to ${}^1D_2$ | 1.66 s | 100 frames |
| ${}^1D_2$, M1 to ${}^3P$ | 3412 s, 57 min | $2\times10^5$ frames |
| ${}^3P_2 \to {}^3P_1 \to {}^3P_0$, M1 | 44 and 146 days | $2\times10^8$ and $8\times10^8$ frames |

Real time cannot show an allowed decay, and it can show the ${}^5S^o_2$
and ${}^1S_0$ waits as they are. One honest mapping: allowed steps
slowed by one stated factor, the same for all, so their ratios stay true
(a $2p4p$ level waits 25 to 90 times as long as a $2p3s$ one), and the
forbidden waits at real time up to a cap, with the real $\tau$ printed
beside a compressed clock. The factor and the cap are the owner's choice
(section 10). By the branching ratios, a cascade from any singlet level
ends in ${}^1D_2$ with probability 0.65 to 0.999, most through
$2p3s\,{}^1P^o_1 \to {}^1D_2$ (193.1 nm, 92 % of that level's decay),
and from a triplet level with probability at most 0.15. It then waits in
${}^1D_2$ for 57 minutes: without compression an idle atom stays there.
No chosen level decays into $2s2p^3\,{}^5S^o_2$, so only a direct
excitation reaches it.

What must not be implied: an orbit, a path of the electron, a motion
during the jump, a photon that leaves from where the electron is, or a
density that oscillates in spontaneous decay.

## 9. Prior art

Each read on 2026-10-15.

- NIST ASD, Grotrian diagrams output (lines help page,
  https://physics.nist.gov/PhysRefData/ASD/Html/lineshelp.html): "Each
  energy level is shown by a horizontal bar", the x-axis holds "different
  level series" (grouped by configuration by default, or by
  subconfiguration or $J$), the y-axis the energy in
  $\mathrm{cm^{-1}}$, transitions as "slanted gray lines" and the
  ionization limits as horizontal lines. Static, no dynamics. The mode's
  diagram can follow it, with columns by term.
- PhET, Neon Lights and Other Discharge Lamps
  (https://phet.colorado.edu/en/simulations/discharge-lamps): "Produce
  light by bombarding atoms with electrons. See how the characteristic
  spectra of different elements are produced, and configure your own
  element's energy states to produce light of different colors." Only
  the page's description was read, not the simulation.
- PhET, Models of the Hydrogen Atom
  (https://phet.colorado.edu/en/simulations/hydrogen-atom): its page
  renders only with JavaScript and was not read. Worksheets for it,
  found by search, describe classical, Bohr and Schroedinger views and
  an energy-level diagram for $n = 1$ to 6. Secondary.
- Falstad, Hydrogen Atom Orbital Viewer (https://www.falstad.com/qmatom/):
  "displays the wave functions (orbitals) of the hydrogen atom (actually
  the hydrogenic atom) in 3-D", real or complex orbitals, and their
  combinations. Densities, no transitions.
- Falstad, Atomic Dipole Transitions Applet
  (https://www.falstad.com/qmatomrad/): "shows electric dipole
  transitions, which are interactions of classical electromagnetic
  radiation with an atom. It demonstrates absorption and stimulated
  emission." The density oscillates during a driven transition. The
  right picture of a coherent drive, and the wrong one for spontaneous
  decay (section 8).
- Dauger Research, Atom in a Box
  (https://www.daugerresearch.com/orbitals/index.shtml): "the probability
  distribution of an electron bound to a Hydrogen nucleus", rendered as
  clouds in real time.
- D. Manthey, Orbital Viewer and the Grand Table
  (https://www.orbitals.com/orb/): hydrogenic orbitals as surfaces and
  clouds.

All of these that draw a density draw hydrogen. None found animates a
many-electron atom from evaluated data. The level-diagram convention
(NIST, PhET) and the density cloud (Falstad, Dauger, Manthey) are the
two parts the Carbon mode joins.

## 10. Open questions

For the owner:

1. The clock: one slowing factor for allowed decays, and a cap for the
   forbidden waits ($2s2p^3\,{}^5S^o_2$ 33 ms and ${}^1S_0$ 1.66 s can
   run at real time, ${}^1D_2$ 57 min and ${}^3P_{1,2}$ months cannot).
   What factor, what cap, and is the real $\tau$ printed?
2. Lines outside the visible: grey and dashed with the wavelength
   printed, as proposed in section 3.4, or another convention?
3. Brightness: every visible photon at full brightness, or weighted by
   $\bar y$ (the 711 nm red then nearly vanishes)?
4. The density picture: the spherical $M_L$-summed default, or one
   $M_L$ component with its axis labelled? And the outer orbital model of
   section 6.3, which is a model: drawn, or the size alone?
5. The ground term's fine structure ($0$, $16.4$, $43.4\ \mathrm{cm^{-1}}$):
   shown as an inset, or folded into one ${}^3P$ line?
6. Is idle relaxation to the ${}^3P$ term (any $J$), or to ${}^3P_0$?

For the builder:

7. Excitation by photon (E1 rule from the present level) or by collision
   (any level): which signal does which.
8. The data file is 426 kB with all 559 lines. The mode may ship a slim
   copy generated from it (levels, lines with branch, colours), with the
   unit test checking the slim copy against this one.
9. Lines of branch under $10^{-3}$ change no cascade a viewer can see.
   Keep them for the record, or drop them from the slim copy?

For the record:

10. The `n` and `LS` suffixes on NIST `tp_ref` codes are not defined on
    the help page read here.

## 11. Not reached

- Bergstrom, Hallstadius, Lundberg and Persson, Chem. Phys. Lett. 155, 27
  (1989), measured $2p3p$ lifetimes: Lund's repository returned an HTML
  page for its PDF link. No measured C I lifetime is in this document.
- Clementi and Roetti, At. Data Nucl. Data Tables 14, 177 (1974): no
  machine-readable copy found. A search result describes it as covering
  ground and certain excited states. Whether it holds separate orbitals
  for the ${}^1D$ and ${}^1S$ terms of $2p^2$ was not confirmed.
- The NIST MCHF references page returned HTTP 500, so the MCHF lifetimes
  are cited by the collection, its version and its authors, and the paper
  behind its C I table is not named. Tachiev and Froese Fischer 2001
  (T7333) is the likely one, not confirmed.
- G. Simons, J. Chem. Phys. 60, 645 (1974), the model-potential idea
  behind section 6.3, was not obtained. The form in section 6.3 is derived
  and checked here, not quoted.
- Wiese, Fuhr and Deters 1996 and Wiese and Fuhr 2007, the compilations
  NIST cites for most C I rates, were not read directly. Their values
  reach this document through NIST ASD.
