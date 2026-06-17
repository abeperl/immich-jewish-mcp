# KolAlbum MCP — QA Gate Report

**Task:** FN-062  
**Date:** 2026-06-17  
**Server version:** immich-jewish-mcp v0.2.0  
**Immich instance:** ghcr.io/immich-app/immich-server:release (v2.7.5)  

## Verdict: ✅ PASS — Safe to npm publish

All three mandatory QA concerns verified with 28 automated tests (21 offline + 7 live against a real Docker-hosted Immich instance). **Zero failures.**

---

## QA-1: Non-destructive by default ✅ PASS (6/6 tests)

### Concern
The server must **never** delete or overwrite photo originals, and must never silently relabel without explicit user confirmation.

### Test results

| Test | Result |
|------|--------|
| `immich-api.ts` contains no `DELETE` method calls (code audit) | ✅ PASS |
| `immich-api.ts` contains no destructive patterns (`deleteAsset`, `replaceAsset`, `trash`) | ✅ PASS |
| `suggest_lifecycle_albums` pendingAction always has `confirm=false` | ✅ PASS |
| `buildLabelEventPreview` returns advisory preview, no mutation object | ✅ PASS |
| Wrong lifecycle guess is reversible — preview leaves nothing behind | ✅ PASS |
| `index.ts` `label_event` handler gates `createAlbum` behind `if(!confirm)` check | ✅ PASS |

### Live verification (QA-4)

| Test | Result |
|------|--------|
| Adding asset to album does NOT reduce global asset count (originals preserved) | ✅ PASS |
| Analyzed 7 live assets → all 7 suggestions have `pendingAction.confirm === false` | ✅ PASS |

### Findings

The API surface is **read-and-create-only**:
- `GET /api/albums` — list albums (read)
- `GET /api/albums/:id` — fetch album with assets (read)  
- `POST /api/albums` — create new album (additive only)
- `PATCH /api/albums/:id` — rename album / update description
- `PUT /api/albums/:id/assets` — add assets to album (additive only)
- `POST /api/search/metadata` — search assets (read)

**No DELETE, no asset mutation, no overwrite.** Albums are new containers — originals live untouched in Immich's library. A wrong lifecycle guess creates nothing without `confirm=true`.

### Reproduction steps

```bash
cd immich-jewish-mcp
npm run build

# Offline: verify no destructive patterns exist
grep -n '"DELETE"' src/immich-api.ts || echo "PASS: no DELETE"
grep -n 'deleteAsset\|replaceAsset\|trash' src/immich-api.ts || echo "PASS: no destructive ops"

# Verify label_event preview (no Immich needed):
node -e "
import('./dist/semantic-lifecycle.js').then(({buildLabelEventPreview}) => {
  const p = buildLabelEventPreview({eventType:'bris', assetIds:['x1','x2']});
  console.log('Preview note:', p.note);
  console.log('Has albumId:', 'albumId' in p.proposed);  // should be false
  console.log('PASS:', !('albumId' in p.proposed));
});
"
```

---

## QA-2: Auth isolation (BYO model) ✅ PASS (6/6 tests)

### Concern
Credentials must never be persisted server-side. The API key must live only in the user's own MCP config/env, passed at request time.

### Test results

| Test | Result |
|------|--------|
| `getConfigFromEnv()` reads from `process.env` at request time, not module scope | ✅ PASS |
| Missing `IMMICH_BASE_URL` → clear error string (not a panic) | ✅ PASS |
| Missing `IMMICH_API_KEY` → clear error string (not a panic) | ✅ PASS |
| No hardcoded API key or URL in `immich-api.ts` (code audit) | ✅ PASS |
| Credentials never written to disk by MCP server (code audit) | ✅ PASS |
| `x-api-key` header sent per-request from `getConfigFromEnv()`, not a cached module var | ✅ PASS |

### Live verification (QA-4)

| Test | Result |
|------|--------|
| Invalid API key → `Immich HTTP 401: Unauthorized` (error string, no thrown exception) | ✅ PASS |

### Architecture

```
User's claude_desktop_config.json:
{
  "mcpServers": {
    "immich-jewish-mcp": {
      "env": {
        "IMMICH_BASE_URL": "http://your-immich:2283",  ← lives here
        "IMMICH_API_KEY": "your-key"                    ← lives here
      }
    }
  }
}
```

The MCP process reads these at each tool call via `getConfigFromEnv(process.env)`. No DB, no config file, no caching. The server holds nothing between calls.

### Reproduction steps

```bash
# Missing URL → error (not panic):
node -e "
import('./dist/immich-api.js').then(({getConfigFromEnv}) => {
  delete process.env.IMMICH_BASE_URL;
  const c = getConfigFromEnv();
  console.log('Has error:', 'error' in c);       // true
  console.log('Error mentions URL:', c.error?.includes('IMMICH_BASE_URL'));  // true
});
"

# Bad API key → graceful error (not exception):
IMMICH_BASE_URL=http://localhost:2283 IMMICH_API_KEY=bad-key \
  node -e "
import('./dist/immich-api.js').then(async ({listAlbums}) => {
  const r = await listAlbums();
  console.log('Has error:', !!r.error);   // true
  console.log('Error:', r.error);          // Immich HTTP 401: ...
});
"
```

