# What emits the photon, and what it looks like

Status: research for the Carbon mode (#144), 2026-10-15. Answers the
owner's question of that day: is a photon that starts at a random point
drawn from the electron's probability density plausible, is the orbital
the source, and should the emitted wave take the orbital's shape.
Numbers for C I come from `carbon-atom-data.json` and section 6.3 of
`carbon-atom.md`.

## 1. The source is the transition, not a point and not one orbital

The field an atom radiates in a jump from level $i$ to level $f$ is
sourced by the transition charge density

$$\rho_{fi}(\mathbf r) = -e\,\psi_f^*(\mathbf r)\,\psi_i(\mathbf r),$$

and the matching transition current, which oscillate at the line's
frequency $\omega = (E_i - E_f)/\hbar$. It is the product of the two
orbitals, spread over the whole atom, and it is neither the upper
orbital nor the lower one. All of it radiates coherently. Nothing in
the theory singles out a point inside it.

- A point drawn from $|\psi_i|^2$ or $|\psi_f|^2$ is where a position
  measurement would find the electron. Such a measurement is a
  different process: it would itself change the state and stop the
  emission. The electron has no position during a spontaneous jump.
- Dragoman (2025) puts it in these terms: the photon's wave function is
  most localized at the start of emission, in a region set by the
  emitting atom's current density, whose extent for one atom is of the
  order of the Bohr radius. The photon is not sharply localized even
  during emission.
- So a starting point S sampled from the upper density, and a direction
  from S toward a point F sampled from the lower one, have no basis in
  the physics. The source region is the whole transition density.

## 2. The far field does not take the orbital's shape

The atom is tiny next to the wavelength. For C I's lines, with $a$ the
upper orbital's mean radius (section 6.3) and $k = 2\pi/\lambda$:

| line | $a$ (nm) | $ka$ | $(ka)^2$ | $\lambda/2\pi$ (nm) | $c\tau$ (m) |
| --- | --- | --- | --- | --- | --- |
| 2p4p $^1P_1 \to$ 2p3s $^1P^o_1$, 538.2 nm | 0.770 | 0.0090 | $8.1\times10^{-5}$ | 85.7 | 68.1 |
| 2p3s $^1P^o_1 \to$ 2p$^2$ $^1D_2$, 193.1 nm | 0.253 | 0.0082 | $6.8\times10^{-5}$ | 30.7 | 0.82 |
| 2p3s $^3P^o_2 \to$ 2p$^2$ $^3P_2$, 165.7 nm | 0.241 | 0.0091 | $8.3\times10^{-5}$ | 26.4 | 0.86 |

Expanding the source in multipoles, each higher order is smaller by
about $ka \approx 0.01$ in amplitude, $10^{-4}$ in intensity. For an
allowed (E1) line the far field is that of a point electric dipole at
the atom's centre, with moment

$$\mathbf d_{fi} = \langle f | {-e\,\mathbf r} | i \rangle = \int \mathbf r\,\rho_{fi}(\mathbf r)\,d^3r .$$

The orbitals' shapes enter only through this one vector: its length
sets the rate (the Einstein $A$), its direction sets the pattern. The
emitted wave does not look like either orbital or like their product.
The forbidden lines of the ground configuration (M1, E2) radiate as a
magnetic dipole or an electric quadrupole, again from a point source in
the far field, with their own patterns.

## 3. What the emitted photon looks like

From the Weisskopf-Wigner treatment (Scully and Zubairy, Quantum
Optics, ch. 6, and its rereading by Berman, Kuzmich and Milonni 2025):

- A spherical shell centred on the atom, moving out at $c$. Behind its
  front the energy density falls as $e^{-(t - R/c)/\tau}$: the shell
  is a few $c\tau$ thick, 0.8 m to 68 m for the lines above, the photon's
  coherence length. Berman, Kuzmich and Milonni's Eq. 58,
  $\langle w(R,t) \rangle \propto e^{-2\gamma(t-R/c)}\,\Theta(t-R/c)$
  with $2\gamma = 1/\tau$, is this shell.
- Its brightness over the sphere is the dipole pattern about the axis
  of $\mathbf d_{fi}$: $\sin^2\Theta$ for a $\Delta M = 0$ component (a
  doughnut, dark along the axis), $(1+\cos^2\Theta)/2$ for $\Delta M =
  \pm 1$ (brightest along the axis, circularly polarized there). Summed
  over the $M$ components of an unoriented atom the pattern is
  isotropic. These are the pi and sigma patterns of the Zeeman effect.
- Inside about $\lambda/2\pi$ (26 to 86 nm here, 30 to 100 times the
  atom) the field is the quasi-static near field of the dipole, falling
  as $R^{-3}$. The atom sits deep inside its own near zone.
- The direction is not chosen at emission. The photon is in all
  directions of the pattern at once until it is absorbed or detected,
  and a detection lands in one direction, drawn from the pattern. The
  atom recoils opposite to it.
- The field's expectation value is zero for an atom that starts in its
  upper level. What spreads is the probability of finding the photon,
  the shell above. An oscillating charge cloud, the textbook picture of
  a radiating atom, is the picture of an atom driven into a coherent
  superposition, not of spontaneous emission (`carbon-atom.md` section
  8).

## 4. What a physically plausible picture can show

In the order the eye meets it, for the side-on 3D view:

1. The source region. While a jump is under way, the transition density
   $\psi_f^*\psi_i$ drawn at the atom's scale, labelled as the jump's
   source. For 2p4p $\to$ 2p3s it is the product of a p and an s orbital,
   a p-shaped region with the outer orbital's radial nodes. This is the
   one honest place where the orbitals' shapes show in the emission.
2. The shell. A sphere centred on the atom, expanding, its brightness
   painted by the dipole pattern about $\mathbf d_{fi}$: for one chosen
   $M$ component a doughnut ($\Delta M = 0$) or a pair of bright poles
   ($\Delta M = \pm 1$), the axis drawn and labelled because nature did
   not choose it. Wavefronts inside the shell at the line's wavelength,
   on a stated scale.
3. The detection. When the shell reaches the pane's edge, it collapses
   to one point on that edge, in a direction drawn at random from the
   pattern, and the spectrum strip lights its line at that moment. This
   gives the photon a direction honestly: the direction comes into
   being when the photon is found.

Scales the picture states: the wavelength is about 700 times the
atom, so the drawn wavefront spacing is a symbol, and the shell's
thickness and the slowed clock are symbols too.

## 5. What this replaces

The owner's ruling of 2026-10-15 (S and F sampled from the two
densities, the photon from S toward F) is a visual device with no
physical basis, as the owner suspected. Section 4 keeps its intent, a
photon with a source and a direction, on physics: the source is the
transition density and the direction is the detection's.

