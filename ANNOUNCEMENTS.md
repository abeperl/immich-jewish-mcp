# KolAlbum MCP — Announcements & Registry Submissions

## npm publish

```bash
cd immich-jewish-mcp
npm publish --access public
# Package: immich-jewish-mcp@1.0.0
# URL: https://www.npmjs.com/package/immich-jewish-mcp
```

> **Note:** The npm token in `~/.npmrc` may need refreshing. Log in with `npm login` (npm account: `abep`, email: `abeperl@gmail.com`) then rerun `npm publish --access public`.

---

## GitHub Release

After pushing the `v1.0.0` tag:

```bash
gh release create v1.0.0 \
  --repo abeperl/immich-jewish-mcp \
  --title "KolAlbum MCP v1.0.0" \
  --notes-file RELEASE_NOTES.md
```

Repository: https://github.com/abeperl/immich-jewish-mcp

---

## MCP Registry Submissions

### Smithery (smithery.ai)

Submit at: https://smithery.ai/submit

The `smithery.yaml` in the repo root has the full config. Fields:

- **Name:** KolAlbum MCP (immich-jewish-mcp)
- **Description:** BYO MCP server for organizing self-hosted Immich photos by Jewish lifecycle events and holidays
- **npm:** immich-jewish-mcp
- **GitHub:** https://github.com/abeperl/immich-jewish-mcp
- **Category:** Photos / Productivity / Jewish

### Official MCP Servers registry

Submit a PR to: https://github.com/modelcontextprotocol/servers

Add an entry under the community servers section:
```markdown
- [immich-jewish-mcp](https://github.com/abeperl/immich-jewish-mcp) — BYO MCP server that organizes self-hosted Immich photos by Jewish lifecycle events (bar mitzvah, bris, wedding, Chanukah, etc.)
```

### awesome-mcp-servers lists

Submit a PR to: https://github.com/punkpeye/awesome-mcp-servers

Entry:
```markdown
- [immich-jewish-mcp](https://github.com/abeperl/immich-jewish-mcp) - BYO MCP for organizing self-hosted [Immich](https://immich.app) photos by Jewish lifecycle events. Requires your own Immich URL + API key.
```

---

## Twitter/X

```
📸 Just shipped: immich-jewish-mcp (KolAlbum MCP)

Give Claude access to your self-hosted Immich photo library — organized by Jewish lifecycle events: bar mitzvah, bris, wedding, vort, Pesach, Chanukah, and more.

BYO model: your photos, your server, your API key.

npm install -g immich-jewish-mcp

https://github.com/abeperl/immich-jewish-mcp
```

## Thread Version

```
1/ 📸 Just shipped: KolAlbum MCP (immich-jewish-mcp)

The first MCP server for organizing your self-hosted Immich photo library by Jewish lifecycle events.

npm i -g immich-jewish-mcp

2/ What can it do?

🎉 Detects bar mitzvah, bat mitzvah, bris, vort, wedding from EXIF dates + filenames
🕎 Matches Chanukah, Pesach, Purim, Sukkot from a pre-computed holiday calendar (2015–2030)
📁 Suggests lifecycle album groupings — advisory only, you confirm before anything is created
🔑 BYO: your Immich server, your API key, no managed hosting

3/ Privacy-first by design:

✅ Server reads only photo metadata (dates, filenames, EXIF) — never downloads photos
✅ API key lives in your MCP config env vars, never persisted server-side  
✅ Zero external API calls — all logic runs locally
✅ Non-destructive: confirm=false by default on all suggestions

4/ Try it:

npx immich-jewish-mcp

Claude Desktop config:
{
  "mcpServers": {
    "immich-jewish": {
      "command": "npx",
      "args": ["-y", "immich-jewish-mcp"],
      "env": {
        "IMMICH_BASE_URL": "https://photos.example.com",
        "IMMICH_API_KEY": "your-key"
      }
    }
  }
}

GitHub: https://github.com/abeperl/immich-jewish-mcp
npm: https://npmjs.com/package/immich-jewish-mcp
```

---

## Reddit r/selfhosted

### Title
```
I built an MCP server that lets Claude organize your self-hosted Immich photos by Jewish lifecycle events
```

### Body
```
Hey r/selfhosted,

I just released immich-jewish-mcp — a BYO MCP server for organizing your Immich photo library by Jewish lifecycle events.

**What it does:**
- Detects events (bar mitzvah, bris, vort, wedding, Chanukah, Pesach, etc.) from EXIF dates and filenames
- Suggests album groupings — advisory only, nothing is created without your explicit confirmation
- Full Immich API coverage: search, list, create, label albums

**Privacy-first:**
- Your API key stays in your MCP client config (env vars), never touched by the server
- No external API calls — all logic runs locally
- Read + create only (no DELETE, no photo modification)

**Install:**
```bash
npm install -g immich-jewish-mcp
```

GitHub: https://github.com/abeperl/immich-jewish-mcp
npm: https://npmjs.com/package/immich-jewish-mcp

Feedback and minhag-specific alias suggestions welcome!
```

---

## Reddit r/Judaism

### Title
```
I built an AI tool that organizes your family photos by Jewish lifecycle events — bar mitzvah, bris, wedding, Pesach, Chanukah, etc.
```

### Body
```
Shalom r/Judaism,

I just released KolAlbum MCP — an open-source tool that lets Claude (the AI assistant) help organize your family photo library by Jewish lifecycle events.

**Events covered:** bris/brit milah, baby naming/simchat bat, pidyon haben, upsherin/chalaka, bar mitzvah, bat mitzvah, vort/engagement, chasunah, sheva brachot, Pesach, Sukkot, Chanukah, Purim, Rosh Hashanah, Shavuot.

**How it works:**
1. It connects to your self-hosted Immich photo library (free, open-source photo server)
2. Claude analyzes photo dates and filenames against the Jewish holiday calendar
3. It suggests album groupings — you approve before anything is created

**Privacy note:** Your photos stay on your own server. No credentials are stored. No photos are downloaded or uploaded anywhere.

**Installation:**
Requires an Immich server + API key. Then:
```
npm install -g immich-jewish-mcp
```

GitHub: https://github.com/abeperl/immich-jewish-mcp

Happy to answer questions — especially if you have suggestions for minhag-specific terms to add to the taxonomy!
```
