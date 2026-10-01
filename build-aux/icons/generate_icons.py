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

import re
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


def pulse(d: str) -> str:
    """Zeichnet einen Rechteckpuls (Pfad nur aus M, H und V) als gefüllte,
    2 px breite Balken. Symbolische Icons müssen gefüllt sein: GNOME färbt sie
    ein, indem es die Füllung ersetzt, Linien (stroke) blieben dunkel."""
    start = re.match(r"M\s*([\d.]+)\s+([\d.]+)", d)
    x, y = float(start[1]), float(start[2])
    steps = re.findall(r"([HV])\s*([\d.]+)", d)
    rects = []
    for cmd, val in steps:
        nx, ny = (float(val), y) if cmd == "H" else (x, float(val))
        rects.append(f'  <rect x="{min(x, nx) - 1:g}" y="{min(y, ny) - 1:g}" '
                     f'width="{abs(nx - x) + 2:g}" height="{abs(ny - y) + 2:g}" fill="{SYM}"/>')
        x, y = nx, ny
    return svg("\n".join(rects) + "\n", 16)


# Symbolisch: nur das Taktsignal, zwei volle Pulse.
BALANCED = "M1 12 H4 V4 H8 V12 H12 V4 H15"
SYMBOLIC = pulse(BALANCED)


def rects(*boxes: tuple) -> str:
    return "".join(f'  <rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{SYM}"/>\n'
                   for x, y, w, h in boxes)


def merge(*svgs: str) -> str:
    """Fügt die Körper mehrerer 16-px-SVGs zu einem zusammen."""
    body = "".join(s.split(">\n", 1)[1].rsplit("</svg>", 1)[0] for s in svgs)
    return svg(body, 16)


# Profilsymbole für Pille, Menü und obere Leiste: je mehr Leistung, desto
# dichter und höher der Puls. Die Kanten liegen auf ganzen Pixeln, damit die
# 2 px breiten Linien bei 16 px scharf bleiben. Eigene, in TCC angelegte
# Profile zeigen einen Puls über einem Schieberegler (Entwurf B in
# docs/icon-drafts/custom/): selbst eingestellt.
PROFILE_ICONS = {
    "power-saver": pulse("M1 12 H5 V7 H11 V12 H15"),
    "balanced": pulse(BALANCED),
    "performance": pulse("M1 13 H2 V3 H5 V13 H8 V3 H11 V13 H14 V3 H15"),
    "custom": merge(pulse("M1 9 H4 V3 H9 V9 H15"),
                    svg(rects((0, 12, 16, 2), (9, 11, 4, 4)), 16)),
}


def main() -> None:
    app = ICONS / "scalable" / "apps" / f"{ICON_NAME}.svg"
    sym = ICONS / "symbolic" / "apps" / f"{ICON_NAME}-symbolic.svg"
    for path, content in ((app, APP), (sym, SYMBOLIC)):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
    for category, content in PROFILE_ICONS.items():
        path = ICONS / "symbolic" / "status" / f"pulsgeber-{category}-symbolic.svg"
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
