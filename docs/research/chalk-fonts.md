# Chalk fonts for the library skin's board

Status: current, gathered 2026-10-13 from github.com/google/fonts (main
branch, files fetched that day) and from screenshots of this checkout at
under Xvfb with the fake agent.
The maintainer picked Fredericka the Great, 2026-10-13. By the owner's
word of 2026-10-15 the chalkboard now uses Permanent Marker, the
whiteboard's face, with the lamp labels cut from 18 to 16 px to fit.
Gochi Hand and Fredericka the Great are gone from the skin.

## 1. The question

The maintainer, 2026-10-13: "the library skin's fonts look too much like Comic
Sans. Find free, openly licensed chalkboard handwriting fonts, and show the
maintainer a sample palette to choose from."

The board's face is Gochi Hand (`skins/library/skin.css`, the `.chalk*`
rules). It sets labels at 16 to 21 px and values at 19 to 24 px, the gauge
value as SVG text, in readouts 112 px wide. Only Gochi Hand is in question:
Permanent Marker (whiteboard) and Special Elite (catalog cards) stay.

`docs/SKINS.md`, "Fonts and art: licenses", allows SIL OFL and Apache-2.0
for fonts, among others. Every candidate below is one of the two.

## 2. The palette

`docs/research/chalk-fonts/palette.png` sets each face in the board's real
context, Gochi Hand first. One PNG per face sits beside it, named by slug
(`caveat-brush.png` and so on).

How it was made: `skins/library` copied once per candidate into scratch,
the font file put in the copy's `fonts/<Family>/`, the `"Gochi Hand"`
entry of the copy's `skin.json` and all 7 occurrences of `"Gochi Hand"` in
its `skin.css` replaced by the candidate's family, then one frame per copy:

    scripts/clean-env xvfb-run -a -s "-screen 0 1920x1080x24" node scripts/checks/look.js OUT SKIN_COPY 1 500 -- scripts/fake/claude

Each screenshot is 1240 x 820, cropped with PIL to the board's frame, box
(12, 162, 308, 808): the frame's skin rect (left 12, top 140, width 296,
bottom 12) shifted down 22 px by the window's tab strip, located from the
pixels. The fake agent's replay timing differs a little between launches,
so a lamp may be caught lit (Amatic SC's "tool call" is the tool pulse,
not the font).

Two faces were rendered in their bold, since the regular reads too thin
on the board: Cabin Sketch Bold and Amatic SC Bold. Caveat is a variable
font, rendered at its default instance, weight 400, from upstream's
`Caveat[wght].ttf` copied as `Caveat-Variable.ttf` to keep brackets out of
the `FontFace` URL. Shipping it would take the same rename.

## 3. Candidates

Source: each family's folder in github.com/google/fonts, with the upstream
repository its `METADATA.pb` names. Weights and styles are from
`METADATA.pb`. Licence is the `license:` field of `METADATA.pb` and the
licence file beside the font, which ships with it per `docs/SKINS.md`.

