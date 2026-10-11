# Backlog

Open items and undecided ideas. Shipped changes are in
[CHANGELOG.md](CHANGELOG.md).

## Waiting for feedback

- [ ] **New TCC default profile names** (0.4.1): newer TCC versions ship
      default profiles whose name equals their id (`__office__`,
      `__silent__`, …). Pulsgeber maps them to the names TCC shows; it could
      not be reproduced on the maintainer's machine (legacy profiles only), a
      tester at TUXEDO is checking it.

## extensions.gnome.org

- [x] Names "TUXEDO" and "TUXEDO Control Center": TUXEDO is fine with
      community projects as long as the disclaimer says there is no
      official support (metadata, About dialog, README).
- [ ] Read through all of `extension/*.js` once more before submitting:
      reviewers ask about the code and expect the author to answer.
- [ ] Release 0.5.0, upload the ZIP to extensions.gnome.org.
- [ ] After approval: replace "GNOME Extensions: planned" and the install
      note in the README with the link to the EGO page.

## Documentation

- [ ] Link the English project page on linuxundich.de from the README once it
      is published.

## Ideas, not decided

- [ ] Take over the TCC hotkey Super+Alt+F6 (without function under Wayland
      anyway).
- [ ] Sensor line in the menu (`SetSensorDataCollectionStatus` only while the
      menu is open).
- [ ] OSD when the profile changes automatically.
- Not possible on the test device: battery charge profile (none available),
  Fn lock (not supported).
