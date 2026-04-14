# Smalland Web Save Editor

Web-based editor for **Smalland: Survive the Wilds** player saves (`.plr`). The Go backend unpacks and repacks the binary save format; the React frontend edits inventory, equipment, companions, and related fields.

## Requirements

- **Go** 1.25+ (see `go.mod`)
- **Node.js** and **pnpm** (see `web/package.json` for the pinned package manager)

## Quick start (development)

Run the API and the UI in two terminals. Both are needed: the UI proxies `/api/*` to the backend.

1. **Backend** (listens on `http://localhost:3000`):

   ```bash
   go run ./cmd/server
   ```

   Optional: use [Air](https://github.com/air-verse/air) for auto-rebuild (config in `.air.toml`):

   ```bash
   air
   ```

2. **Frontend** (from the `web` folder; default Vite port is usually `5173`):

   ```bash
   cd web
   pnpm install
   pnpm dev
   ```

   Open the URL Vite prints (e.g. `http://localhost:5173`). API calls go to `/api` and are proxied to port `3000` (see `web/vite.config.ts`).

## Save directory

The server decides where `.plr` files are read and written:

| Priority | Behavior |
|----------|-----------|
| `SMALLAND_UPLOAD_ONLY=1` (or `true` / `yes` / `on`) | No folder: upload `.plr` and download after edit only. |
| `SMALLAND_SAVE_DIR` set | Use that directory (absolute path after cleanup). |
| Windows, not upload-only, `LOCALAPPDATA` set | `%LOCALAPPDATA%\SMALLAND\Saved\SaveGames\Players` |
| Other platforms, no env | Upload-only (same as first row). |

The UI shows which mode is active via `/api/config`.

## Item and pet catalog

Display names and categories for the editor come from **`GET /api/items`** and **`GET /api/pets`**, built in Go from:

- `internal/catalog/items.go` — curated rows (your edits here **override** the same `class` in the embedded bulk list).
- `internal/catalog/items_fnames.json` — merged at startup; `items.go` wins on duplicate class paths.
- `internal/catalog/pets.go` — curated companion labels (emoji names). Merge order: `pets_fnames.json` → `pets_extra.json` → curated rows in `pets.go` (later wins on same `class`).
- **`pets_fnames.json`** — auto-extracted from `save-editor/FNames.txt` (`_generate_pet_classes_from_fnames.py`). The UEDumper name table often **does not include** full paths like `/Game/.../BP_Scorpion.BP_Scorpion_C` for many creatures (only materials, ABPs, or short names), so the scan only picks up a handful of Blueprint paths. Known-good paths that are missing from the dump stay in **`petClassesCurated`** or can be added to **`pets_extra.json`** as `{ "class": "...", "name": "..." }` and rebuilt.

After changing `items.go` (or other catalog sources), **rebuild and restart the Go server** so `init()` runs again. **Hard refresh** the browser so the React catalog provider refetches `/api/items`.

## Production build (frontend only)

```bash
cd web
pnpm build
```

Output is `web/dist`. Serving that folder together with the API is project-specific (the commented static routes in `cmd/server/main.go` show one option).

## Repository layout

| Path | Role |
|------|------|
| `cmd/server` | HTTP server entrypoint |
| `internal/routes` | REST API (saves, unpack/repack, catalog) |
| `internal/plr` | `.plr` unpack/repack |
| `internal/catalog` | Item/pet lists for the UI |
| `web/` | Vite + React + TypeScript UI |
| `save-editor/` | Reference Python scripts (legacy / tooling) |

## Credits

- **[Smalland: Survive the Wilds Wiki](https://smallandsurvivethewilds.wiki.gg/)** — item imagery and community reference data used in the editor UI (see `web/scripts/fetch-wiki-thumbs.mjs` and `web/public/wiki-thumbs/`).
