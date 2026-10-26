// SPDX-License-Identifier: GPL-3.0-or-later

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {QuickMenuToggle, SystemIndicator} from 'resource:///org/gnome/shell/ui/quickSettings.js';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import * as Tccd from './tccd.js';
import * as Tray from './tray.js';

// The TCC app, under its desktop file name of TCC 3.1 and later or before.
function lookupTcc() {
    const appSystem = Shell.AppSystem.get_default();
    for (const id of Tray.DESKTOP_FILES) {
        const app = appSystem.lookup_app(id);
        if (app)
            return app;
    }
    return null;
}

// tccd picks the default profile by power source, so the toggle follows it.
const UPOWER_BUS_NAME = 'org.freedesktop.UPower';
const UPOWER_PATH = '/org/freedesktop/UPower';

const ProfileToggle = GObject.registerClass(
class ProfileToggle extends QuickMenuToggle {
    _init(extension, settings) {
        super._init({
            title: _('TCC Profile'),
            gicon: Tccd.giconForCategory(extension.path, 'balanced'),
            menuButtonAccessibleName: _('Open TCC profile menu'),
            visible: false,
        });

        this._settings = settings;
        this._icon = category => Tccd.giconForCategory(extension.path, category);
        this._cancellable = new Gio.Cancellable();
        this._profiles = [];
        this._activeId = null;
        this._defaultId = null;
        this._items = new Map();

        this._profileSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._profileSection);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const tcc = lookupTcc();
        if (tcc)
            this.menu.addSettingsAction(_('TUXEDO Control Center'), tcc.get_id());

        this.connect('clicked', () => this._onClicked());
        this.menu.connect('open-state-changed', (menu, open) => {
            if (open)
                this._refresh(true);
        });

        this._settingsChangedId = this._settings.connect('changed', (s, key) => {
            if (key === 'poll-interval')
                this._restartPolling();
            else if (key === 'hidden-profiles' || key === 'profile-categories')
                this._rebuildMenu();
        });

        this._upower = new Gio.DBusProxy({
            g_connection: Gio.DBus.system,
            g_name: UPOWER_BUS_NAME,
            g_object_path: UPOWER_PATH,
            g_interface_name: UPOWER_BUS_NAME,
            g_flags: Gio.DBusProxyFlags.DO_NOT_AUTO_START,
        });
        this._upower.init_async(GLib.PRIORITY_DEFAULT, this._cancellable, (proxy, res) => {
            try {
                proxy.init_finish(res);
                this._refresh(false);
            } catch (e) {
                if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                    console.error('UPower:', e);
            }
        });
        this._upowerChangedId = this._upower.connect('g-properties-changed',
            () => this._refresh(false));
    }

    set tccdRunning(running) {
        this._running = running;
        if (running) {
            this._refresh(true);
            this._restartPolling();
        } else {
            this._stopPolling();
            this.visible = false;
        }
    }

    get _onBattery() {
        return this._upower.get_cached_property('OnBattery')?.unpack() ?? false;
    }

    _restartPolling() {
        this._stopPolling();
        if (!this._running)
            return;
        const seconds = Math.max(1, this._settings.get_uint('poll-interval'));
        this._pollId = GLib.timeout_add_seconds(GLib.PRIORITY_LOW, seconds, () => {
            this._refresh(false);
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopPolling() {
        if (this._pollId) {
            GLib.source_remove(this._pollId);
            this._pollId = 0;
        }
    }

    async _refresh(withProfiles) {
        try {
            const [active, settings, profiles] = await Promise.all([
                Tccd.getActiveProfile(_, this._cancellable),
                Tccd.getSettings(this._cancellable),
                withProfiles || !this._profiles.length
                    ? Tccd.getProfiles(_, this._cancellable) : null,
            ]);
            if (this._cancellable.is_cancelled())
                return;

            const stateMap = settings.stateMap ?? {};
            this._defaultId = this._onBattery ? stateMap.power_bat : stateMap.power_ac;
            // tccd applies this one when the power source changes next.
            this._nextId = this._onBattery ? stateMap.power_ac : stateMap.power_bat;
            this._activeId = active.id;
            this._activeName = active.name;

            if (profiles) {
                this._profiles = profiles;
                this._rebuildMenu();
            } else {
                this._sync();
            }
        } catch (e) {
            if (!this._cancellable.is_cancelled())
                console.error('tccd:', e);
        }
    }

    _categoryOf(profile) {
        const pinned = this._settings.get_value('profile-categories').deepUnpack();
        const category = pinned[profile.id];
        return Tccd.CATEGORIES.includes(category)
            ? category : Tccd.guessCategory(profile, this._profiles);
    }

    _visibleProfiles() {
        const hidden = this._settings.get_strv('hidden-profiles');
        // Never hide the active or the default profile: the menu would no
        // longer show where a click on the toggle leads.
        return this._profiles.filter(p => !hidden.includes(p.id) ||
            p.id === this._activeId || p.id === this._defaultId);
    }

    _rebuildMenu() {
        this._profileSection.removeAll();
        this._items.clear();

        for (const profile of this._visibleProfiles()) {
            const item = new PopupMenu.PopupImageMenuItem(profile.name,
                this._icon(this._categoryOf(profile)));
            item.connect('activate', () => this._activate(profile.id));
            this._items.set(profile.id, item);
            this._profileSection.addMenuItem(item);
        }
        this._sync();
    }

    _sync() {
        this.visible = this._running && this._profiles.length > 0;
        if (!this.visible)
            return;

        for (const [id, item] of this._items) {
            item.setOrnament(id === this._activeId
                ? PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE);
        }

        const active = this._profiles.find(p => p.id === this._activeId);
        const category = active ? this._categoryOf(active) : 'balanced';
        this.set({
            subtitle: this._activeName ?? null,
            gicon: this._icon(category),
            // "On" means: a profile other than the one TCC assigns to the
            // current power source is active, as with GNOME's power mode
            // toggle, which is on whenever it is not "Balanced".
            checked: this._activeId !== this._defaultId,
        });
        this.menu.setHeader(this._icon(category), _('TCC Profile'), this._headerSubtitle());

        // _sync() runs on every poll; write only what changed.
        if (this.checked && this._settings.get_string('last-profile') !== this._activeId)
            this._settings.set_string('last-profile', this._activeId);
    }

    _headerSubtitle() {
        // The pill's own subtitle is too narrow for more than the profile
        // name, so the header says whether the choice is only temporary.
        if (this.checked) {
            const next = this._profileName(this._nextId);
            if (!next)
                return _('Until the power source changes');
            return (this._onBattery
                ? _('Until on AC power, then %s')
                : _('Until on battery, then %s')).format(next);
        }
        const defaultName = this._profileName(this._defaultId);
        if (!defaultName)
            return null;
        return (this._onBattery
            ? _('On battery, default: %s') : _('On AC power, default: %s')).format(defaultName);
    }

    _profileName(id) {
        return this._profiles.find(p => p.id === id)?.name ?? '';
    }

    _onClicked() {
        if (this.checked) {
            this._activate(this._defaultId);
            return;
        }
        const last = this._settings.get_string('last-profile');
        if (last && last !== this._defaultId && this._profiles.some(p => p.id === last))
            this._activate(last);
        else
            this.menu.open();
    }

    async _activate(id) {
        if (!id || id === this._activeId)
            return;
        try {
            if (!await Tccd.setTempProfile(id, this._cancellable))
                throw new Error(`tccd rejected profile ${id}`);
            // Show the result right away instead of after the next poll.
            this._activeId = id;
            this._activeName = this._profileName(id);
            this._sync();
        } catch (e) {
            if (this._cancellable.is_cancelled())
                return;
            console.error('tccd:', e);
            Main.notifyError(_('Could not switch TCC profile'), e.message);
        }
        this._refresh(false);
    }

    destroy() {
        this._cancellable.cancel();
        this._stopPolling();
        this._upower.disconnect(this._upowerChangedId);
        this._settings.disconnect(this._settingsChangedId);
        super.destroy();
    }
});

const Indicator = GObject.registerClass(
class Indicator extends SystemIndicator {
    _init(extension, settings) {
        super._init();

        this._settings = settings;
        this._indicator = this._addIndicator();
        this._toggle = new ProfileToggle(extension, settings);
        this.quickSettingsItems.push(this._toggle);

        this._toggle.bind_property('gicon', this._indicator, 'gicon',
            GObject.BindingFlags.SYNC_CREATE);
        this._syncIndicator = () => {
            this._indicator.visible = this._toggle.visible && this._toggle.checked &&
                this._settings.get_boolean('show-indicator');
        };
        this._toggle.connectObject(
            'notify::checked', this._syncIndicator,
            'notify::visible', this._syncIndicator, this);
        this._settings.connectObject('changed::show-indicator', this._syncIndicator, this);
        this._syncIndicator();
    }

    set tccdRunning(running) {
        this._toggle.tccdRunning = running;
    }

    destroy() {
        this._settings.disconnectObject(this);
        this.quickSettingsItems.forEach(item => item.destroy());
        super.destroy();
    }
});

// power-profiles-daemon and tccd write the same CPU settings (governor, EPP);
// tccd checks them every 10 seconds and puts its profile back. GNOME's own
// power mode toggle then shows a mode that no longer applies, so it can be
// hidden while tccd is running.
class PowerModeHider {
    constructor(settings) {
        this._settings = settings;
        this._tccdRunning = false;
        this._indicator = Main.panel.statusArea.quickSettings._powerProfiles;
        this._widgets = [this._indicator, ...this._indicator.quickSettingsItems];
        for (const widget of this._widgets)
            widget.connectObject('notify::visible', () => this._sync(), this);
        this._settings.connectObject('changed::hide-power-mode', () => this._sync(), this);
    }

    set tccdRunning(running) {
        this._tccdRunning = running;
        this._sync();
    }

    get _hide() {
        return this._tccdRunning && this._settings.get_boolean('hide-power-mode');
    }

    _sync() {
        if (this._hide) {
            for (const widget of this._widgets)
                widget.visible = false;
        } else {
            this._restore();
        }
    }

    _restore() {
        // Let GNOME's own code decide again whether its toggle is shown.
        for (const toggle of this._indicator.quickSettingsItems)
            toggle._sync();
        this._indicator._syncIndicatorsVisible();
    }

    destroy() {
        for (const widget of this._widgets)
            widget.disconnectObject(this);
        this._settings.disconnectObject(this);
        this._restore();
    }
}

// Every start of the TCC app also creates a tray icon, and closing its
// window leaves the process running in the tray. While the tray is turned
// off in the preferences ("Don't Start TCC Tray", no autostart entry), end
// the app once its last window is gone, as if it had no tray.
const QUIT_DELAY_SECONDS = 2;

class TccQuitter {
    constructor(app) {
        this._app = app;
        this._cancellable = new Gio.Cancellable();
        this._timeoutId = 0;
        this._app.connectObject('windows-changed', () => this._onWindowsChanged(), this);
    }

    _onWindowsChanged() {
        if (this._app.get_n_windows() > 0 || this._timeoutId ||
            !Tray.isAvailable() || Tray.isEnabled())
            return;
        // Wait a moment: TCC may replace a window by another one.
        this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_LOW, QUIT_DELAY_SECONDS, () => {
            this._timeoutId = 0;
            if (this._app.get_n_windows() === 0) {
                Tray.terminate(this._cancellable).catch(e => {
                    if (!this._cancellable.is_cancelled())
                        console.error('TCC tray:', e);
                });
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    destroy() {
        this._cancellable.cancel();
        this._app.disconnectObject(this);
        if (this._timeoutId)
            GLib.source_remove(this._timeoutId);
        this._timeoutId = 0;
    }
}

export default class PulsgeberExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._indicator = new Indicator(this, this._settings);
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
        this._powerModeHider = new PowerModeHider(this._settings);

        const tcc = lookupTcc();
        if (tcc)
            this._tccQuitter = new TccQuitter(tcc);

        this._tccdWatchId = Tccd.watch(running => {
            this._indicator.tccdRunning = running;
            this._powerModeHider.tccdRunning = running;
        });
    }

    disable() {
        Gio.bus_unwatch_name(this._tccdWatchId);
        this._tccdWatchId = 0;
        this._tccQuitter?.destroy();
        this._tccQuitter = null;
        this._powerModeHider.destroy();
        this._powerModeHider = null;
        this._indicator.destroy();
        this._indicator = null;
        this._settings = null;
    }
}
