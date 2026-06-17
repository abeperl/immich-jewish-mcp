# immich-jewish-mcp (KolAlbum MCP)

[![npm version](https://img.shields.io/npm/v/immich-jewish-mcp.svg)](https://www.npmjs.com/package/immich-jewish-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A BYO MCP (Model Context Protocol) server for organizing a self-hosted [Immich](https://immich.app/) photo library by Jewish lifecycle events and holidays: bar mitzvah, bat mitzvah, bris, upsherin, vort, wedding, Pesach, Sukkot, Chanukah, Purim, Rosh Hashanah, and more.

> **You supply your own Immich URL and API key.**
> This server runs as a local process on your own machine — it never contacts external servers, stores your credentials, or proxies your photos anywhere.

## Privacy & data-handling disclosure

- **Your photos stay on your own Immich server.** This MCP server only reads photo metadata (dates, filenames, EXIF) and creates/renames albums. It never downloads, copies, or uploads photo files.
- **Your API key lives only in your MCP client config.** It is read from environment variables at each tool call and never written to disk, logged, or cached by this server.
- **No external services are contacted.** Holiday calendar logic is pre-computed and bundled locally. No third-party APIs are called.
- **No telemetry.** This package contains zero analytics, crash reporting, or usage tracking.
- **This is not a managed service.** You run the server; you own the data.

## Features

- Search Immich assets by metadata/date and lifecycle context
- List albums and album assets
- Create or label albums after user review
- **Suggest Jewish lifecycle event album groupings** from EXIF dates, Jewish calendar windows, and filename/caption keywords
- **Label photos as lifecycle events** (advisory only — user confirms before any album is created)
- Extract EXIF metadata from local files via exiftool
- Suggest lifecycle tags from free text (album names, filenames, captions, notes)
- Transparent taxonomy in `src/data/jewish-lifecycle-taxonomy.ts` — editable for minhag-specific terms

## Installation

```bash
npm install -g immich-jewish-mcp
```

Or run directly with npx after publishing:

```bash
npx immich-jewish-mcp
```

### System dependency: exiftool

For the `get_exif_info` tool (local file EXIF extraction), install exiftool:

```bash
# macOS / linuxbrew
brew install exiftool

# Debian / Ubuntu
sudo apt install libimage-exiftool-perl
```

The rest of the tools (Immich API tools and semantic analysis of Immich assets) work without exiftool since Immich already exposes EXIF data via its API.

## Configuration

Create an Immich API key in your own Immich account, then add this server to your MCP client config.

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS or `%AppData%\Claude\claude_desktop_config.json` on Windows:

```json
{
  "mcpServers": {
    "immich-jewish": {
      "command": "npx",
      "args": ["-y", "immich-jewish-mcp"],
      "env": {
        "IMMICH_BASE_URL": "https://photos.example.com",
        "IMMICH_API_KEY": "your-immich-api-key"
      }
    }
  }
}
```

For local development:

```json
{
  "mcpServers": {
    "immich-jewish": {
      "command": "node",
      "args": ["/home/openclaw/projects/immich-jewish-mcp/dist/index.js"],
      "env": {
        "IMMICH_BASE_URL": "https://photos.example.com",
        "IMMICH_API_KEY": "your-immich-api-key"
      }
    }
  }
}
```

## Tools

### Immich plumbing

| Tool | Description |
|------|-------------|
| `search_assets` | Search Immich assets with optional `event_type`, date bounds, and limit. |
| `list_albums` | List Immich albums. |
| `list_assets` | List assets globally or for a specific `album_id`. |
| `create_album` | Create an album, optionally seeded with reviewed asset ids. |
| `label_album` | Rename/describe an album and/or add assets. |

### Semantic lifecycle layer

| Tool | Description |
|------|-------------|
| `suggest_lifecycle_albums` | Analyse Immich assets and suggest Jewish lifecycle event album groupings using EXIF dates, holiday calendar windows, and filename/caption keyword matching. Advisory only — nothing is written until the user confirms. |
| `label_event` | Preview or create a lifecycle event album. Use `confirm=false` (default) to preview; `confirm=true` to actually create the album after user review. |
| `get_exif_info` | Extract EXIF metadata (date, GPS, camera) from a local file using exiftool. |
| `suggest_lifecycle_tags` | Return matching lifecycle taxonomy entries for any text snippet. |

## Example workflow

```
1. list_albums()              → see existing album names
2. suggest_lifecycle_albums(album_id="abc123")
   → [{ eventId: "bar_mitzvah", confidence: "high", suggestedAlbumName: "Bar Mitzvah — 2025", ... }]
3. label_event(event_type="bar_mitzvah", asset_ids=[...], person_name="Levi", year="2025", confirm=false)
   → preview: { albumName: "Bar Mitzvah — Levi — 2025", assetCount: 47 }
4. [User reviews and approves]
5. label_event(..., confirm=true)  → album created in Immich
```

## Semantic analysis logic

`suggest_lifecycle_albums` combines three signals:

1. **Jewish holiday calendar** — EXIF/Immich dates are compared against pre-computed holiday windows for 2015–2030 (Pesach, Sukkot, Chanukah, Purim, Rosh Hashanah, Shavuot).
2. **Keyword matching** — filenames, paths, captions, and album names are matched against the lifecycle taxonomy's aliases and keywords (e.g. "menorah", "haftarah", "bedeken").
3. **Date clustering** — photos within 3 days of each other form a single event candidate, helping surface multi-day celebrations.

Suggestions are scored and ranked (high/medium/low confidence). All suggestions are advisory — the user confirms before any album is created or modified.

## Jewish lifecycle taxonomy

Events covered: bris/brit milah, baby naming/simchat bat, pidyon haben, upsherin/chalaka, bar mitzvah, bat mitzvah, vort/engagement, wedding/chasunah, sheva brachot, Pesach/Passover, Sukkot, Chanukah, Purim, Rosh Hashanah, Shavuot.

The taxonomy lives in `src/data/jewish-lifecycle-taxonomy.ts` and is deliberately transparent and editable so families can add minhag- or language-specific aliases later.

## Development

```bash
git clone https://github.com/abeperl/immich-jewish-mcp.git
cd immich-jewish-mcp
npm install
npm run build
npm run lint
```

### Running unit tests

```bash
npm test
```

Runs 44 tests covering the taxonomy, Jewish holiday calendar, semantic asset analysis, label-event preview builder, and the full QA gate (non-destructive checks, auth isolation, correctness).

### QA gate (offline, no Immich needed)

```bash
npm run test:qa
```

Runs 21 dedicated QA tests covering the three pre-publish concerns:
1. **Non-destructive** — no DELETE endpoint, confirm=false is the default, previews leave nothing behind
2. **Auth isolation** — credentials from env only, never persisted, graceful errors on missing config
3. **Correctness** — bris, vort, bar mitzvah, Pesach, Chanukah detected from realistic filenames/dates; generic photos produce no spurious high-confidence suggestions

See [`QA_REPORT.md`](./QA_REPORT.md) for the full pass/fail report with reproduction steps.

### Integration tests against a local Immich instance

A Docker Compose file for a throwaway Immich test instance lives in `immich-test-env/docker-compose.yml`.

```bash
# Start the test instance (postgres, redis, immich-server)
cd immich-test-env && docker compose up -d

# Bootstrap: create admin user, API key, and upload 6 test photos
cd .. && ./scripts/qa-bootstrap.sh
# → prints IMMICH_BASE_URL=http://localhost:2283 and IMMICH_API_KEY=<key>

# Run QA gate + live integration tests
export IMMICH_BASE_URL=http://localhost:2283
export IMMICH_API_KEY=<key from above>
npm run test:qa
# or: npm run test:integration  (same thing, env already set)

# Tear down
cd immich-test-env && docker compose down -v
```

Live tests cover: `list_albums`, `create_album`, `list_assets`, `search_assets`, `suggest_lifecycle_albums` (semantic analysis on live assets), and auth-error handling.

## License

MIT