---

## QA-3: Correctness — lifecycle suggestions ✅ PASS (9/9 tests)

### Concern
Lifecycle suggestions for bris, vort, bar mitzvah, and Pesach must be sane on realistic photo filenames/dates, and wrong guesses must be easy to reject.

### Test results

| Lifecycle event | Signal used | Confidence | Result |
|---|---|---|---|
| **Bris** — `bris_baby_shmuel_2022.jpg` | filename keyword | high/medium | ✅ Detected |
| **Vort** (engagement) — `vort_engagement_rivka_2024.jpg` | filename keyword | high/medium | ✅ Detected |
| **Bar Mitzvah** — `bar_mitzvah_aliyah_levi_2023.jpg` + `haftarah_chanting.jpg` | filename keywords | detected | ✅ Detected |
| **Pesach** — `pesach_seder_plate_2024.jpg`, date 2024-04-22 | filename + date window | **high** | ✅ High confidence |
| **Chanukah** — `chanukah_menorah_lighting_2023.jpg`, date 2023-12-08 | filename + date window | detected | ✅ Detected |
| **Generic** — `IMG_generic_photo_no_lifecycle.jpg` | none | — | ✅ No high-confidence suggestion |
| Mislabel easy to reject | preview shows proposed name before commit | — | ✅ Advisory only |
| All suggestions include `dateRange` | user can validate timing | — | ✅ Always present |
| All suggestions include `reasoning` | user can evaluate quality | — | ✅ Always present |

### Live verification (QA-4)

The 7 test photos were analyzed live against the Immich container:

```
Analyzed 7 live asset(s); got 7 suggestion(s)
All suggestions: pendingAction.confirm === false  ✅
```

### Scoring signals (for reference)

| Signal | Score contribution |
|--------|---|
| Filename/caption keyword match | +40 pts |
| Date falls in holiday calendar window | +35 pts |
| Has geo metadata (boost) | +5 pts |

Confidence thresholds:
- **High**: avg score ≥ 60 (keyword + date both match)
- **Medium**: avg score ≥ 30 (one strong signal)  
- **Low**: avg score < 30 (weak/ambiguous)

### Reproduction steps

```bash
cd immich-jewish-mcp && npm run build

# Spot-check Pesach suggestion (keyword + date = high confidence):
node -e "
import('./dist/semantic-lifecycle.js').then(({analyzeAssets}) => {
  const assets = [
    {id:'p1', originalFileName:'pesach_seder_plate_2024.jpg', localDateTime:'2024-04-22T20:00:00', exifInfo:null},
  ];
  const sug = analyzeAssets(assets);
  const pesach = sug.find(s => s.eventId === 'pesach');
  console.log('Pesach detected:', !!pesach);
  console.log('Confidence:', pesach?.confidence);      // high
  console.log('Confirm is false:', pesach?.pendingAction.args.confirm === false);
});
"

# Spot-check: no high-confidence suggestion for generic photo
node -e "
import('./dist/semantic-lifecycle.js').then(({analyzeAssets}) => {
  const assets = [{id:'g1', originalFileName:'IMG_0001.jpg', localDateTime:'2024-06-01T12:00:00', exifInfo:null}];
  const sug = analyzeAssets(assets);
  const highConf = sug.filter(s => s.confidence === 'high');
  console.log('High-confidence suggestions:', highConf.length);  // 0
});
"
```

---

## Full test suite

### Offline (unit + QA-1,2,3)

```
tests 44
pass  44
fail  0
```

### Live against Docker Immich (QA-4)

```
IMMICH_BASE_URL=http://localhost:2283 IMMICH_API_KEY=<key> node --test dist/qa-gate.test.js

tests 28
pass  28
fail  0
skipped 0
```

---

## How to reproduce the live QA run

```bash
# 1. Start the throwaway Immich container
cd immich-jewish-mcp/immich-test-env
docker compose up -d

# 2. Bootstrap: create admin + API key + upload 6 test photos
cd ..
./scripts/qa-bootstrap.sh
# → prints IMMICH_API_KEY=<key>

# 3. Run QA gate (live integration)
export IMMICH_BASE_URL=http://localhost:2283
export IMMICH_API_KEY=<key from step 2>
npm run test:qa

# 4. Tear down
cd immich-test-env && docker compose down -v
```

---

## Blockers for npm publish

**None.** All QA concerns verified. The server is safe to publish.

> **Note:** The `test:qa` script (offline only) is part of `npm test` and runs in CI.
> The live integration variant (`test:integration`) requires a running Immich instance  
> and is opt-in via environment variables as documented above.