| # | Family | Source (google/fonts) | Upstream (METADATA.pb) | Licence, file | Weights, styles |
| --- | --- | --- | --- | --- | --- |
| 0 | Gochi Hand (current) | github.com/google/fonts/tree/main/ofl/gochihand | github.com/googlefonts/gochihand | OFL, OFL.txt | 400 normal |
| 1 | Caveat Brush | github.com/google/fonts/tree/main/ofl/caveatbrush | github.com/googlefonts/caveat | OFL, OFL.txt | 400 normal |
| 2 | Cabin Sketch | github.com/google/fonts/tree/main/ofl/cabinsketch | github.com/impallari/CabinSketch | OFL, OFL.txt (Reserved Font Names "Cabin", "Cabin Sketch") | 400, 700 normal |
| 3 | Just Another Hand | github.com/google/fonts/tree/main/apache/justanotherhand | github.com/librefonts/justanotherhand | Apache-2.0, LICENSE.txt | 400 normal |
| 4 | Caveat | github.com/google/fonts/tree/main/ofl/caveat | github.com/googlefonts/caveat | OFL, OFL.txt | variable, wght 400 to 700, normal |
| 5 | Amatic SC | github.com/google/fonts/tree/main/ofl/amaticsc | github.com/googlefonts/AmaticSC | OFL, OFL.txt | 400, 700 normal |
| 6 | Rock Salt | github.com/google/fonts/tree/main/apache/rocksalt | github.com/googlefonts/googlefontdirectory-hg | Apache-2.0, LICENSE.txt | 400 normal |
| 7 | Fredericka the Great | github.com/google/fonts/tree/main/ofl/frederickathegreat | github.com/librefonts/frederickathegreat | OFL, OFL.txt (Reserved Font Name "Fredericka the Great") | 400 normal |
| 8 | Sue Ellen Francisco | github.com/google/fonts/tree/main/ofl/sueellenfrancisco | github.com/googlefonts/googlefontdirectory-hg | OFL, OFL.txt | 400 normal |
| 9 | Covered By Your Grace | github.com/google/fonts/tree/main/ofl/coveredbyyourgrace | github.com/googlefonts/coveredbyyourgrace | OFL, OFL.txt | 400 normal |

No family has an italic. The Reserved Font Names matter only if the font
is modified: a renamed subset could not keep the name.

### Coverage and size

Measured from each file with fontTools 4.46.0. The board's figure set is
`0123456789.:$%/k-`, which covers `18.0k`, `567.0k`, `2.0`, `0:02`,
`$0.00`, `1.8%` and `tokens / s`. The core of the measurement, per file:

    from fontTools.ttLib import TTFont
    t = TTFont(f)
    cmap = t.getBestCmap()
    ascii = [chr(c) for c in range(0x20, 0x7f) if c not in cmap]   # missing printable ASCII
    board = [ch for ch in '0123456789.:$%/k-' if ord(ch) not in cmap]
    t['maxp'].numGlyphs, len(cmap)

Bytes from `wc -c FILE`.

| Family | File | Bytes | Glyphs | Mapped chars | Printable ASCII | Board set |
| --- | --- | --- | --- | --- | --- | --- |
| Gochi Hand | GochiHand-Regular.ttf | 37352 | 244 | 240 | 95/95 | all |
| Caveat Brush | CaveatBrush-Regular.ttf | 295568 | 642 | 641 | 95/95 | all |
| Cabin Sketch | CabinSketch-Bold.ttf | 271012 | 224 | 223 | 95/95 | all |
| Cabin Sketch | CabinSketch-Regular.ttf | 156232 | 224 | 223 | 95/95 | all |
| Just Another Hand | JustAnotherHand-Regular.ttf | 191076 | 369 | 368 | 95/95 | all |
| Caveat | Caveat[wght].ttf | 403648 | 1034 | 753 | 95/95 | all |
| Amatic SC | AmaticSC-Bold.ttf | 156180 | 850 | 797 | 95/95 | all |
| Amatic SC | AmaticSC-Regular.ttf | 151624 | 850 | 797 | 95/95 | all |
| Rock Salt | RockSalt-Regular.ttf | 124372 | 228 | 227 | 95/95 | all |
| Fredericka the Great | FrederickatheGreat-Regular.ttf | 486016 | 229 | 226 | 95/95 | all |
| Sue Ellen Francisco | SueEllenFrancisco-Regular.ttf | 60728 | 290 | 287 | 95/95 | all |
| Covered By Your Grace | CoveredByYourGrace.ttf | 57040 | 349 | 344 | 94/95 | lacks `%` |

Covered By Your Grace has no `%`, so the gauge's `1.8%` draws its percent
sign from the fallback `cursive` face.

### Fit

Advance widths in px of the board's longest strings at their `skin.css`
sizes, summed from each font's `hmtx` (no kerning, no letter-spacing). A
readout is 112 px wide and its value has 6 px padding each side. A lamp
label has about 86 px (112 less a 17 px lamp and a 9 px gap).

