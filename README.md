# Pulsgeber

GNOME-Shell-Erweiterung, die die Profile des [TUXEDO Control Centers](https://github.com/tuxedocomputers/tuxedo-control-center) über eine Pille in den Schnelleinstellungen umschaltet. Für GNOME 50 und 51.

Inoffiziell, keine Verbindung zu TUXEDO Computers.

![Icon](docs/icon-preview.png)

## Funktionen

- Pille „TCC-Profil“ mit dem aktiven Profil als Untertitel und allen Profilen im Menü.
- Die Pille ist eingeschaltet, solange ein anderes Profil läuft als das, das TCC der aktuellen Stromquelle (Netz oder Akku) zuordnet. Ein Klick schaltet zurück auf dieses Standardprofil, der nächste wieder auf das zuletzt gewählte.
- Der Wechsel gilt wie im Tray-Menü von TCC nur bis zum nächsten Wechsel der Stromquelle, die Zuordnung in TCC bleibt unverändert.
- Optional ein Symbol in der oberen Leiste, solange ein abweichendes Profil aktiv ist.
- Einstellungen: Profile im Menü ausblenden, Symbol je Profil (Leistung, Ausgeglichen, Energiesparmodus oder automatisch geraten), Prüfintervall.

## Voraussetzungen

Ein laufender `tccd` (Paket `tuxedo-control-center`). Die Erweiterung spricht ihn über den System-Bus an (`com.tuxedocomputers.tccd`), Root-Rechte braucht sie nicht. Weil `tccd` Profilwechsel nicht meldet, fragt sie das aktive Profil regelmäßig ab (Standard: alle 5 Sekunden).

## Installation aus dem Quellcode

```bash
make install
```

Unter Wayland lädt GNOME Shell neue Erweiterungen erst nach dem nächsten Anmelden, danach:

```bash
gnome-extensions enable pulsgeber@linuxundich.de
```

Weitere Ziele: `make zip` (Paket für extensions.gnome.org), `make pot` (Übersetzungsvorlage aktualisieren), `make nested` (Test in einer verschachtelten Shell).

## Lizenz

GPL-3.0-or-later
