#!/usr/bin/env bash
# Vergleichsvorschau der Icon-Entwürfe: 128/64/32 px, symbolisch 16 px (und 4×),
# daneben zwei GNOME-Referenzicons in 64 px, je auf hellem und dunklem Grund.
# Benötigt rsvg-convert und ImageMagick.
set -euo pipefail
cd "$(dirname "$0")"
REF=../../..
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
row() {  # $1 Entwurf, $2 Hintergrund, $3 Textfarbe, $4 Farbe symbolisch, $5 Suffix
  sed "s/#2e3436/$4/g" "$1-symbolic.svg" > "$T/s.svg"
  for s in 128 64 32; do rsvg-convert -w $s -h $s "$1.svg" -o "$T/a$s.png"; done
  rsvg-convert -w 16 -h 16 "$T/s.svg" -o "$T/s16.png"
  magick "$T/s16.png" -filter point -resize 64x64 "$T/s64.png"
  rsvg-convert -w 64 -h 64 "$REF/org.gnome.Decibels.svg" -o "$T/r1.png"
  rsvg-convert -w 64 -h 64 "$REF/GNOME_Music_Icon.svg" -o "$T/r2.png"
  magick -size 700x170 "xc:$2" \
    "$T/a128.png" -geometry +16+16 -composite "$T/a64.png" -geometry +168+48 -composite \
    "$T/a32.png" -geometry +256+64 -composite "$T/s16.png" -geometry +316+72 -composite \
    "$T/s64.png" -geometry +356+48 -composite "$T/r1.png" -geometry +460+48 -composite \
    "$T/r2.png" -geometry +536+48 -composite "$T/a64.png" -geometry +612+48 -composite \
    -fill "$3" -pointsize 12 -annotate +16+14 "$1" \
    -annotate +56+162 "128 px" -annotate +184+162 "64 px" -annotate +256+162 "32 px" \
    -annotate +308+162 "16 px" -annotate +356+162 "symb. 4x" \
    -annotate +470+162 "Referenzen  ·  Entwurf" "$T/r-$1-$5.png"
}
args=()
for d in A-pulsgenerator B-chip C-metronom; do
  row $d "#fafafb" "#5e5c64" "#2e3436" l
  row $d "#222226" "#c0bfbc" "#ffffff" d
  args+=("$T/r-$d-l.png" "$T/r-$d-d.png")
done
magick "${args[@]}" -append preview.png
echo preview.png
