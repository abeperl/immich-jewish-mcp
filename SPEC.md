# immich-jewish-mcp Spec

`immich-jewish-mcp` is a BYO self-host MCP server that wraps a user's own Immich REST API so Claude can help organize family photos around Jewish lifecycle events and holidays. The first release is intentionally local-client only: the user supplies their Immich URL and API key in their own MCP client configuration, the server talks directly from that client environment to their Immich instance, and this project does not host infrastructure, proxy traffic, or store credentials.

## Tool surface

- `search_assets(query?, event_type?, start_date?, end_date?, limit?)`: search Immich assets using text/date metadata and optional Jewish lifecycle taxonomy ids such as `bar_mitzvah`, `bris`, `upsherin`, `vort`, or `pesach`.
- `list_albums()`: list existing Immich albums so Claude can inspect organization state before changing anything.
- `list_assets(album_id?, limit?)`: list recent/searchable assets, or assets in a specific album.
- `create_album(album_name, description?, asset_ids?)`: create a user-owned Immich album, optionally with reviewed asset ids.
- `label_album(album_id, album_name?, description?, add_asset_ids?)`: rename/describe an album and/or add selected assets after user review.
- `suggest_lifecycle_tags(text, include_taxonomy?)`: local semantic helper that maps album names, filenames, captions, or notes to Jewish lifecycle tags via the bundled taxonomy data file.

## Jewish-lifecycle taxonomy

The bundled taxonomy lives in `src/data/jewish-lifecycle-taxonomy.ts` and includes event ids, display labels, aliases, and keywords for bris/brit milah, baby naming/simchat bat, pidyon haben, upsherin/chalaka, bar mitzvah, bat mitzvah, vort/engagement, wedding, sheva brachot, Pesach, Sukkot, Chanukah, Purim, and Rosh Hashanah. It is deliberately transparent and editable so families can add minhag- or language-specific terms later.

## Auth and privacy model

Auth is environment-passed only. Users configure `IMMICH_BASE_URL` and `IMMICH_API_KEY` in their own MCP client (Claude Desktop, Cursor, etc.). The server reads those env vars at runtime and sends `x-api-key` directly to the user's Immich REST API. We do not operate a managed service, collect API keys, persist credentials, log secrets, sync photos, or store thumbnails/assets outside Immich.

## Out of scope for this scaffold

Managed hosting, OAuth, credential vaulting, hosted onboarding, multi-tenant accounts, background indexing, face recognition, thumbnail storage, photo export, irreversible bulk edits, and any managed Immich bundle are deferred. This scaffold also avoids claiming perfect semantic classification; lifecycle tagging is an assistive taxonomy and search layer, with user review expected before album mutations.

---

## Semantic lifecycle layer (v0.2 — Task 3)

### New tools

#### `suggest_lifecycle_albums`
Analyses a set of Immich assets (by asset ids, album id, or search query) and returns advisory lifecycle event suggestions. No writes occur. Signals used:
- **Date matching**: `localDateTime`/`fileCreatedAt` from Immich compared against pre-computed Jewish holiday windows (2015–2030) for Pesach, Sukkot, Chanukah, Purim, Rosh Hashanah, Shavuot.
- **Keyword matching**: filenames, paths, captions matched against taxonomy aliases/keywords.
- **Date clustering**: photos within 3 days form one event candidate.
- **Album-level hints**: album name/description checked against taxonomy when provided.

Suggestions include `confidence` (high/medium/low), `reasoning` list, `suggestedAlbumName`, `dateRange`, and a ready-to-use `pendingAction` for `label_event`.

#### `label_event`
Creates (or previews) a lifecycle event album in Immich. `confirm=false` (default) returns a dry-run preview. `confirm=true` calls `create_album` with the auto-generated or user-specified name. Accepts `person_name`, `year`, `custom_album_name`, and `description` to customise the album title.

#### `get_exif_info`
Shells out to `exiftool` (must be installed separately) to extract `dateTime`, GPS coordinates, city, country, and camera info from a local file. Useful for photos not yet in Immich.

### Implementation files
- `src/jewish-calendar.ts` — Holiday window lookup table (2015–2030) and date-match helper
- `src/semantic-lifecycle.ts` — `analyzeAssets()`, `buildLabelEventPreview()`, `extractExif()`, `exiftoolAvailable()`

### System dependency
`exiftool` (linuxbrew/homebrew or apt) is required only for `get_exif_info`. All other tools use Immich API metadata exclusively.
