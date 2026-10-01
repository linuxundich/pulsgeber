# SPDX-License-Identifier: GPL-3.0-or-later
UUID := $(shell python3 -c 'import json;print(json.load(open("extension/metadata.json"))["uuid"])')
DOMAIN := $(shell python3 -c 'import json;print(json.load(open("extension/metadata.json"))["gettext-domain"])')
ZIP := $(UUID).shell-extension.zip

.PHONY: all zip install uninstall pot nested clean

all: zip

zip: $(ZIP)

$(ZIP): $(shell find extension -type f) po/*.po
	gnome-extensions pack --force --podir=../po --extra-source=tccd.js --extra-source=icons \
		--gettext-domain=$(DOMAIN) extension

install: zip
	gnome-extensions install --force $(ZIP)

uninstall:
	gnome-extensions uninstall $(UUID)

pot:
	xgettext --from-code=UTF-8 --language=JavaScript -k_ -kN_ \
		--package-name=$(UUID) -o po/$(DOMAIN).pot extension/*.js
	for po in po/*.po; do msgmerge --update --backup=none $$po po/$(DOMAIN).pot; done

# Test in a nested GNOME Shell window (GNOME 49+: --devkit).
nested: install
	MUTTER_DEBUG_DUMMY_MODE_SPECS=1400x900 dbus-run-session -- gnome-shell --devkit --wayland

clean:
	rm -f $(ZIP)
