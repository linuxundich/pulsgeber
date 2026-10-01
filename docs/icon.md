# Icon für Pulsgeber

Stand: 2026-10-01 · **Entwurf A (Pulsgenerator) in den Farben der TUXEDO-CI freigegeben und umgesetzt.**

Das endgültige Icon erzeugt `build-aux/icons/generate_icons.py` (SVG, symbolisches SVG und PNGs in 64/128/256 px nach `extension/icons/hicolor/`), die Vorschau `build-aux/icons/make_preview.sh` → `docs/icon-preview.png`. Die Entwürfe liegen zum Vergleich in `docs/icon-drafts/` (`make_drafts.py`, `make_preview.sh` → `preview.png`).

Die Erweiterung zeigt das Icon im Info-Dialog ihrer Einstellungen (`Adw.AboutDialog`), dafür hängt `prefs.js` `extension/icons` an den Suchpfad des Icon-Themes.

## Profilsymbole

Für Pille, Menü und obere Leiste zeichnet `generate_icons.py` drei eigene symbolische Icons nach `extension/icons/hicolor/symbolic/status/`: `pulsgeber-power-saver-symbolic` (ein flacher, breiter Puls), `pulsgeber-balanced-symbolic` (zwei Pulse, wie das symbolische App-Icon) und `pulsgeber-performance-symbolic` (drei dichte, hohe Pulse). Sie ersetzen GNOMEs Symbole für die Energiemodi.

Die Pulse bestehen aus gefüllten, 2 px breiten Rechtecken auf ganzen Pixeln, nicht aus Linien: GNOME Shell färbt symbolische Icons ein, indem es die Füllung ersetzt, ein `stroke` bliebe dunkel (`#2e3436` auf dunklem Grund). Aus demselben Grund sind die Kanten nicht gerundet.

## Regeln

Aufbau nach der [HIG für App-Icons](https://developer.gnome.org/hig/guidelines/app-icons.html):

- Leinwand 128 × 128, 2-px-Raster, gemeinsame Grundlinie, keine extremen Seitenverhältnisse.
- Draufsicht und Front-Profil, das Profil 4 px hoch und dunkler als die Front.
- Flache Flächen ohne Verlauf, keine Schatten, wenig Details (lesbar bis 32 px).
- Symbolisches Icon 16 × 16 in `#2e3436`.

**Bewusste Abweichung:** Die Farben stammen nicht aus der GNOME-Palette, sondern aus dem [Corporate Design Manual von TUXEDO Computers](https://www.tuxedocomputers.com/store_files/1/download/presse/corporate-design-manual-tuxedo.pdf) (Seite „Farben“): Schwarz `#000000`, Rot `#e30016`, Weiß `#ffffff`. Weitere Töne erlaubt das Manual nur abgeleitet („Sättigungsreduktion oder Zufügen von Transparenz“): die Grautöne `#f2f2f2`, `#a6a6a6`, `#262626` sind Schwarz mit Transparenz auf Weiß, das Profil ist die Front mit 30 % Schwarz darüber. Das symbolische Icon bleibt einfarbig, weil GNOME es selbst einfärbt.

**Marke:** Das Icon übernimmt nur die Farben, weder das TUXEDO-X noch den Schriftzug oder den Pinguin. Das Manual untersagt, ohne Genehmigung TUXEDO-Logos zu verwenden oder eine Verbindung zu TUXEDO nahezulegen; deshalb nennt die Beschreibung die Erweiterung „inoffiziell“.

## Entwürfe (Runde 1)

- **A – Pulsgenerator (gewählt):** Ein weißes Messgerät, auf dem schwarzen Display läuft ein rotes Taktsignal, rechts ein Regler für den Takt und einer für die Leistung. Das zeigt den Namen wörtlich (Pulsgeber), bleibt bis 16 px klar, und das symbolische Icon ist einfach der Rechteckpuls.
- **B – Chip mit Puls:** Ein schwarzer Prozessor mit roter Herzschlaglinie. Er verbindet CPU und Puls, aber das 16-px-Symbol verschwimmt, und auf dunklem Grund trägt ihn nur der Pinkranz.
- **C – Metronom:** Ein schwarz lackiertes Pyramiden-Metronom mit rotem Laufgewicht. Rhythmus und Takt sind gut getroffen, es liest sich aber eher als Musik-App.

Die erste Fassung der Entwürfe nutzte die GNOME-Palette; auf Wunsch wurden sie auf die TUXEDO-CI umgestellt (siehe Git-Historie).
