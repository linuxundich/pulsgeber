#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Vorschau der Entwürfe für das Symbol eigener Profile: je Entwurf eine
# Menüzeile mit den drei vorhandenen Pulsen und dem Entwurf (16 px), dazu der
# Entwurf vierfach vergrößert, auf hellem und dunklem Grund.
# Benötigt rsvg-convert und ImageMagick.
set -euo pipefail
cd "$(dirname "$0")"
STATUS=../../../extension/icons/hicolor/symbolic/status
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
icon() {  # $1 svg, $2 Farbe, $3 Ziel-png, $4 Größe
  sed "s/#2e3436/$2/g" "$1" > "$T/c.svg"
  rsvg-convert -w "$4" -h "$4" "$T/c.svg" -o "$3"
}
row() {  # $1 Entwurf, $2 Hintergrund, $3 Vordergrund, $4 Suffix
  local args=() x=16
  for c in performance balanced power-saver; do
    icon "$STATUS/pulsgeber-$c-symbolic.svg" "$3" "$T/$c.png" 16
    args+=("$T/$c.png" -geometry +$x+20 -composite); x=$((x + 28))
  done
  icon "$1-symbolic.svg" "$3" "$T/d16.png" 16
  icon "$1-symbolic.svg" "$3" "$T/d.png" 16
  magick "$T/d.png" -filter point -resize 64x64 "$T/d64.png"
  magick -size 420x96 "xc:$2" "${args[@]}" \
    "$T/d16.png" -geometry +$x+20 -composite \
    "$T/d64.png" -geometry +200+16 -composite \
    -fill "$3" -pointsize 12 -annotate +16+70 "$1" \
    -annotate +16+88 "Leistung · Ausgeglichen · Sparen · eigenes" "$T/r-$1-$4.png"
}
args=()
for d in A-unregelmaessig B-regler C-plus; do
  row $d "#fafafb" "#2e3436" l
  row $d "#303030" "#ffffff" d
  args+=("$T/r-$d-l.png" "$T/r-$d-d.png")
done
magick "${args[@]}" -append preview.png
echo preview.png
