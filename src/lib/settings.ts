/**
 * The ONLY data segl. persists: non-personal UI preferences.
 * Document contents, file names, passwords and watermark texts are never written here.
 */
const PREFIX = 'segl.';
export const ALLOWED_SETTINGS = ['lang'] as const;
export type SettingKey = (typeof ALLOWED_SETTINGS)[number];

export function readSetting(key: SettingKey): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function writeSetting(key: SettingKey, value: string): void {
  try {
    window.localStorage.setItem(PREFIX + key, value);
  } catch {
    // Storage may be unavailable (private mode) – preferences are then simply not remembered.
  }
}