## Sources

- M. O. Scully and M. S. Zubairy, Quantum Optics, Cambridge University
  Press 1997, ch. 6, the Weisskopf-Wigner theory of spontaneous
  emission and the photon wave function.
- P. R. Berman, A. Kuzmich and P. W. Milonni, Field energy and angular
  momentum in spontaneous emission: a Schroedinger-picture approach,
  arXiv:2504.20831v3 (2025), Eqs. 43, 46, 57, 58. Accessed 2026-10-15.
- D. Dragoman, On the photon-classical electromagnetic field
  relationship, Ann. N. Y. Acad. Sci. 1549 (2025) 11-21,
  https://pmc.ncbi.nlm.nih.gov/articles/PMC12309449/. Accessed
  2026-10-15.
- A. Muthukrishnan, M. O. Scully and M. S. Zubairy, The photon wave
  function, Proc. SPIE 5866 (2005), doi:10.1117/12.623373.
- V. Debierre and T. Durt, Mid- and far-field deviations from causality
  in spontaneous light emission by atomic hydrogen, arXiv:1509.01475
  (2015): Glauber's wave function of the photon from hydrogen's 2p to
  1s jump, nonzero outside the light cone because the decaying
  electron's position is uncertain.
- I. Bialynicki-Birula, Exponential localization of photons, Phys. Rev.
  Lett. 80, 5247 (1998): how far a photon can be localized at all.
- The pi and sigma patterns: Polarization and polarimetry: a review,
  arXiv:1401.1911, and the Zeeman tables of arXiv:astro-ph/0105205.
- J. D. Jackson, Classical Electrodynamics, 3rd ed., ch. 9: multipole
  radiation and the near, intermediate and far zones.
