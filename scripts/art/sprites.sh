#!/bin/sh
# Draw the project's own sprite sheets with ImageMagick 6.
# Run from the repository root: scripts/art/sprites.sh
set -eu

work="${TMPDIR:-$HOME/.cache}/claude-skins-art.$$"
mkdir -p "$work"
trap 'rm -rf "$work"' EXIT

# deck: a slider whose track fills and shifts from green to red, 28 frames
# of 160 x 14 stacked in a column.
n=28
i=0
while [ $i -lt $n ]; do
  x=$((6 + i * 148 / (n - 1)))
  r=$((40 + i * 215 / (n - 1)))
  g=$((220 - i * 150 / (n - 1)))
  convert -size 160x14 xc:'#0b0d10' \
    -fill '#23272e' -draw 'rectangle 3,4 156,9' \
    -fill "rgb($r,$g,40)" -draw "rectangle 3,4 $x,9" \
    -fill '#c9ccd2' -draw "rectangle $((x - 5)),1 $((x + 5)),12" \
    -fill '#6d727b' -draw "rectangle $((x - 4)),11 $((x + 4)),12" \
    -fill '#ffffff' -draw "line $((x - 4)),2 $((x + 4)),2" \
    "$work/vol-$(printf %02d $i).png"
  i=$((i + 1))
done
convert "$work"/vol-*.png -append +repage skins/deck/images/slider-context.png

# deck: the same slider in cyan for the cache hit ratio.
i=0
while [ $i -lt $n ]; do
  x=$((6 + i * 148 / (n - 1)))
  convert -size 160x14 xc:'#0b0d10' \
    -fill '#23272e' -draw 'rectangle 3,4 156,9' \
    -fill "rgb(40,$((120 + i * 100 / (n - 1))),$((200 + i * 55 / (n - 1))))" -draw "rectangle 3,4 $x,9" \
    -fill '#c9ccd2' -draw "rectangle $((x - 5)),1 $((x + 5)),12" \
    -fill '#6d727b' -draw "rectangle $((x - 4)),11 $((x + 4)),12" \
    -fill '#ffffff' -draw "line $((x - 4)),2 $((x + 4)),2" \
    "$work/bal-$(printf %02d $i).png"
  i=$((i + 1))
done
convert "$work"/bal-*.png -append +repage skins/deck/images/slider-cache.png

# phosphor: a radar sweep, 24 frames of 96 x 96 in a row.
n=24
i=0
while [ $i -lt $n ]; do
  a=$((i * 360 / n))
  set -- $(awk -v a="$a" 'BEGIN { pi = 3.14159265; for (k = 0; k < 4; k++) { t = (a - k * 9) * pi / 180; printf "%d %d ", 48 + 42 * sin(t), 48 - 42 * cos(t) } }')
  convert -size 96x96 xc:'#020a05' \
    -fill none -stroke '#0f5a2c' -strokewidth 1 \
    -draw 'circle 48,48 48,6' -draw 'circle 48,48 48,20' -draw 'circle 48,48 48,34' \
    -draw 'line 6,48 90,48' -draw 'line 48,6 48,90' \
    -stroke '#1d8f45' -strokewidth 2 -draw "line 48,48 $7,$8" \
    -stroke '#2fc566' -strokewidth 2 -draw "line 48,48 $5,$6" \
    -stroke '#44ee7f' -strokewidth 2 -draw "line 48,48 $3,$4" \
    -stroke '#9dffbf' -strokewidth 2 -draw "line 48,48 $1,$2" \
    "$work/radar-$(printf %02d $i).png"
  i=$((i + 1))
done
convert "$work"/radar-*.png +append +repage skins/phosphor/images/radar.png

identify skins/deck/images/slider-context.png skins/deck/images/slider-cache.png skins/phosphor/images/radar.png
