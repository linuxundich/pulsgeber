// SPDX-License-Identifier: GPL-3.0-or-later
//
// Shows or hides the tray icon of the TUXEDO Control Center, the same way
// the "Tray autostart" item in its own tray menu does: the autostart entry
// ~/.config/autostart/tuxedo-control-center-tray.desktop exists or not (TCC
// copies it from its dist-data directory). On top of that, the running tray
// process is stopped or started, so the change applies right away instead
// of after the next login. Only used by prefs.js.

import Gio from 'gi://Gio';
import GioUnix from 'gi://GioUnix';
import GLib from 'gi://GLib';

const DESKTOP_FILE = 'tuxedo-control-center-tray.desktop';
const TCC_DIR = '/opt/tuxedo-control-center';
const TEMPLATE = `${TCC_DIR}/resources/dist/tuxedo-control-center/data/dist-data/${DESKTOP_FILE}`;
const TRAY_ARGS = [`${TCC_DIR}/tuxedo-control-center`, '--tray'];

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

// Process ids of running `tuxedo-control-center --tray` instances.
function trayPids() {
    const pids = [];
    const proc = Gio.File.new_for_path('/proc');
    const children = proc.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
    for (const info of children) {
        const name = info.get_name();
        if (!/^\d+$/.test(name))
            continue;
        try {
            const [, bytes] = GLib.file_get_contents(`/proc/${name}/cmdline`);
            // Electron rewrites its argv into one space-separated string,
            // so compare the whole command line rather than single args.
            const cmdline = new TextDecoder().decode(bytes).split('\0').join(' ').trim();
            if (cmdline === TRAY_ARGS.join(' '))
                pids.push(Number(name));
        } catch {
            // The process ended while we were looking.
        }
    }
    children.close(null);
    return pids;
}

/**
 * Removes the autostart entry and ends the running tray icon. An open TCC
 * window belongs to the same process and closes as well.
 */
export function hide() {
    try {
        autostartFile().delete(null);
    } catch (e) {
        if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
            throw e;
    }
    for (const pid of trayPids())
        Gio.Subprocess.new(['kill', '-TERM', String(pid)], Gio.SubprocessFlags.NONE);
}

/**
 * Restores the autostart entry from TCC's template and starts the tray icon.
 */
export function show() {
    const file = autostartFile();
    try {
        file.get_parent().make_directory_with_parents(null);
    } catch (e) {
        if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS))
            throw e;
    }
    Gio.File.new_for_path(TEMPLATE).copy(file, Gio.FileCopyFlags.OVERWRITE, null, null);
    if (!trayPids().length)
        GioUnix.DesktopAppInfo.new_from_filename(file.get_path()).launch([], null);
}
