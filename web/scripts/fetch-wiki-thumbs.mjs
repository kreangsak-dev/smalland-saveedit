/**
 * Download item/pet thumbnails from https://smallandsurvivethewilds.wiki.gg/
 * into web/public/wiki-thumbs/ using wiki File names (e.g. Wood.png).
 *
 * Keep ITEM_OVERRIDES in sync with web/src/lib/wikiImages.ts (ITEM_FILE_OVERRIDES).
 *
 * Usage:
 *   pnpm run fetch-thumbs
 *     → uses Go API (API_BASE, default http://127.0.0.1:3000) for /api/items + /api/pets,
 *       downloads each distinct wiki filename.
 *
 *   pnpm run fetch-thumbs -- --all-wiki
 *     → paginates MediaWiki list=allimages (no local API). Many files; long run.
 *
 *   pnpm run fetch-thumbs -- --dry-run
 *     → print actions only.
 *
 * Env: API_BASE, THUMB_DELAY_MS (default 120), WIKI_THUMB_WIDTH (default 128)
 */
import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const WIKI = 'https://smallandsurvivethewilds.wiki.gg';
const API_BASE = (process.env.API_BASE || 'http://127.0.0.1:3000').replace(/\/$/, '');
const DELAY_MS = Number(process.env.THUMB_DELAY_MS || 120);
const THUMB_W = Math.min(512, Math.max(32, Number(process.env.WIKI_THUMB_WIDTH || 128)));

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** @type {Record<string, string>} sync with wikiImages.ts ITEM_FILE_OVERRIDES */
const ITEM_OVERRIDES = {
  Coin: 'Hoots',
  'Firesand Grenade': 'Firesand Bomb',
  'Staff Wyrdweaver': 'Wyrdweaver',
};

function wikiPngFileName(displayName) {
  const base = String(displayName).trim().replace(/ /g, '_');
  return `${base}.png`;
}

function toWikiFileBase(displayName) {
  const t = ITEM_OVERRIDES[displayName] ?? displayName;
  return wikiPngFileName(t);
}

function stripPetLabel(petLabel) {
  return String(petLabel)
    .replace(/^[\s\uFE0F\u200D]+/g, '')
    .replace(/^(\p{Extended_Pictographic}[\uFE0F\u200D]*)+/gu, '')
    .trim();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function apiImageThumbUrl(fileBase) {
  const title = 'File:' + fileBase;
  const u = new URL(`${WIKI}/api.php`);
  u.searchParams.set('action', 'query');
  u.searchParams.set('format', 'json');
  u.searchParams.set('titles', title);
  u.searchParams.set('prop', 'imageinfo');
  u.searchParams.set('iiprop', 'url');
  u.searchParams.set('iiurlwidth', String(THUMB_W));

  const r = await fetch(u, {
    headers: {
      'User-Agent': UA,
      Accept: 'application/json,text/javascript,*/*;q=0.1',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: `${WIKI}/`,
    },
  });
  if (!r.ok) throw new Error(`MediaWiki api.php HTTP ${r.status}`);
  const j = await r.json();
  const pages = j.query?.pages ?? {};
  for (const p of Object.values(pages)) {
    if (p.missing != null) continue;
    const ii = p.imageinfo?.[0];
    if (ii?.thumburl) return ii.thumburl;
    if (ii?.url) return ii.url;
  }
  return null;
}

async function downloadImageBytes(imageUrl, wikiFileBase) {
  const title = String(wikiFileBase).trim().replace(/ /g, '_');
  const ref = `${WIKI}/wiki/File:${title}`;
  const r = await fetch(imageUrl, {
    headers: {
      'User-Agent': UA,
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: ref,
      'Sec-Fetch-Dest': 'image',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Site': 'cross-site',
    },
  });
  if (!r.ok) throw new Error(`image HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 24) throw new Error('image too small');
  return buf;
}

async function fetchCatalogFileBases() {
  const itemsRes = await fetch(`${API_BASE}/api/items`);
  if (!itemsRes.ok) throw new Error(`${API_BASE}/api/items → HTTP ${itemsRes.status}`);
  const payload = await itemsRes.json();
  const items = Array.isArray(payload) ? payload : (payload.items ?? []);

  const petsRes = await fetch(`${API_BASE}/api/pets`);
  const pets = petsRes.ok ? await petsRes.json() : { classes: [] };

  const files = new Set();
  for (const it of items) {
    if (it?.name) files.add(toWikiFileBase(it.name));
  }
  for (const c of pets.classes ?? []) {
    if (c?.name) {
      const stripped = stripPetLabel(c.name);
      files.add(toWikiFileBase(stripped || c.name));
    }
  }
  return [...files].sort();
}

async function fetchAllWikiImages() {
  const out = [];
  /** @type {Record<string, string>} */
  let continueParams = {};
  for (;;) {
    const u = new URL(`${WIKI}/api.php`);
    u.searchParams.set('action', 'query');
    u.searchParams.set('format', 'json');
    u.searchParams.set('list', 'allimages');
    u.searchParams.set('ailimit', '500');
    for (const [k, v] of Object.entries(continueParams)) {
      u.searchParams.set(k, v);
    }

    const r = await fetch(u, {
      headers: {
        'User-Agent': UA,
        Accept: 'application/json',
        Referer: `${WIKI}/`,
      },
    });
    if (!r.ok) throw new Error(`allimages HTTP ${r.status}`);
    const j = await r.json();
    const batch = j.query?.allimages ?? [];
    for (const im of batch) {
      if (im?.name) out.push({ name: im.name, url: im.url });
    }
    const next = j.continue;
    if (!next) break;
    continueParams = { ...next };
    await sleep(DELAY_MS);
  }
  return out;
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const allWiki = argv.includes('--all-wiki');

  const outDir = join(__dirname, '..', 'public', 'wiki-thumbs');
  await mkdir(outDir, { recursive: true });

  if (allWiki) {
    console.log('Listing all wiki images (this may take a while)…');
    const list = await fetchAllWikiImages();
    console.log(`Found ${list.length} files on wiki.`);
    let ok = 0;
    let skip = 0;
    for (const { name, url } of list) {
      if (!url) {
        skip++;
        continue;
      }
      const dest = join(outDir, name);
      if (dryRun) {
        console.log('[dry-run] would download', name);
        ok++;
        continue;
      }
      try {
        const buf = await downloadImageBytes(url, name);
        await writeFile(dest, buf);
        ok++;
      } catch (e) {
        console.warn('skip', name, e.message);
        skip++;
      }
      await sleep(DELAY_MS);
    }
    console.log(`all-wiki: wrote ${ok}, skipped ${skip} → ${outDir}`);
    return;
  }

  const bases = await fetchCatalogFileBases();
  console.log(`Catalog: ${bases.length} distinct wiki filenames (from ${API_BASE}).`);

  let ok = 0;
  let skip = 0;
  for (const fileBase of bases) {
    if (dryRun) {
      console.log('[dry-run]', fileBase);
      ok++;
      continue;
    }
    try {
      const thumb = await apiImageThumbUrl(fileBase);
      if (!thumb) {
        console.warn('no file on wiki:', fileBase);
        skip++;
        continue;
      }
      const buf = await downloadImageBytes(thumb, fileBase);
      const dest = join(outDir, fileBase);
      await writeFile(dest, buf);
      ok++;
    } catch (e) {
      console.warn('skip', fileBase, e.message);
      skip++;
    }
    await sleep(DELAY_MS);
  }
  console.log(`Catalog fetch: wrote ${ok}, skipped ${skip} → ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
