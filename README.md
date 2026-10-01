# Pulsgeber

GNOME-Shell-Erweiterung, die die Profile des [TUXEDO Control Centers](https://github.com/tuxedocomputers/tuxedo-control-center) über eine Pille in den Schnelleinstellungen umschaltet. Für GNOME 50 und 51.

Inoffiziell, keine Verbindung zu TUXEDO Computers.

![Icon](docs/icon-preview.png)

## Funktionen

**Pille in den Schnelleinstellungen**

- Pille „TCC-Profil“ mit dem aktiven Profil als Untertitel und allen Profilen im Menü.
- Ein im Menü gewähltes Profil gilt wie im Tray-Menü von TCC nur bis zum nächsten Wechsel der Stromquelle. Die Zuordnung der Profile zu Netz- und Akkubetrieb in TCC bleibt unverändert.
- Die Pille ist eingeschaltet, solange ein anderes Profil läuft als das, das TCC der aktuellen Stromquelle zuordnet. Ein Klick schaltet zurück auf dieses Standardprofil, der nächste wieder auf das zuletzt gewählte, wie beim Energiemodus-Schalter von GNOME.
- Solange ein Profil von Hand gewählt ist, nennt die Kopfzeile des Menüs, wann es endet und was danach kommt, etwa „Bis Akkubetrieb, dann Cool and breezy“.
- Eigene Puls-Symbole je Profil: ein flacher Puls für Energiesparen, zwei für Ausgeglichen, drei dichte für Leistung. Optional erscheint das Symbol auch in der oberen Leiste, solange ein abweichendes Profil aktiv ist.
- Profile, die man in TCC neu anlegt, stehen beim nächsten Öffnen im Menü. Ihr Symbol rät Pulsgeber aus Takt, Lüfter und EPP, man kann es in den Einstellungen festlegen. Einstellungen zu gelöschten Profilen räumt Pulsgeber beim Öffnen der Einstellungen auf.

**Einstellungen**

- Schnelleinstellungen: Symbol in der oberen Leiste, „Tray des TCC nicht starten“, Prüfintervall.
- Energiemodus von GNOME: „Energiemodus-Schalter ausblenden“ (Standard an) und „power-profiles-daemon abschalten“, siehe [TCC und power-profiles-daemon](#tcc-und-power-profiles-daemon).
- Profile: je Profil im Menü anzeigen oder ausblenden und das Symbol wählen (automatisch, Leistung, Ausgeglichen, Energiesparmodus). Standardprofile lassen sich nicht ausblenden.
- Link zum TUXEDO Control Center und ein Info-Dialog.

Deutsch und Englisch.

## Voraussetzungen

- GNOME 50 oder 51.
- Ein laufender `tccd` (Paket `tuxedo-control-center`).

Die Erweiterung spricht `tccd` über den System-Bus an (`com.tuxedocomputers.tccd`), Root-Rechte braucht sie nicht. Weil `tccd` Profilwechsel nicht meldet, fragt sie das aktive Profil regelmäßig ab (Standard: alle 5 Sekunden).

## Braucht es das TCC-Programm?

Nein. Profile schaltet und überwacht der Systemdienst `tccd`, den das Paket als `tccd.service` beim Booten startet; mit ihm spricht Pulsgeber. Das Programm „TUXEDO Control Center“ und sein Tray-Symbol (`tuxedo-control-center --tray`) sind nur Oberflächen für denselben Dienst. Gebraucht wird das Programm nur, um Profile anzulegen und zu bearbeiten (`/etc/tcc/profiles`) und sie Netz- und Akkubetrieb zuzuordnen.

Die Option „Tray des TCC nicht starten“ macht dasselbe wie „Tray autostart“ im Menü des TCC-Symbols: Sie löscht `~/.config/autostart/tuxedo-control-center-tray.desktop` bzw. kopiert die Datei aus der TCC-Installation zurück. Zusätzlich beendet sie das laufende Tray-Symbol bzw. startet es, damit die Änderung sofort gilt. Ein offenes TCC-Fenster gehört zum selben Prozess und schließt sich dabei mit.

## TCC und power-profiles-daemon

GNOMEs Schalter „Energiemodus“ gehört zum power-profiles-daemon (ppd). ppd und `tccd` ergänzen sich nicht, sie schreiben dieselben CPU-Einstellungen (Governor und `energy_performance_preference`, auf AMD auch Boost und Mindesttakt). `tccd` prüft diese Werte alle 10 Sekunden und schreibt sein Profil zurück, sobald sie abweichen. Ein Wechsel im GNOME-Schalter wirkt deshalb nur wenige Sekunden, danach zeigt der Schalter einen Modus an, der nicht mehr gilt. Auf einem InfinityBook mit intel_pstate: ppd setzt EPP `power`, nach rund 5 Sekunden steht wieder `balance_performance` aus dem TCC-Profil.

TUXEDO OS liefert ppd gar nicht erst aus, und `tccd` kennt ppd nicht ([Issue #422](https://github.com/tuxedocomputers/tuxedo-control-center/issues/422)). Pulsgeber blendet den GNOME-Schalter deshalb standardmäßig aus, solange `tccd` läuft. Sauberer ist es, ppd ganz abzuschalten. Das geht in den Einstellungen unter „Energiemodus von GNOME“ → „power-profiles-daemon abschalten“: Pulsgeber maskiert und stoppt den Dienst dann über die D-Bus-Schnittstelle von systemd, polkit fragt dafür einmal nach dem Administratorpasswort. Zurückschalten demaskiert und startet ihn wieder. Von Hand entspricht das:

```bash
sudo systemctl mask --now power-profiles-daemon.service
```

```bash
sudo systemctl unmask power-profiles-daemon.service && sudo systemctl start power-profiles-daemon.service
```

## Installation aus dem Quellcode

```bash
git clone https://github.com/linuxundich/pulsgeber.git && cd pulsgeber && make install
```

Unter Wayland lädt GNOME Shell neue Erweiterungen erst nach dem nächsten Anmelden, danach:

```bash
gnome-extensions enable pulsgeber@linuxundich.de
```

Weitere Ziele: `make zip` (Paket für extensions.gnome.org), `make pot` (Übersetzungsvorlage und `po/de.po` aktualisieren), `make nested` (Test in einer verschachtelten Shell).

Getestet mit GNOME Shell 50.5 und TUXEDO Control Center 3.0.10 auf Arch Linux. GNOME 51 ist eingetragen, aber noch nicht getestet.

## Aufbau

| Datei | Aufgabe |
|---|---|
| `extension/extension.js` | Pille, Menü, Symbol in der oberen Leiste, Ausblenden des GNOME-Energiemodus |
| `extension/prefs.js` | Einstellungen (libadwaita) und Info-Dialog |
| `extension/tccd.js` | D-Bus-Zugriff auf `tccd`, Symbolwahl je Profil |
| `extension/ppd.js` | power-profiles-daemon über systemd maskieren und demaskieren |
| `extension/tray.js` | Autostart und Prozess des TCC-Trays |
| `build-aux/icons/generate_icons.py` | erzeugt App-Icon und Puls-Symbole, Hintergründe in [docs/icon.md](docs/icon.md) |
| `po/` | Übersetzungen |

## Versionen

Die Versionsnummer steht als `version-name` in `extension/metadata.json`, jede Version ist in Git als `vX.Y.Z` getaggt. Änderungen stehen im [CHANGELOG](CHANGELOG.md).

## Lizenz

GPL-3.0-or-later
