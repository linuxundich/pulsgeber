// SPDX-License-Identifier: GPL-3.0-or-later

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GioUnix from 'gi://GioUnix';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import * as Tccd from './tccd.js';

const TCC_DESKTOP_FILE = 'tuxedo-control-center.desktop';
const AUTOMATIC = 'auto';
const ICON_NAME = 'de.linuxundich.Pulsgeber';

function categoryLabel(category) {
    return {
        'performance': _('Performance'),
        'balanced': _('Balanced'),
        'power-saver': _('Power Saver'),
    }[category];
}

export default class PulsgeberPreferences extends ExtensionPreferences {
    async fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window.set_search_enabled(true);
        Gtk.IconTheme.get_for_display(Gdk.Display.get_default())
            .add_search_path(`${this.path}/icons`);

        const page = new Adw.PreferencesPage({
            title: _('General'),
            iconName: 'preferences-system-symbolic',
        });
        window.add(page);

        const general = new Adw.PreferencesGroup({title: _('Quick Settings')});
        page.add(general);

        const indicatorRow = new Adw.SwitchRow({
            title: _('Top Bar Icon'),
            subtitle: _('Show the profile icon while a profile other than the default is active'),
        });
        settings.bind('show-indicator', indicatorRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        general.add(indicatorRow);

        const pollRow = new Adw.SpinRow({
            title: _('Check Interval'),
            subtitle: _('Seconds between checks for changes made in the TUXEDO Control Center'),
            adjustment: new Gtk.Adjustment({lower: 1, upper: 60, stepIncrement: 1, pageIncrement: 5}),
        });
        settings.bind('poll-interval', pollRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        general.add(pollRow);

        const profilesGroup = new Adw.PreferencesGroup({
            title: _('Profiles'),
            description: _('Profiles are created and edited in the TUXEDO Control Center.'),
        });
        page.add(profilesGroup);

        const buttons = new Adw.PreferencesGroup();
        const app = GioUnix.DesktopAppInfo.new(TCC_DESKTOP_FILE);
        if (app) {
            const openRow = new Adw.ButtonRow({
                title: _('Open TUXEDO Control Center'),
                endIconName: 'adw-external-link-symbolic',
            });
            openRow.connect('activated', () => app.launch([], null));
            buttons.add(openRow);
        }
        const aboutRow = new Adw.ButtonRow({title: _('About Pulsgeber')});
        aboutRow.connect('activated', () => this._aboutDialog().present(window));
        buttons.add(aboutRow);
        page.add(buttons);

        let profiles, tccSettings;
        try {
            [profiles, tccSettings] = await Promise.all([Tccd.getProfiles(), Tccd.getSettings()]);
        } catch (e) {
            const row = new Adw.ActionRow({
                title: _('TUXEDO Control Center service not reachable'),
                subtitle: GLib.markup_escape_text(e.message, -1),
            });
            row.add_prefix(new Gtk.Image({iconName: 'dialog-warning-symbolic'}));
            profilesGroup.add(row);
            return;
        }

        const stateMap = tccSettings.stateMap ?? {};
        for (const profile of profiles)
            profilesGroup.add(this._profileRow(settings, profile, profiles, stateMap));
    }

    _aboutDialog() {
        return new Adw.AboutDialog({
            applicationName: this.metadata.name,
            applicationIcon: ICON_NAME,
            version: this.metadata['version-name'] ?? '',
            developerName: 'Christoph Langner',
            developers: ['Christoph Langner https://linuxundich.de'],
            comments: _('Switches the profiles of the TUXEDO Control Center from the Quick Settings. ' +
                'Unofficial, not affiliated with TUXEDO Computers.'),
            website: this.metadata.url,
            issueUrl: `${this.metadata.url}/issues`,
            licenseType: Gtk.License.GPL_3_0,
            copyright: '© 2026 Christoph Langner',
            // TRANSLATORS: Put your name here, one per line
            translatorCredits: _('translator-credits'),
        });
    }

    _profileRow(settings, profile, profiles, stateMap) {
        const roles = [];
        if (stateMap.power_ac === profile.id)
            roles.push(_('Default on AC power'));
        if (stateMap.power_bat === profile.id)
            roles.push(_('Default on battery'));
        const isDefault = roles.length > 0;
        // Set while settings are copied into the widgets, so that doing so
        // is not written back as a change.
        let syncing = false;

        const row = new Adw.ExpanderRow({
            title: GLib.markup_escape_text(profile.name, -1),
            subtitle: roles.join(' · '),
        });
        const icon = new Gtk.Image();
        row.add_prefix(icon);

        // Visible in menu
        const visibleRow = new Adw.SwitchRow({
            title: _('Show in Menu'),
            subtitle: isDefault ? _('Default profiles are always shown') : '',
            sensitive: !isDefault,
        });
        const syncVisible = () => {
            syncing = true;
            visibleRow.active = isDefault ||
                !settings.get_strv('hidden-profiles').includes(profile.id);
            syncing = false;
        };
        syncVisible();
        visibleRow.connect('notify::active', () => {
            if (syncing || isDefault)
                return;
            const hidden = new Set(settings.get_strv('hidden-profiles'));
            if (visibleRow.active)
                hidden.delete(profile.id);
            else
                hidden.add(profile.id);
            settings.set_strv('hidden-profiles', [...hidden]);
        });
        row.add_row(visibleRow);

        // Icon category
        const guessed = Tccd.guessCategory(profile, profiles);
        const choices = [AUTOMATIC, ...Tccd.CATEGORIES];
        const iconRow = new Adw.ComboRow({
            title: _('Icon'),
            model: Gtk.StringList.new([
                _('Automatic (%s)').format(categoryLabel(guessed)),
                ...Tccd.CATEGORIES.map(categoryLabel),
            ]),
        });
        const pinned = () => settings.get_value('profile-categories').deepUnpack();
        const syncIcon = () => {
            const category = pinned()[profile.id];
            syncing = true;
            iconRow.selected = Math.max(0, choices.indexOf(category ?? AUTOMATIC));
            syncing = false;
            icon.iconName = Tccd.iconForCategory(
                Tccd.CATEGORIES.includes(category) ? category : guessed);
        };
        syncIcon();
        iconRow.connect('notify::selected', () => {
            if (syncing)
                return;
            const map = pinned();
            const choice = choices[iconRow.selected];
            if (choice === AUTOMATIC)
                delete map[profile.id];
            else
                map[profile.id] = choice;
            settings.set_value('profile-categories', new GLib.Variant('a{ss}', map));
        });
        row.add_row(iconRow);

        const changedId = settings.connect('changed', (s, key) => {
            if (key === 'profile-categories')
                syncIcon();
            else if (key === 'hidden-profiles')
                syncVisible();
        });
        row.connect('destroy', () => settings.disconnect(changedId));

        return row;
    }
}
