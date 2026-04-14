/**
 * Default Smalland player saves on Windows (paste into File Explorer address bar).
 * Browsers cannot set the native file dialog's starting directory to an arbitrary path.
 */
export const SMALLAND_WINDOWS_SAVE_FOLDER =
  String.raw`%LOCALAPPDATA%\SMALLAND\Saved\SaveGames\Players`;

export type PickPlrResult =
  | { kind: 'file'; file: File }
  | { kind: 'aborted' }
  | { kind: 'unsupported' };

/**
 * Always use the OS file dialog via `<input type="file">` (see App).
 *
 * Chromium's `showOpenFilePicker` blocks folders under %LOCALAPPDATA% as "system files",
 * which is exactly where Smalland stores .plr saves — so that API cannot be used here.
 */
export async function pickPlrFile(): Promise<PickPlrResult> {
  return { kind: 'unsupported' };
}

export async function copySmallandSaveFolderPath(): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(SMALLAND_WINDOWS_SAVE_FOLDER);
    return true;
  } catch {
    return false;
  }
}
