#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Erzeugt das Icon und das symbolische Icon von Pulsgeber.

Ein Pulsgenerator: ein weißes Messgerät, auf dessen schwarzem Display ein
rotes Taktsignal läuft, rechts ein Regler für den Takt und einer für die
Leistung. Aufbau nach GNOME-HIG (Raster 2 px, Draufsicht mit 4 px Profil
vorn, flache Flächen), die Farben aber aus der TUXEDO-CI. Die Entwürfe, aus
denen dieses Icon gewählt wurde, stehen in docs/icon.md (Entwurf A).

Zusätzlich rendert es PNGs in 64/128/256 px (per rsvg-convert), damit der
Info-Dialog der Einstellungen auch ohne gdk-pixbuf-Loader für SVG ein Bild
zeigt.

    python3 build-aux/icons/generate_icons.py
"""

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ICON_NAME = "de.linuxundich.Pulsgeber"
ICONS = ROOT / "extension" / "icons" / "hicolor"

# TUXEDO-CI (Corporate Design Manual, Seite „Farben“): Schwarz, Weiß und ein
# Rot. Weitere Töne nur abgeleitet: Grau als Schwarz mit Transparenz auf Weiß,
# das Front-Profil als Grundfarbe mit 30 % Schwarz darüber.
RED = "#e30016"
BLACK, WHITE = "#000000", "#ffffff"
GRAY1, GRAY3, GRAY5 = "#f2f2f2", "#a6a6a6", "#262626"
SYM = "#2e3436"  # Standardfarbe für symbolische Icons


def svg(body: str, size: int) -> str:
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" '
            f'viewBox="0 0 {size} {size}">\n{body}</svg>\n')


APP = svg(f'''  <!-- Gehäuse: Profil, dann Front -->
  <rect x="10" y="28" width="108" height="80" rx="12" fill="{GRAY3}"/>
  <rect x="10" y="24" width="108" height="80" rx="12" fill="{GRAY1}"/>
  <!-- Display mit Taktsignal -->
  <rect x="20" y="34" width="68" height="60" rx="6" fill="{BLACK}"/>
  <path d="M26 78 H36 V50 H48 V78 H60 V50 H72 V78 H82" fill="none"
        stroke="{RED}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
  <!-- Regler: Takt und Leistung -->
  <circle cx="103" cy="50" r="9" fill="{GRAY5}"/>
  <rect x="102" y="42" width="2" height="7" fill="{WHITE}"/>
  <circle cx="103" cy="78" r="9" fill="{RED}"/>
  <rect x="102" y="70" width="2" height="7" fill="{WHITE}"/>
''', 128)

# Symbolisch: nur das Taktsignal, zwei volle Pulse.
SYMBOLIC = svg(f'''  <path d="M1 12 H4 V4 H8 V12 H12 V4 H15" fill="none" stroke="{SYM}"
        stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
''', 16)


def main() -> None:
    app = ICONS / "scalable" / "apps" / f"{ICON_NAME}.svg"
    sym = ICONS / "symbolic" / "apps" / f"{ICON_NAME}-symbolic.svg"
    for path, content in ((app, APP), (sym, SYMBOLIC)):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
    for size in (64, 128, 256):
        png = ICONS / f"{size}x{size}" / "apps" / f"{ICON_NAME}.png"
        png.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["rsvg-convert", "-w", str(size), "-h", str(size), str(app), "-o", str(png)],
                       check=True)
    print("Icons erzeugt in", ICONS.relative_to(ROOT))


if __name__ == "__main__":
    main()
