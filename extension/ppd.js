// SPDX-License-Identifier: GPL-3.0-or-later
//
// Masks or unmasks power-profiles-daemon through systemd's D-Bus API, the
// equivalent of `systemctl mask --now` and `systemctl unmask` + start.
// polkit asks for the administrator password (auth_admin_keep, so one
// prompt covers all calls of one switch). Only used by prefs.js.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const UNIT = 'power-profiles-daemon.service';
const SYSTEMD = 'org.freedesktop.systemd1';
const PATH = '/org/freedesktop/systemd1';
const MANAGER = 'org.freedesktop.systemd1.Manager';

Gio._promisify(Gio.DBusConnection.prototype, 'call');

function call(method, params = null, interactive = false) {
    return Gio.DBus.system.call(SYSTEMD, PATH, MANAGER, method, params, null,
        interactive ? Gio.DBusCallFlags.ALLOW_INTERACTIVE_AUTHORIZATION : Gio.DBusCallFlags.NONE,
        // Leave time to type the password into the polkit dialog.
        interactive ? 120000 : 5000, null);
}

/**
 * @returns {Promise<string|null>} unit file state ("enabled", "masked", …),
 *   or null if power-profiles-daemon is not installed
 */
export async function getState() {
    try {
        const reply = await call('GetUnitFileState', new GLib.Variant('(s)', [UNIT]));
        return reply.deepUnpack()[0];
    } catch (e) {
        if (e.matches(Gio.DBusError, Gio.DBusError.FILE_NOT_FOUND) ||
            Gio.DBusError.get_remote_error(e) === 'org.freedesktop.systemd1.NoSuchUnit')
            return null;
        throw e;
    }
}

/**
 * Masks and stops the daemon, so that it no longer competes with tccd.
 */
export async function disable() {
    await call('MaskUnitFiles', new GLib.Variant('(asbb)', [[UNIT], false, true]), true);
    await call('Reload', null, true);
    await call('StopUnit', new GLib.Variant('(ss)', [UNIT, 'replace']), true);
}

/**
 * Unmasks and starts the daemon again.
 */
export async function enable() {
    await call('UnmaskUnitFiles', new GLib.Variant('(asb)', [[UNIT], false]), true);
    await call('Reload', null, true);
    await call('StartUnit', new GLib.Variant('(ss)', [UNIT, 'replace']), true);
}
