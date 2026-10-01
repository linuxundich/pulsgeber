// SPDX-License-Identifier: GPL-3.0-or-later

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GioUnix from 'gi://GioUnix';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import * as Ppd from './ppd.js';
import * as Tccd from './tccd.js';
import * as Tray from './tray.js';

const TCC_DESKTOP_FILE = 'tuxedo-control-center.desktop';
const AUTOMATIC = 'auto';
const ICON_NAME = 'de.linuxundich.Pulsgeber';

function categoryLabel(category) {
    return {
        'performance': _('Performance'),
        'balanced': _('Balanced'),
        'power-saver': _('Power Saver'),
        'custom': _('Custom Profile'),
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


        if (Tray.isAvailable())
            general.add(this._trayRow(window));

        const pollRow = new Adw.SpinRow({
            title: _('Check Interval'),
            subtitle: _('Seconds between checks for changes made in the TUXEDO Control Center'),
            adjustment: new Gtk.Adjustment({lower: 1, upper: 60, stepIncrement: 1, pageIncrement: 5}),
        });
        settings.bind('poll-interval', pollRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        general.add(pollRow);

        const powerGroup = new Adw.PreferencesGroup({
            title: _('GNOME Power Mode'),
            description: _('GNOME\'s power mode (power-profiles-daemon) and the TUXEDO Control Center change the same CPU settings. The TUXEDO Control Center wins within seconds.'),
        });
        page.add(powerGroup);

        const powerModeRow = new Adw.SwitchRow({
            title: _('Hide Power Mode Toggle'),
            subtitle: _('Hide it from the Quick Settings while the TUXEDO Control Center is running, as it would show a mode that no longer applies'),
        });
        settings.bind('hide-power-mode', powerModeRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        powerGroup.add(powerModeRow);
        this._addPpdRow(window, powerGroup, powerModeRow);

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

        this._forgetDeletedProfiles(settings, profiles);
        const stateMap = tccSettings.stateMap ?? {};
        for (const profile of profiles)
            profilesGroup.add(this._profileRow(settings, profile, profiles, stateMap));
    }

    // Profiles can be created and deleted in the TCC at any time; drop the
    // settings of profiles that no longer exist.
    _forgetDeletedProfiles(settings, profiles) {
        const ids = new Set(profiles.map(p => p.id));
        const hidden = settings.get_strv('hidden-profiles');
        if (hidden.some(id => !ids.has(id)))
            settings.set_strv('hidden-profiles', hidden.filter(id => ids.has(id)));
        const pinned = settings.get_value('profile-categories').deepUnpack();
        if (Object.keys(pinned).some(id => !ids.has(id))) {
            settings.set_value('profile-categories', new GLib.Variant('a{ss}',
                Object.fromEntries(Object.entries(pinned).filter(([id]) => ids.has(id)))));
        }
        const last = settings.get_string('last-profile');
        if (last && !ids.has(last))
            settings.reset('last-profile');
    }

    _trayRow(window) {
        const row = new Adw.SwitchRow({
            title: _('Don’t Start TCC Tray'),
            subtitle: _('Removes the autostart entry and ends the running tray icon; an open TCC window closes as well. Profiles, fans and CPU stay under control of the tccd service.'),
            active: !Tray.isEnabled(),
        });
        row.connect('notify::active', () => {
            // TCC's own "Tray autostart" item changes the same file, so
            // compare against the file rather than the switch.
            if (row.active === !Tray.isEnabled())
                return;
            try {
                if (row.active)
                    Tray.hide();
                else
                    Tray.show();
            } catch (e) {
                logError(e, 'TCC tray');
                window.add_toast(new Adw.Toast({title: _('Could not change the TCC tray icon')}));
                row.active = !Tray.isEnabled();
            }
        });
        return row;
    }

    async _addPpdRow(window, group, powerModeRow) {
        let state;
        try {
            state = await Ppd.getState();
        } catch (e) {
            logError(e, 'power-profiles-daemon');
            return;
        }
        if (state === null)
            return;

        const row = new Adw.SwitchRow({
            title: _('Turn Off power-profiles-daemon'),
            subtitle: _('Masks the service so that it no longer interferes with the TUXEDO Control Center. Requires administrator rights.'),
        });
        group.add(row);

        // Set while the row shows a state that was read, not chosen.
        let syncing = false;
        const show = masked => {
            syncing = true;
            row.active = masked;
            syncing = false;
            // Without the daemon GNOME hides its power mode toggle by itself.
            powerModeRow.sensitive = !masked;
        };
        show(state === 'masked');

        row.connect('notify::active', async () => {
            if (syncing)
                return;
            const mask = row.active;
            row.sensitive = false;
            try {
                await (mask ? Ppd.disable() : Ppd.enable());
            } catch (e) {
                const denied = [
                    'org.freedesktop.DBus.Error.AccessDenied',
                    'org.freedesktop.DBus.Error.InteractiveAuthorizationRequired',
                ].includes(Gio.DBusError.get_remote_error(e));
                if (!denied)
                    logError(e, 'power-profiles-daemon');
                window.add_toast(new Adw.Toast({
                    title: denied ? _('Not authorized') : _('Could not change power-profiles-daemon'),
                }));
            }
            try {
                show(await Ppd.getState() === 'masked');
            } catch (e) {
                logError(e, 'power-profiles-daemon');
            }
            row.sensitive = true;
        });
    }

    _aboutDialog() {
        return new Adw.AboutDialog({
            applicationName: this.metadata.name,
            applicationIcon: ICON_NAME,
            version: this.metadata['version-name'] ?? '',
            developerName: 'Christoph Langner',
            developers: ['Christoph Langner https://linuxundich.de'],
            comments: [
                _('Pulsgeber adds a “TCC Profile” toggle to the Quick Settings and switches the profiles of the TUXEDO Control Center from there.'),
                _('A profile picked there applies until the power source changes; then the TUXEDO Control Center applies the profile assigned to AC power or battery again. A click on the toggle goes back to that profile right away.'),
                _('Pulsgeber talks directly to the TUXEDO Control Center service (tccd), which runs in the background anyway. The TUXEDO Control Center app and its tray icon are only needed to create and edit profiles.'),
                _('Optionally, Pulsgeber hides GNOME’s power mode toggle, whose settings the TUXEDO Control Center overrides within seconds, turns off power-profiles-daemon and keeps the tray of the TUXEDO Control Center from starting.'),
                _('Unofficial, not affiliated with TUXEDO Computers.'),
            ].join('\n\n'),
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
            // Loaded as a file like in the Shell: the icon theme search path
            // only covers the directories hicolor lists, and symbolic/status
            // is not among them.
            icon.gicon = Tccd.giconForCategory(this.path,
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
