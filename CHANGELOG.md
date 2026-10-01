# Changelog

All notable changes to Pulsgeber are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Pre-1.0, a new minor version (0.x.0) marks a significant chunk of work and
may still change behaviour; patch versions (0.x.y) are smaller additions and
fixes on top of it. The version lives in `version-name` in
`extension/metadata.json`; each release is tagged `vX.Y.Z`.

## [Unreleased]

### Changed
- The option "Hide TCC Tray Icon" is now called "Don’t Start TCC Tray" and
  says what it does: it removes the tray's autostart entry and ends the
  running tray, while tccd keeps controlling profiles, fans and CPU. Hiding
  sounded as if something kept running in the background.
- The "Details" page of the About dialog and the extension description in
  `metadata.json` now explain what Pulsgeber does: the toggle, how long a
  picked profile lasts, that only the tccd service is needed, and the
  optional switches for GNOME's power mode, power-profiles-daemon and the
  TCC tray. Before, they still described version 0.1.0.
- README rewritten in English and brought up to date: two screenshots (WebP),
  all settings, how new and deleted TCC profiles are handled, install from
  GitHub, tested on Arch Linux (GNOME Shell 50.5, TCC 3.0.10, InfinityBook
  S 17 Gen6), an overview of the source files, and a section declaring the
  use of AI during development.

### Fixed
- The preferences showed no icons next to the profiles: the icon theme only
  searches the directories hicolor lists, and `symbolic/status` is not one of
  them. The pulse icons are now loaded as files there too, as in the Shell.
- Settings of profiles deleted in the TCC (hidden in the menu, pinned icon,
  last picked profile) are now dropped when the preferences open, instead of
  piling up. Profiles created in the TCC show up in the menu the next time it
  opens, with an icon guessed from their CPU and fan settings.

## [0.2.0] - 2026-10-01

### Added
- Own symbolic icons for the profiles in the toggle, the menu and the top
  bar: one low pulse for power saving, two for balanced, three dense ones for
  performance, replacing GNOME's power mode icons. They are drawn as filled
  rectangles, since GNOME Shell recolours symbolic icons by replacing the
  fill and would leave strokes dark.
- Option "Hide Power Mode Toggle" (on by default): hides GNOME's own power
  mode toggle while tccd is running. power-profiles-daemon and tccd write
  the same CPU settings (governor, EPP), and tccd puts its profile back
  within seconds, so GNOME's toggle would show a mode that no longer applies.
- Option "Turn Off power-profiles-daemon": masks and stops the service (or
  unmasks and starts it again) through systemd's D-Bus API; polkit asks for
  the administrator password. Only shown when the service is installed.
- Option "Hide TCC Tray Icon": removes or restores TCC's tray autostart entry
  exactly like the "Tray autostart" item in TCC's own tray menu, and stops or
  starts the running tray icon so the change applies right away.
- While a profile was picked by hand, the menu header says until when it
  lasts and which profile tccd applies next, e.g. "Until on battery, then
  Cool and breezy" (the toggle itself is too narrow for that).
- README section on why tccd alone is enough and what the TCC app is still
  needed for.

### Fixed
- `make zip` repackaged nothing when only the content of an icon changed;
  the package now depends on every file under `extension/`.

## [0.1.0] - 2026-10-01

### Added
- Quick Settings toggle "TCC Profile" listing all TUXEDO Control Center
  profiles, with the active one as subtitle. It is on while a profile other
  than the one TCC assigns to the current power source is active; clicking
  it switches back to that default, the next click to the last picked
  profile, like GNOME's own power mode toggle.
- Switching uses tccd's `SetTempProfileById`, like TCC's tray menu, so it
  lasts until the next power source change and leaves TCC's assignment of
  profiles to AC and battery untouched. The active profile is polled, since
  tccd sends no signal when it changes.
- Optional top bar icon while a non-default profile is active.
- Preferences (libadwaita): hide profiles from the menu, pick an icon per
  profile or let it be guessed from CPU and fan settings, check interval,
  link to the TUXEDO Control Center, About dialog.
- Icon after the GNOME HIG in the colours of TUXEDO's corporate design (a
  pulse generator); drafts and reasoning in `docs/icon.md`.
- German translation.