| Family | `567.0k` at 24 | `compact at` at 16 | `in context` at 16 | `subagent` at 18 | `tool call` at 18 | `tokens / s` at 21 |
| --- | --- | --- | --- | --- | --- | --- |
| Gochi Hand | 69 | 73 | 66 | 70 | 58 | 80 |
| Caveat Brush | 57 | 62 | 57 | 58 | 51 | 70 |
| Cabin Sketch Bold | 71 | 79 | 70 | 72 | 64 | 92 |
| Just Another Hand | 37 | 38 | 33 | 34 | 31 | 44 |
| Caveat | 57 | 60 | 54 | 55 | 46 | 70 |
| Amatic SC Bold | 45 | 49 | 49 | 46 | 46 | 62 |
| Rock Salt | 104 | 115 | 99 | 98 | 99 | 121 |
| Fredericka the Great | 69 | 82 | 73 | 73 | 69 | 93 |
| Sue Ellen Francisco | 46 | 49 | 43 | 43 | 38 | 57 |
| Covered By Your Grace | 46 | 65 | 60 | 57 | 48 | 81 |

## 4. What each looks like on the board

Read from the palette at the skin's current sizes.

1. Caveat Brush. A quick brush hand, upright, narrow, with dry stroke
   ends. Everything fits with room to spare. Reads as handwriting, not
   as Comic Sans: the letters are condensed and uneven, not round.
2. Cabin Sketch Bold. Hatched, broken strokes that look most like real
   chalk dust. A sketched print rather than cursive. Fits: each string is
   2 to 12 px wider than in Gochi Hand, `tokens / s` the widest at 92 px
   in a 208 px widget.
3. Just Another Hand. Tall, condensed marker capitals and lowercase. Fits
   easily but reads small: every string is about half Gochi Hand's
   width, so the labels look undersized at current sizes.
4. Caveat. A light, slanted pen hand. Fits, but thin strokes look like
   ink on paper more than chalk on slate.
5. Amatic SC Bold. Small capitals only, so every lowercase label turns to
   caps. The chalkboard-menu look. Fits, small and narrow.
6. Rock Salt. The roughest scrawl, lowercase drawn as small capitals.
   Overflows at current sizes: `compact at` (115 px) and `567.0k` (104 px
   plus padding) exceed the 112 px readouts, so `in context` and `compact
   at` run into each other, the `I` of `in context` is clipped, and `tool call` (99 px) runs into the
   subagent lamp. The tightest slot is `tool call`, 99 px in about 86, so
   the sizes would need a cut of at least 13 percent (86/99) to fit.
7. Fredericka the Great. Inline display capitals and lowercase, a
   chalkboard-sign face. Fits, but the inline stroke grows busy at 16 px.
8. Sue Ellen Francisco. A thin, tall hand. Fits but reads small and
   faint, like Just Another Hand.
9. Covered By Your Grace. A loose school hand. Fits, but lacks `%`, and
   its lowercase is the roundest here, nearest to Comic Sans.

Crowding or overflow: Rock Salt overflows. Just Another Hand and Sue
Ellen Francisco crowd nothing but read undersized. No other face crowds.

## 5. Recommendation

1. Cabin Sketch Bold: the only face whose strokes look like chalk on
   slate, and nothing like Comic Sans. It fits at the current sizes,
   widths 2 to 12 px over Gochi Hand's, so the swap is a font change only. Cost:
   271012 bytes, against 37352 for Gochi Hand.
2. Caveat Brush: a real handwriting face, condensed and dry-stroked, the
   most legible here at 16 px, with the most room in every slot. Cost:
   295568 bytes.

Pick Cabin Sketch for the look of chalk, Caveat Brush for a hand that
reads at a glance. Either takes the licence file beside it in
`fonts/<Family>/` and a row in `ASSETS.json`.
