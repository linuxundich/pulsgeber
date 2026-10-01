#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Entwürfe für das vierte Profilsymbol: eigene (in TCC angelegte) Profile.

Gleicher Aufbau wie die drei Pulse aus build-aux/icons/generate_icons.py:
16 × 16, gefüllte 2-px-Balken auf ganzen Pixeln, #2e3436.

    python3 docs/icon-drafts/custom/make_drafts.py && docs/icon-drafts/custom/make_preview.sh
"""

import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent
sys.path.insert(0, str(OUT.parents[2] / "build-aux" / "icons"))
from generate_icons import SYM, pulse, svg  # noqa: E402


def rects(*boxes: tuple) -> str:
    return "".join(f'  <rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{SYM}"/>\n'
                   for x, y, w, h in boxes)


def merge(*svgs: str) -> str:
    """Fügt die Körper mehrerer 16-px-SVGs zu einem zusammen."""
    body = "".join(s.split(">\n", 1)[1].rsplit("</svg>", 1)[0] for s in svgs)
    return svg(body, 16)


DRAFTS = {
    # A: drei Pulse, mittel, hoch, niedrig – ein selbst gesetzter Rhythmus.
    "A-unregelmaessig": pulse("M1 13 H2 V7 H5 V13 H8 V3 H11 V13 H14 V9 H15"),
    # B: ein Puls über einem Schieberegler mit Knopf.
    "B-regler": merge(pulse("M1 9 H4 V3 H9 V9 H15"),
                      svg(rects((0, 12, 16, 2), (9, 11, 4, 4)), 16)),
    # C: ein Puls, rechts oben ein Plus.
    "C-plus": merge(pulse("M1 13 H3 V7 H8 V13 H15"),
                    svg(rects((12, 0, 2, 6), (10, 2, 6, 2)), 16)),
}


def main() -> None:
    for name, content in DRAFTS.items():
        (OUT / f"{name}-symbolic.svg").write_text(content)
    print("Entwürfe geschrieben nach", OUT)


if __name__ == "__main__":
    main()
