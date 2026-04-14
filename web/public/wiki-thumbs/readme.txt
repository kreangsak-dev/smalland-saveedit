PNG (and other) files here are loaded as /wiki-thumbs/<filename>.
Missing names fall back to /no-thumb.svg.

Download from wiki.gg (names match wiki File: pages, same rules as web/src/lib/wikiImages.ts):

 1) Start Go server, then from web/:
     pnpm run fetch-thumbs
     Uses /api/items + /api/pets, resolves each name to a wiki File (see ITEM_OVERRIDES in the script).

  2) Every uploaded image on the wiki (large download):
     pnpm run fetch-thumbs -- --all-wiki

  Options: --dry-run   Env: API_BASE, THUMB_DELAY_MS, WIKI_THUMB_WIDTH
