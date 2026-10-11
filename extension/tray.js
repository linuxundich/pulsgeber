// SPDX-License-Identifier: GPL-3.0-or-later
//
// Shows or hides the tray icon of the TUXEDO Control Center, the same way
// the "Tray autostart" item in its own tray menu does: the autostart entry
// ~/.config/autostart/tuxedo-control-center-tray.desktop exists or not (TCC
// copies it from its dist-data directory). On top of that, the running tray
// is stopped or started, so the change applies right away instead of after
// the next login.
//
// Every start of the TCC app creates a tray icon as well, and closing its
// window leaves the process running in the tray. So while the tray is off,
// extension.js ends the TCC app once its last window closes.

import Gio from 'gi://Gio';
import GioUnix from 'gi://GioUnix';
import GLib from 'gi://GLib';

const DESKTOP_FILE = 'tuxedo-control-center-tray.desktop';
const TEMPLATE = `/opt/tuxedo-control-center/resources/dist/tuxedo-control-center/data/dist-data/${DESKTOP_FILE}`;

const SYSTEMD = 'org.freedesktop.systemd1';
const SYSTEMD_PATH = '/org/freedesktop/systemd1';
const MANAGER = 'org.freedesktop.systemd1.Manager';

// Electron moves itself into a systemd scope of its own on startup,
// app-tuxedo-control-center-<pid>.scope, whether started as the app or with
// --tray. The scope GNOME starts it in (app-gnome-tuxedo\x2dcontrol\x2dcenter-
// <pid>.scope) is left empty. Both forms are accepted.
const UNIT_PATTERN = 'app-*tuxedo*control*center*.scope';
const UNIT_REGEX = /^app-(gnome-)?tuxedo-control-center(-tray)?-\d+\.scope$/;

// Chromium, and so Electron, catches the first SIGTERM to shut down
// gracefully. TCC vetoes that shutdown while its tray is up, so only a
// second SIGTERM ends it.
const SECOND_SIGTERM_SECONDS = 3;
const SIGTERM = 15;

function autostartFile() {
    return Gio.File.new_for_path(
        GLib.build_filenamev([GLib.get_user_config_dir(), 'autostart', DESKTOP_FILE]));
}

/**
 * @returns {boolean} whether this TCC installation has a tray icon at all
 */
export function isAvailable() {
    return GLib.file_test(TEMPLATE, GLib.FileTest.EXISTS);
}

/**
 * @returns {boolean} whether the tray icon starts with the session
 */
export function isEnabled() {
    return autostartFile().query_exists(null);
}

function callSystemd(method, params, replyType, cancellable) {
    return Gio.DBus.session.call(SYSTEMD, SYSTEMD_PATH, MANAGER, method, params,
        replyType, Gio.DBusCallFlags.NO_AUTO_START, -1, cancellable);
}

// Names of the running TCC scopes, the app's and the tray's alike.
async function runningUnits(cancellable) {
    const reply = await callSystemd('ListUnitsByPatterns',
        new GLib.Variant('(asas)', [['active'], [UNIT_PATTERN]]),
        new GLib.VariantType('(a(ssssssouso))'), cancellable);
    const [units] = reply.deepUnpack();
    return units.map(([name]) => name)
        .filter(name => UNIT_REGEX.test(name.replaceAll('\\x2d', '-')));
}

async function sigterm(units, cancellable) {
    await Promise.all(units.map(unit => callSystemd('KillUnit',
        new GLib.Variant('(ssi)', [unit, 'all', SIGTERM]), null, cancellable)
        .catch(e => {
            // The scope is gone already: TCC has ended.
            if (Gio.DBusError.get_remote_error(e) !== 'org.freedesktop.systemd1.NoSuchUnit')
                throw e;
        })));
}

function wait(seconds, cancellable) {
    return new Promise(resolve => {
        const id = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, seconds, () => {
            cancellable?.disconnect(cancelledId);
            resolve();
            return GLib.SOURCE_REMOVE;
        });
        // Removes the timeout when the extension is disabled meanwhile.
        const cancelledId = cancellable?.connect('cancelled', () => {
            GLib.source_remove(id);
            resolve();
        });
    });
}

/**
 * Ends the TCC app and its tray icon, through systemd.
 *
 * @param {Gio.Cancellable} [cancellable]
 */
export async function terminate(cancellable = null) {
    const units = await runningUnits(cancellable);
    if (!units.length)
        return;
    await sigterm(units, cancellable);
    await wait(SECOND_SIGTERM_SECONDS, cancellable);
    if (!cancellable?.is_cancelled())
        await sigterm(units, cancellable);
}

/**
 * Removes the autostart entry and ends the running tray icon, whether it
 * was started with `--tray` or along with the app. An open TCC window
 * belongs to the same process and closes as well.
 */
export async function hide() {
    try {
        autostartFile().delete(null);
    } catch (e) {
        if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
            throw e;
    }
    await terminate();
}

/**
 * Restores the autostart entry from TCC's template and starts the tray icon.
 */
export async function show() {
    const file = autostartFile();
    try {
        file.get_parent().make_directory_with_parents(null);
    } catch (e) {
        if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS))
            throw e;
    }
    Gio.File.new_for_path(TEMPLATE).copy(file, Gio.FileCopyFlags.OVERWRITE, null, null);
    if (!(await runningUnits(null)).length)
        GioUnix.DesktopAppInfo.new_from_filename(file.get_path()).launch([], null);
}
