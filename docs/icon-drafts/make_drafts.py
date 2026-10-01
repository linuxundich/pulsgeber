#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Icon-Entwürfe für Pulsgeber (Runde 1, Farben aus der TUXEDO-CI): A Pulsgenerator, B Chip, C Metronom.

Raster 2 px, Farben aus der TUXEDO-CI (Schwarz, Rot, Weiß), Profil vorn 4 px, keine Verläufe.
Symbolische Icons 16 × 16 in #2e3436.

    python3 docs/icon-drafts/make_drafts.py && docs/icon-drafts/make_preview.sh
"""

from pathlib import Path

OUT = Path(__file__).resolve().parent

# TUXEDO-CI (Corporate Design Manual, Seite „Farben“): Schwarz, Weiß und ein
# Rot. Weitere Töne nur abgeleitet: Grau als Schwarz mit Transparenz auf Weiß,
# die dunklen Front-Profile als Kernfarbe mit 30 % Schwarz darüber.
RED, RED_PROFILE, RED_LIGHT = "#e30016", "#9f000f", "#f0808b"   # Rot, +30 % Schwarz, 50 % Deckkraft
BLACK, WHITE = "#000000", "#ffffff"
GRAY1, GRAY2, GRAY3, GRAY4, GRAY5 = "#f2f2f2", "#d9d9d9", "#a6a6a6", "#404040", "#262626"
SYM = "#2e3436"


def svg(body: str, size: int) -> str:
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" '
            f'viewBox="0 0 {size} {size}">\n{body}</svg>\n')


# A – Pulsgenerator: ein Messgerät, auf dessen Display ein Taktsignal läuft,
# rechts zwei Drehregler (Takt und Leistung).
A = svg(f'''  <rect x="10" y="28" width="108" height="80" rx="12" fill="{GRAY3}"/>
  <rect x="10" y="24" width="108" height="80" rx="12" fill="{GRAY1}"/>
  <rect x="20" y="34" width="68" height="60" rx="6" fill="{BLACK}"/>
  <path d="M26 78 H36 V50 H48 V78 H60 V50 H72 V78 H82" fill="none"
        stroke="{RED}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
  <circle cx="103" cy="50" r="9" fill="{GRAY5}"/>
  <rect x="102" y="42" width="2" height="7" fill="{WHITE}"/>
  <circle cx="103" cy="78" r="9" fill="{RED}"/>
  <rect x="102" y="70" width="2" height="7" fill="{WHITE}"/>
''', 128)

A_SYM = svg(f'''  <path d="M1 12 H4 V4 H8 V12 H12 V4 H15" fill="none" stroke="{SYM}"
        stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
''', 16)


# B – Chip mit Puls: ein Prozessor, über dessen Die eine Pulslinie läuft.
def pins() -> str:
    out = []
    for x in (36, 50, 64, 78, 92):
        out.append(f'<rect x="{x - 3}" y="12" width="6" height="12" rx="2" fill="{GRAY2}"/>')
        out.append(f'<rect x="{x - 3}" y="100" width="6" height="14" rx="2" fill="{GRAY3}"/>')
    for y in (36, 50, 64, 78, 92):
        out.append(f'<rect x="12" y="{y - 3}" width="12" height="6" rx="2" fill="{GRAY2}"/>')
        out.append(f'<rect x="104" y="{y - 3}" width="12" height="6" rx="2" fill="{GRAY2}"/>')
    return "\n  ".join(out)


B = svg(f'''  {pins()}
  <rect x="20" y="24" width="88" height="84" rx="10" fill="{BLACK}"/>
  <rect x="20" y="20" width="88" height="84" rx="10" fill="{GRAY5}"/>
  <rect x="32" y="32" width="64" height="60" rx="6" fill="{GRAY4}"/>
  <path d="M38 64 H52 L58 50 L66 80 L73 42 L78 64 H90" fill="none"
        stroke="{RED}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>
''', 128)

B_SYM = svg(f'''  <mask id="m"><rect width="16" height="16" fill="#fff"/>
    <path d="M4 8.5 H6 L7 6 L9 11 L10 8.5 H12" fill="none" stroke="#000" stroke-width="1.5"
          stroke-linejoin="round" stroke-linecap="round"/></mask>
  <rect x="2.5" y="2.5" width="11" height="11" rx="2" fill="{SYM}" mask="url(#m)"/>
  <path d="M5 0.5 V2 M8 0.5 V2 M11 0.5 V2 M5 14 V15.5 M8 14 V15.5 M11 14 V15.5
           M0.5 5 H2 M0.5 8 H2 M0.5 11 H2 M14 5 H15.5 M14 8 H15.5 M14 11 H15.5"
        stroke="{SYM}" stroke-width="1.5" stroke-linecap="round"/>
''', 16)


# C – Metronom: ein Pyramiden-Metronom, das Pendel schlägt nach rechts aus.
C = svg(f'''  <rect x="30" y="100" width="68" height="12" rx="4" fill="{BLACK}"/>
  <rect x="30" y="96" width="68" height="12" rx="4" fill="{GRAY4}"/>
  <path d="M50 14 H78 L94 100 H34 Z" fill="{BLACK}"/>
  <path d="M50 12 H78 L92 98 H36 Z" fill="{GRAY5}"/>
  <path d="M57 24 H71 L78 86 H50 Z" fill="{GRAY1}"/>
  <path d="M60 32 H68 M59 42 H69 M58 52 H70 M57 62 H71" stroke="{GRAY3}" stroke-width="2"/>
  <path d="M64 84 L90 22" stroke="{GRAY4}" stroke-width="4" stroke-linecap="round"/>
  <rect x="73" y="44" width="14" height="10" rx="2" fill="{RED}"
        transform="rotate(-22.8 80 49)"/>
  <circle cx="64" cy="84" r="5" fill="{GRAY4}"/>
''', 128)

C_SYM = svg(f'''  <mask id="m"><rect width="16" height="16" fill="#fff"/>
    <path d="M8 12 L12 2" stroke="#000" stroke-width="3" stroke-linecap="round"/></mask>
  <path d="M6 1.5 H10 L13 13 H3 Z" fill="{SYM}" stroke="{SYM}" stroke-linejoin="round"
        mask="url(#m)"/>
  <path d="M8 11.5 L12 2" stroke="{SYM}" stroke-width="1.5" stroke-linecap="round"/>
  <rect x="1.5" y="13" width="13" height="2.5" rx="1" fill="{SYM}"/>
''', 16)


def main() -> None:
    for name, app, sym in (("A-pulsgenerator", A, A_SYM), ("B-chip", B, B_SYM),
                           ("C-metronom", C, C_SYM)):
        (OUT / f"{name}.svg").write_text(app)
        (OUT / f"{name}-symbolic.svg").write_text(sym)
    print("Entwürfe geschrieben nach", OUT)


if __name__ == "__main__":
    main()
