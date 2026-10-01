// SPDX-License-Identifier: GPL-3.0-or-later
//
// Thin client for the TUXEDO Control Center daemon (tccd) on the system bus.
// Deliberately free of GNOME Shell imports so prefs.js can use it as well.
//
// tccd hands out everything as JSON strings and emits no signal when the
// active profile changes (neither for its own AC/battery switch nor for a
// change made in the TCC app), so callers have to poll getActiveProfile().

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export const BUS_NAME = 'com.tuxedocomputers.tccd';
const OBJECT_PATH = '/com/tuxedocomputers/tccd';
const INTERFACE = 'com.tuxedocomputers.tccd';

const CALL_TIMEOUT_MS = 5000;

// GNOME Shell promisifies this already, the prefs process does not.
Gio._promisify(Gio.DBusConnection.prototype, 'call');

async function call(method, params = null) {
    const reply = await Gio.DBus.system.call(
        BUS_NAME, OBJECT_PATH, INTERFACE, method, params, null,
        Gio.DBusCallFlags.NO_AUTO_START, CALL_TIMEOUT_MS, null);
    return reply.deepUnpack()[0];
}

async function callJson(method) {
    return JSON.parse(await call(method));
}

/**
 * @returns {Promise<object[]>} default and custom profiles, as tccd lists them
 */
export function getProfiles() {
    return callJson('GetProfilesJSON');
}

/**
 * @returns {Promise<object>} the profile tccd currently applies
 */
export function getActiveProfile() {
    return callJson('GetActiveProfileJSON');
}

/**
 * @returns {Promise<object>} tccd settings, incl. stateMap {power_ac, power_bat}
 */
export function getSettings() {
    return callJson('GetSettingsJSON');
}

/**
 * Switches to a profile until the next power state change, exactly like the
 * profile menu of TCC's own tray icon. The profile assignment for AC and
 * battery in TCC stays untouched.
 *
 * @param {string} id profile id
 * @returns {Promise<boolean>} whether tccd accepted the profile
 */
export function setTempProfile(id) {
    return call('SetTempProfileById', new GLib.Variant('(s)', [id]));
}

/**
 * Calls back whenever tccd appears on or vanishes from the system bus.
 *
 * @param {(running: boolean) => void} callback
 * @returns {number} watch id for Gio.bus_unwatch_name()
 */
export function watch(callback) {
    return Gio.bus_watch_name(Gio.BusType.SYSTEM, BUS_NAME,
        Gio.BusNameWatcherFlags.NONE,
        () => callback(true),
        () => callback(false));
}

// Which of the three pulse icons (extension/icons, modelled on GNOME's three
// power modes) fits a profile. tccd profiles have no such category, so this
// guesses from the CPU and fan settings; the user can pin a category per
// profile in the preferences.
export const CATEGORIES = ['performance', 'balanced', 'power-saver'];

export function guessCategory(profile, profiles) {
    const cpu = profile.cpu ?? {};
    const fan = profile.fan?.fanProfile ?? '';
    const hwMax = Math.max(...profiles.map(p => p.cpu?.scalingMaxFrequency ?? 0));
    const ratio = hwMax > 0 && cpu.scalingMaxFrequency > 0
        ? cpu.scalingMaxFrequency / hwMax : 1;
    const allCores = Math.max(...profiles.map(p => p.cpu?.onlineCores ?? 0));

    if (cpu.useMaxPerfGov || cpu.governor === 'performance' ||
        cpu.energyPerformancePreference === 'performance')
        return 'performance';
    if (ratio <= 0.35 || fan === 'Silent' ||
        cpu.energyPerformancePreference === 'power' ||
        (cpu.noTurbo && ratio < 0.6) ||
        (allCores > 0 && cpu.onlineCores > 0 && cpu.onlineCores <= allCores / 2))
        return 'power-saver';
    if (ratio >= 0.95 && !cpu.noTurbo && fan !== 'Quiet')
        return 'performance';
    return 'balanced';
}

export function iconForCategory(category) {
    return `pulsgeber-${category}-symbolic`;
}

/**
 * @param {string} extensionPath directory of the installed extension
 * @param {string} category one of CATEGORIES
 * @returns {Gio.Icon} the pulse icon, loaded from the extension directory
 */
export function giconForCategory(extensionPath, category) {
    return Gio.FileIcon.new(Gio.File.new_for_path(
        `${extensionPath}/icons/hicolor/symbolic/status/${iconForCategory(category)}.svg`));
}
