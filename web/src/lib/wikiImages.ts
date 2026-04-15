/**
 * Item / pet icons: PNG (or other static) files under `web/public/wiki-thumbs/`,
 * served as `/wiki-thumbs/…`. If a file is missing, UI uses `MISSING_THUMB_URL`.
 */

/** Shared fallback when no file exists in `/wiki-thumbs/`. */
export const MISSING_THUMB_URL = "/no-thumb.svg";

export const LOCAL_WIKI_THUMB_BASE = "/wiki-thumbs";

/**
 * In-game display name → file basename (spaces → underscores).
 * Override when your bundled filename differs from the display label.
 */
const ITEM_FILE_OVERRIDES: Record<string, string> = {
  Coin: "Hoots",
  "Firesand Grenade": "Firesand Bomb",
  "Staff Wyrdweaver": "Wyrdweaver",
};

/** Pet display label (after emoji strip) → wiki thumb stem; passed through `pngFileName`. */
const PET_FILE_OVERRIDES: Record<string, string> = {
  "Blue Tit (Domesticated)": "Blue Tit",
  "Blue Tit Domesticated": "Blue Tit",
  "Albino Scorpion (Wyrdweaver)": "Wyrd-Crazed Albino Scorpion",
  "Albino Scorpion Comp Wyrdweaver": "Wyrd-Crazed Albino Scorpion",
  "Hawk (Eadric)": "Golden Eagle",
};

function pngFileName(displayName: string): string {
  const base = displayName.trim().replace(/ /g, "_");
  return `${base}.png`;
}

export function getWikiThumbFileName(displayName: string): string {
  const title = ITEM_FILE_OVERRIDES[displayName] ?? displayName;
  return pngFileName(title);
}

export function getLocalWikiThumbUrl(displayName: string): string {
  const file = getWikiThumbFileName(displayName);
  return `${LOCAL_WIKI_THUMB_BASE}/${encodeURIComponent(file)}`;
}

/** Same as local thumb URL (no remote fetch). */
export function getWikiItemImageUrl(displayName: string): string {
  return getLocalWikiThumbUrl(displayName);
}

export function stripPetLabelForWikiThumb(petLabel: string): string {
  return petLabel
    .replace(/^[\s\uFE0F\u200D]+/g, "")
    .replace(/^(\p{Extended_Pictographic}[\uFE0F\u200D]*)+/u, "")
    .trim();
}

/** Label shown in UI → basename used for `/wiki-thumbs/<name>.png` (includes item overrides). */
export function resolvePetWikiThumbLabel(petLabel: string): string {
  const stripped = stripPetLabelForWikiThumb(petLabel) || petLabel;
  return PET_FILE_OVERRIDES[stripped] ?? stripped;
}

export function getWikiPetImageUrl(petLabel: string): string {
  return getLocalWikiThumbUrl(resolvePetWikiThumbLabel(petLabel));
}
