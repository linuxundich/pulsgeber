// SPDX-License-Identifier: GPL-3.0-or-later
//
// Shows or hides the tray icon of the TUXEDO Control Center, the same way
// the "Tray autostart" item in its own tray menu does. On top of that, the
// running tray is stopped or started, so the change applies right away
// instead of after the next login.
//
// TCC changed its autostart in version 3.1:
// - Up to 3.0, the tray starts if ~/.config/autostart/tuxedo-control-center-
//   tray.desktop exists; TCC copies it from its dist-data directory.
// - From 3.1 on, the package installs the entry to /etc/xdg/autostart and
//   TCC turns it off with an empty file of the same name in
//   ~/.config/autostart. gnome-session can't parse an empty file and starts
//   the tray anyway, so Pulsgeber writes a copy with Hidden=true instead.
//
// Every start of the TCC app creates a tray icon as well, and closing its
// window leaves the process running in the tray. So while the tray is off,
// extension.js ends the TCC app once its last window closes.

import Gio from 'gi://Gio';
import GioUnix from 'gi://GioUnix';
import GLib from 'gi://GLib';

// The app's desktop file, TCC 3.1 and later first.
export const DESKTOP_FILES = ['com.tuxedocomputers.tcc.desktop', 'tuxedo-control-center.desktop'];

const DESKTOP_FILE = 'tuxedo-control-center-tray.desktop';
const TEMPLATE = `/opt/tuxedo-control-center/resources/dist/tuxedo-control-center/data/dist-data/${DESKTOP_FILE}`;
const KEY_FILE_GROUP = 'Desktop Entry';

const SYSTEMD = 'org.freedesktop.systemd1';
const SYSTEMD_PATH = '/org/freedesktop/systemd1';
const MANAGER = 'org.freedesktop.systemd1.Manager';

// Electron moves itself into a systemd scope of its own on startup, whether
// started as the app or with --tray: app-tuxedo-control-center-<pid>.scope,
// from TCC 3.1 on app-com.tuxedocomputers.tcc-<pid>.scope. The scope GNOME
// starts it in (app-gnome-tuxedo\x2dcontrol\x2dcenter-<pid>.scope) keeps
// helper processes since TCC 3.1. All these forms are accepted.
const UNIT_PATTERNS = ['app-*tuxedo*control*center*.scope', 'app-*com.tuxedocomputers.tcc*.scope'];
const UNIT_REGEX = /^app-(gnome-)?(tuxedo-control-center(-tray)?|com\.tuxedocomputers\.tcc)-\d+\.scope$/;

// Chromium, and so Electron, catches the first SIGTERM to shut down
// gracefully. TCC vetoes that shutdown while its tray is up, so only a
// second SIGTERM ends it.
const SECOND_SIGTERM_SECONDS = 3;
const SIGTERM = 15;

function autostartFile() {
    return Gio.File.new_for_path(
        GLib.build_filenamev([GLib.get_user_config_dir(), 'autostart', DESKTOP_FILE]));
}

// The entry the package installs to /etc/xdg/autostart (TCC 3.1 and later).
function systemAutostartPath() {
    return GLib.get_system_config_dirs()
        .map(dir => GLib.build_filenamev([dir, 'autostart', DESKTOP_FILE]))
        .find(path => GLib.file_test(path, GLib.FileTest.EXISTS)) ?? null;
}

/**
 * @returns {boolean} whether this TCC installation has a tray icon at all
 */
export function isAvailable() {
    return systemAutostartPath() !== null || GLib.file_test(TEMPLATE, GLib.FileTest.EXISTS);
}

// Whether the user's entry turns the system-wide one off. An empty file, as
// TCC 3.1 writes it, does not: gnome-session ignores it.
function hidesSystemEntry(file) {
    const keyFile = new GLib.KeyFile();
    try {
        keyFile.load_from_file(file.get_path(), GLib.KeyFileFlags.NONE);
        return keyFile.get_boolean(KEY_FILE_GROUP, 'Hidden');
    } catch {
        return false;
    }
}

/**
 * @returns {boolean} whether the tray icon starts with the session
 */
export function isEnabled() {
    const file = autostartFile();
    if (systemAutostartPath() === null)
        return file.query_exists(null);
    return !file.query_exists(null) || !hidesSystemEntry(file);
}

function callSystemd(method, params, replyType, cancellable) {
    return Gio.DBus.session.call(SYSTEMD, SYSTEMD_PATH, MANAGER, method, params,
        replyType, Gio.DBusCallFlags.NO_AUTO_START, -1, cancellable);
}

// Names of the running TCC scopes, the app's and the tray's alike.
async function runningUnits(cancellable) {
    const reply = await callSystemd('ListUnitsByPatterns',
        new GLib.Variant('(asas)', [['active'], UNIT_PATTERNS]),
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
 * Turns the autostart entry off and ends the running tray icon, whether it
 * was started with `--tray` or along with the app. An open TCC window
 * belongs to the same process and closes as well.
 */
export async function hide() {
    const file = autostartFile();
    const systemPath = systemAutostartPath();
    if (systemPath) {
        // A copy of the system-wide entry, hidden. TCC's own menu shows the
        // tray as off as soon as the file exists.
        const keyFile = new GLib.KeyFile();
        keyFile.load_from_file(systemPath, GLib.KeyFileFlags.KEEP_TRANSLATIONS);
        keyFile.set_boolean(KEY_FILE_GROUP, 'Hidden', true);
        makeParent(file);
        keyFile.save_to_file(file.get_path());
    } else {
        deleteIfExists(file);
    }
    await terminate();
}

/**
 * Turns the autostart entry back on and starts the tray icon.
 */
export async function show() {
    const file = autostartFile();
    const systemPath = systemAutostartPath();
    if (systemPath) {
        deleteIfExists(file);
    } else {
        makeParent(file);
        Gio.File.new_for_path(TEMPLATE).copy(file, Gio.FileCopyFlags.OVERWRITE, null, null);
    }
    if (!(await runningUnits(null)).length)
        GioUnix.DesktopAppInfo.new_from_filename(systemPath ?? file.get_path()).launch([], null);
}

function makeParent(file) {
    try {
        file.get_parent().make_directory_with_parents(null);
    } catch (e) {
        if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS))
            throw e;
    }
}

function deleteIfExists(file) {
    try {
        file.delete(null);
    } catch (e) {
        if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
            throw e;
    }
}
