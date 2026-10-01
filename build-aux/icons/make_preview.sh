#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Vorschau des App-Icons in 128/64/32 px und des symbolischen Icons in 16 px
# (plus 4-fach vergrößert) auf hellem und dunklem Hintergrund.
# Benötigt rsvg-convert und ImageMagick.
set -euo pipefail
cd "$(dirname "$0")/../.."

ID=de.linuxundich.Pulsgeber
APP=extension/icons/hicolor/scalable/apps/$ID.svg
SYM=extension/icons/hicolor/symbolic/apps/$ID-symbolic.svg
OUT=docs/icon-preview.png
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

for s in 128 64 32; do rsvg-convert -w "$s" -h "$s" "$APP" -o "$TMP/app$s.png"; done
# Symbolisch: dunkel auf hell, hell auf dunkel (wie GTK umfärbt)
sed 's/#2e3436/#ffffff/g' "$SYM" > "$TMP/sym-light.svg"
for v in dark light; do
  src=$SYM; [ "$v" = light ] && src=$TMP/sym-light.svg
  rsvg-convert -w 16 -h 16 "$src" -o "$TMP/sym-$v-16.png"
  magick "$TMP/sym-$v-16.png" -filter point -resize 64x64 "$TMP/sym-$v-64.png"
done

row() {  # $1 Hintergrund, $2 Textfarbe, $3 Variante symbolisch
  magick -size 560x170 "xc:$1" \
    "$TMP/app128.png" -geometry +16+16 -composite \
    "$TMP/app64.png" -geometry +168+48 -composite \
    "$TMP/app32.png" -geometry +256+64 -composite \
    "$TMP/sym-$3-16.png" -geometry +316+72 -composite \
    "$TMP/sym-$3-64.png" -geometry +356+48 -composite \
    -fill "$2" -pointsize 12 \
    -annotate +56+162 "128 px" -annotate +184+162 "64 px" -annotate +256+162 "32 px" \
    -annotate +308+162 "16 px" -annotate +356+162 "symbolisch 16 px, 4×" \
    "$TMP/row-$3.png"
}
row "#fafafb" "#5e5c64" dark
row "#222226" "#c0bfbc" light
magick "$TMP/row-dark.png" "$TMP/row-light.png" -append "$OUT"
echo "$OUT"
