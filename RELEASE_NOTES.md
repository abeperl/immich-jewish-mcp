# KolAlbum MCP v1.0.0

First public release of `immich-jewish-mcp` — a BYO MCP server for organizing your self-hosted [Immich](https://immich.app/) photo library by Jewish lifecycle events.

## Install

```bash
npm install -g immich-jewish-mcp
# or: npx immich-jewish-mcp
```

## Claude Desktop config

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%AppData%\Claude\claude_desktop_config.json` (Windows):

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

> **You supply your own Immich URL and API key.** Create an API key in Immich → Account Settings → API Keys.

## What's included

### Immich plumbing tools
- `search_assets` — search by metadata, date range, or lifecycle event type
- `list_albums` / `list_assets` — browse your library
- `create_album` / `label_album` — create and organize albums

### Semantic lifecycle layer
- `suggest_lifecycle_albums` — analyzes EXIF dates, filenames, and captions against the Jewish holiday calendar and lifecycle taxonomy; returns advisory suggestions with confidence scores
- `label_event` — preview or create a lifecycle event album (`confirm=false` by default — nothing is written without explicit approval)
- `get_exif_info` — extract EXIF metadata from local files via exiftool
- `suggest_lifecycle_tags` — return matching taxonomy entries for any text snippet

### Events covered
Bris/brit milah, baby naming/simchat bat, pidyon haben, upsherin/chalaka, bar mitzvah, bat mitzvah, vort/engagement, chasunah/wedding, sheva brachot, Pesach, Sukkot, Chanukah, Purim, Rosh Hashanah, Shavuot.

### Holiday calendar
Pre-computed Gregorian → Jewish holiday windows for 2015–2030. No external API calls.

## Privacy & data-handling

- **Your photos stay on your own Immich server.** This server only reads photo metadata (dates, filenames, EXIF) and creates/renames albums.
- **Your API key lives only in your MCP client config.** It is read from environment variables at each tool call and never written to disk, logged, or cached.
- **No external services contacted.** All logic runs locally.
- **Non-destructive by default.** All lifecycle suggestions have `confirm=false`. No album is created without explicit user confirmation.

## QA

44 unit tests + 28 QA gate tests (21 offline, 7 live against Docker-hosted Immich v2.7.5). Zero failures.

See [QA_REPORT.md](./QA_REPORT.md) for full results.
