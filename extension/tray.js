// SPDX-License-Identifier: GPL-3.0-or-later
//
// Shows or hides the tray icon of the TUXEDO Control Center, the same way
// the "Tray autostart" item in its own tray menu does: the autostart entry
// ~/.config/autostart/tuxedo-control-center-tray.desktop exists or not (TCC
// copies it from its dist-data directory). On top of that, the running tray
// process is stopped or started, so the change applies right away instead
// of after the next login.
//
// Every start of the TCC app creates a tray icon as well, and closing its
// window leaves the process running in the tray. So while the tray is off,
// extension.js ends the TCC app once its last window closes (see
// tccMainPid() and terminate()).

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

function cmdline(pid) {
    const [, bytes] = GLib.file_get_contents(`/proc/${pid}/cmdline`);
    // Electron rewrites its argv into one space-separated string, so join
    // the arguments and compare the whole command line.
    return new TextDecoder().decode(bytes).split('\0').join(' ').trim();
}

/**
 * @param {number} pid process id of a window
 * @returns {number} the id of the TCC main process this pid belongs to, or 0
 *   if it is not part of the TCC app (Electron helpers carry `--type=`)
 */
export function tccMainPid(pid) {
    try {
        // Helpers can sit a few levels deep (gpu-process under zygote).
        for (let depth = 0; depth < 5 && pid > 1; depth++) {
            const line = cmdline(pid);
            if (!line.startsWith(TRAY_ARGS[0]))
                return 0;
            if (!line.includes('--type='))
                return pid;
            const [, status] = GLib.file_get_contents(`/proc/${pid}/status`);
            pid = Number(/^PPid:\s+(\d+)/m.exec(new TextDecoder().decode(status))?.[1] ?? 0);
        }
    } catch {
        // The process ended while we were looking.
    }
    return 0;
}

// Chromium, and so Electron, catches the first SIGTERM to shut down
// gracefully and then restores the default handler. TCC vetoes that
// shutdown while its tray is up, so only a second SIGTERM ends it. Run as
// its own process, so it also completes when the preferences close; the
// second signal only goes out if the pid still belongs to the TCC.
const TERMINATE_SCRIPT = `kill -TERM "$1" || exit 0
sleep 3
grep -qa "^${TRAY_ARGS[0]}" "/proc/$1/cmdline" 2>/dev/null && kill -TERM "$1"
exit 0`;

/**
 * Ends a TCC main process.
 *
 * @param {number} pid
 */
export function terminate(pid) {
    Gio.Subprocess.new(['sh', '-c', TERMINATE_SCRIPT, 'sh', String(pid)],
        Gio.SubprocessFlags.NONE);
}

// Process ids of running TCC main processes, started with `--tray` or as
// the app; either one shows the tray icon. Electron helpers are left out.
function tccPids() {
    const pids = [];
    const proc = Gio.File.new_for_path('/proc');
    const children = proc.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
    for (const info of children) {
        const name = info.get_name();
        if (!/^\d+$/.test(name))
            continue;
        try {
            const line = cmdline(name);
            if (line.startsWith(TRAY_ARGS[0]) && !line.includes('--type='))
                pids.push(Number(name));
        } catch {
            // The process ended while we were looking.
        }
    }
    children.close(null);
    return pids;
}

/**
 * Removes the autostart entry and ends the running tray icon, whether it
 * was started with `--tray` or along with the app. An open TCC window
 * belongs to the same process and closes as well.
 */
export function hide() {
    try {
        autostartFile().delete(null);
    } catch (e) {
        if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
            throw e;
    }
    for (const pid of tccPids())
        terminate(pid);
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
    if (!tccPids().length)
        GioUnix.DesktopAppInfo.new_from_filename(file.get_path()).launch([], null);
}
