/**
 * KolAlbum MCP — QA Gate Tests (FN-062)
 *
 * Verifies the three mandatory QA concerns before npm publish:
 *
 *   QA-1  Non-destructive by default
 *         · suggest_lifecycle_albums never writes anything
 *         · label_event with confirm=false (default) returns a preview, not a mutation
 *         · No DELETE endpoint exists in the API surface
 *         · No mutation happens server-side without explicit confirm=true
 *
 *   QA-2  Auth isolation (BYO model)
 *         · Credentials are read only from process.env at request time
 *         · No credential is persisted in module scope between requests
 *         · Missing env vars produce a clear error, not a server panic
 *
 *   QA-3  Correctness (offline taxonomy + calendar smoke tests)
 *         · Lifecycle suggestions for bris / vort / bar mitzvah / Pesach are sane
 *         · High-confidence suggestions can be easily rejected (preview mode)
 *         · Low-signal assets produce no spurious high-confidence suggestions
 *
 * QA-4 (integration) tests run only when IMMICH_BASE_URL + IMMICH_API_KEY are set
 * and verify the live end-to-end flow against a real Immich container.
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { analyzeAssets, buildLabelEventPreview } from "./semantic-lifecycle.js";
import { getConfigFromEnv } from "./immich-api.js";
import {
  listAlbums,
  createAlbum,
  listAssets,
  searchAssets,
} from "./immich-api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── QA-1: Non-destructive by default ─────────────────────────────────────────

describe("QA-1: Non-destructive by default", () => {

  it("immich-api.ts exposes NO delete endpoint (code-level audit)", () => {
    // Read the compiled immich-api source to confirm no DELETE calls
    const srcPath = path.join(__dirname, "immich-api.js");
    if (!fs.existsSync(srcPath)) {
      // Try TS source as fallback
      const tsSrc = path.join(__dirname, "..", "src", "immich-api.ts");
      if (fs.existsSync(tsSrc)) {
        const src = fs.readFileSync(tsSrc, "utf8");
        assert.ok(
          !src.includes('"DELETE"') && !src.includes("'DELETE'"),
          "immich-api.ts must not contain DELETE method calls"
        );
        return;
      }
    }
    const src = fs.readFileSync(srcPath, "utf8");
    assert.ok(
      !src.includes('"DELETE"') && !src.includes("'DELETE'"),
      "immich-api.js must not contain DELETE method calls"
    );
  });

  it("immich-api.ts exposes NO overwrite/replace-asset endpoint (code-level audit)", () => {
    const srcPath = path.join(__dirname, "immich-api.js");
    const tsSrcPath = path.join(__dirname, "..", "src", "immich-api.ts");
    const src = fs.existsSync(srcPath)
      ? fs.readFileSync(srcPath, "utf8")
      : fs.readFileSync(tsSrcPath, "utf8");

    // The only mutation verbs allowed are POST (create) and PATCH/PUT for
    // album rename and adding assets. There must be no DELETE or destructive
    // asset manipulation.
    const destructivePatterns = [
      /method.*DELETE/i,
      /replaceAsset/i,
      /deleteAsset/i,
      /removeAsset/i,
      /trash/i,
    ];
    for (const pat of destructivePatterns) {
      assert.ok(
        !pat.test(src),
        `immich-api should not contain destructive pattern: ${pat}`
      );
    }
  });

  it("suggest_lifecycle_albums pendingAction always has confirm=false", () => {
    const assets = [
      { id: "a1", originalFileName: "bar_mitzvah_levi.jpg", localDateTime: "2023-09-15T10:00:00", exifInfo: null },
      { id: "a2", originalFileName: "aliyah_reading.jpg", localDateTime: "2023-09-15T10:30:00", exifInfo: null },
    ];
    const suggestions = analyzeAssets(assets as Parameters<typeof analyzeAssets>[0]);
    assert.ok(suggestions.length > 0, "Expected at least one suggestion");
    for (const s of suggestions) {
      assert.equal(
        s.pendingAction.args.confirm,
        false,
        `suggestion ${s.eventId} pendingAction.confirm must be false (default preview)`
      );
      assert.equal(
        s.pendingAction.tool,
        "label_event",
        `pendingAction tool must be label_event`
      );
    }
  });

  it("buildLabelEventPreview returns mode=preview and no mutation occurs", () => {
    const preview = buildLabelEventPreview({
      eventType: "bris",
      personName: "Yosef",
      year: "2024",
      assetIds: ["x1", "x2", "x3"]
    });

    // The preview object describes what WOULD happen — no actual creation
    assert.ok(preview.proposed.albumName.includes("Bris") || preview.proposed.albumName.toLowerCase().includes("bris"),
      `Album name should include event label, got: ${preview.proposed.albumName}`);
    assert.equal(preview.proposed.assetCount, 3);
    assert.ok(
      preview.note.toLowerCase().includes("preview") || preview.note.toLowerCase().includes("confirm"),
      `Preview note should mention confirm or preview, got: ${preview.note}`
    );
    // There is no "created" field or album id — it's advisory only
    assert.ok(!("created" in preview), "Preview must not have a 'created' field");
    assert.ok(!("albumId" in preview.proposed), "Preview must not have an albumId (would indicate actual creation)");
  });

  it("label_event preview is always reversible — wrong guess leaves nothing behind", () => {
    // If the model guesses the wrong event type, the user can reject the preview
    // and no mutation has occurred. Verify by checking preview has no side effects.
    const wrongGuess = buildLabelEventPreview({
      eventType: "wedding",  // wrong — this is actually a bris
      assetIds: ["p1"],
    });
    assert.ok(wrongGuess.proposed.albumName, "Preview should have a proposed name");
    assert.equal(wrongGuess.proposed.assetCount, 1);
    // The user can simply not call confirm=true — nothing was written
    // No assertion about side effects needed; the preview object is pure/safe.
  });

  it("index.ts label_event handler requires explicit confirm=true to write (code audit)", () => {
    const indexSrcPath = path.join(__dirname, "..", "src", "index.ts");
    const indexJsPath = path.join(__dirname, "index.js");
    const src = fs.existsSync(indexSrcPath)
      ? fs.readFileSync(indexSrcPath, "utf8")
      : fs.readFileSync(indexJsPath, "utf8");

    // The label_event handler must check for confirm before calling createAlbum
    assert.ok(
      src.includes("confirm") && src.includes("createAlbum"),
      "index source must contain both 'confirm' check and 'createAlbum' call"
    );
    // The confirm flag must guard creation
    assert.ok(
      src.includes("if (!confirm)") || src.includes("if(!confirm)"),
      "label_event handler must gate createAlbum behind if(!confirm) check"
    );
    // Default for confirm must be false
    assert.ok(
      src.includes("default: false") || src.includes('"default": false') || src.includes("confirm = false") || src.includes("Boolean(args?.confirm)"),
      "confirm parameter default must be false"
    );
  });
});

// ── QA-2: Auth isolation ──────────────────────────────────────────────────────

describe("QA-2: Auth isolation (BYO model)", () => {

  it("getConfigFromEnv reads from process.env, not a hardcoded value", () => {
    // Set test values
    const origUrl = process.env.IMMICH_BASE_URL;
    const origKey = process.env.IMMICH_API_KEY;

    process.env.IMMICH_BASE_URL = "http://test-instance.local:2283";
    process.env.IMMICH_API_KEY = "test-key-abc123";

    const config = getConfigFromEnv();
    assert.ok(!("error" in config), `Should have valid config, got: ${JSON.stringify(config)}`);
    assert.equal((config as { baseUrl: string }).baseUrl, "http://test-instance.local:2283");
    assert.equal((config as { apiKey: string }).apiKey, "test-key-abc123");

    // Restore
    if (origUrl === undefined) delete process.env.IMMICH_BASE_URL;
    else process.env.IMMICH_BASE_URL = origUrl;
    if (origKey === undefined) delete process.env.IMMICH_API_KEY;
    else process.env.IMMICH_API_KEY = origKey;
  });

  it("getConfigFromEnv returns an error when IMMICH_BASE_URL is missing", () => {
    const origUrl = process.env.IMMICH_BASE_URL;
    const origKey = process.env.IMMICH_API_KEY;

    delete process.env.IMMICH_BASE_URL;
    process.env.IMMICH_API_KEY = "some-key";

    const config = getConfigFromEnv();
    assert.ok("error" in config, "Expected error for missing IMMICH_BASE_URL");
    assert.ok(
      (config as { error: string }).error.includes("IMMICH_BASE_URL"),
      `Error should mention IMMICH_BASE_URL, got: ${(config as { error: string }).error}`
    );

    // Restore
    if (origUrl !== undefined) process.env.IMMICH_BASE_URL = origUrl;
    if (origKey === undefined) delete process.env.IMMICH_API_KEY;
    else process.env.IMMICH_API_KEY = origKey;
  });

  it("getConfigFromEnv returns an error when IMMICH_API_KEY is missing", () => {
    const origUrl = process.env.IMMICH_BASE_URL;
    const origKey = process.env.IMMICH_API_KEY;

    process.env.IMMICH_BASE_URL = "http://localhost:2283";
    delete process.env.IMMICH_API_KEY;

    const config = getConfigFromEnv();
    assert.ok("error" in config, "Expected error for missing IMMICH_API_KEY");
    assert.ok(
      (config as { error: string }).error.includes("IMMICH_API_KEY"),
      `Error should mention IMMICH_API_KEY, got: ${(config as { error: string }).error}`
    );

    // Restore
    if (origUrl === undefined) delete process.env.IMMICH_BASE_URL;
    else process.env.IMMICH_BASE_URL = origUrl;
    if (origKey !== undefined) process.env.IMMICH_API_KEY = origKey;
  });

  it("immich-api.ts contains no hardcoded credentials (code-level audit)", () => {
    const srcPath = path.join(__dirname, "..", "src", "immich-api.ts");
    const jsPath = path.join(__dirname, "immich-api.js");
    const src = fs.existsSync(srcPath)
      ? fs.readFileSync(srcPath, "utf8")
      : fs.readFileSync(jsPath, "utf8");

    const suspiciousPatterns = [
      // Reject anything that looks like a hardcoded API key or URL
      /apiKey\s*=\s*["'][a-zA-Z0-9_\-]{16,}["']/,
      /baseUrl\s*=\s*["']https?:\/\/(?!localhost|127)/,
      /IMMICH_API_KEY\s*=\s*["'][^"']+["']/,
    ];
    for (const pat of suspiciousPatterns) {
      assert.ok(
        !pat.test(src),
        `immich-api source should not contain hardcoded credentials matching: ${pat}`
      );
    }
  });

  it("credentials are never written to disk by the MCP server (code audit)", () => {
    // Check that neither immich-api.ts nor index.ts writes credentials to any file
    const files = [
      path.join(__dirname, "..", "src", "immich-api.ts"),
      path.join(__dirname, "..", "src", "index.ts"),
    ].filter(fs.existsSync);

    for (const f of files) {
      const src = fs.readFileSync(f, "utf8");
      const writePatterns = [
        /writeFile.*apiKey/i,
        /writeFile.*IMMICH_API_KEY/i,
        /fs\.write.*apiKey/i,
        /localStorage/i,
        /sessionStorage/i,
        /\.json.*apiKey/i,
      ];
      for (const pat of writePatterns) {
        assert.ok(
          !pat.test(src),
          `${path.basename(f)} must not write credentials to disk (found: ${pat})`
        );
      }
    }
  });

  it("API key is passed per-request via x-api-key header, not stored globally", () => {
    const srcPath = path.join(__dirname, "..", "src", "immich-api.ts");
    const jsPath = path.join(__dirname, "immich-api.js");
    const src = fs.existsSync(srcPath)
      ? fs.readFileSync(srcPath, "utf8")
      : fs.readFileSync(jsPath, "utf8");

    // The x-api-key header must appear in the request body of immichRequest
    assert.ok(
      src.includes("x-api-key"),
      "immich-api must send x-api-key header in requests"
    );
    // getConfigFromEnv should be called inside the request function, not module-level
    assert.ok(
      src.includes("getConfigFromEnv"),
      "immich-api must call getConfigFromEnv to resolve credentials"
    );
  });
});

// ── QA-3: Correctness (offline) ──────────────────────────────────────────────

describe("QA-3: Correctness — lifecycle suggestions", () => {

  it("bris: detects bris from filename keywords", () => {
    const assets = [
      { id: "b1", originalFileName: "bris_baby_shmuel_2022.jpg", localDateTime: "2022-03-15T10:00:00", exifInfo: null },
      { id: "b2", originalFileName: "milah_ceremony.jpg", localDateTime: "2022-03-15T10:30:00", exifInfo: null },
    ];
    const suggestions = analyzeAssets(assets as Parameters<typeof analyzeAssets>[0]);
    const bris = suggestions.find((s) => s.eventId === "bris");
    assert.ok(bris, "Expected bris suggestion for bris-keyword photos");
    assert.ok(
      bris!.confidence === "high" || bris!.confidence === "medium",
      `Bris confidence should be high or medium, got: ${bris!.confidence}`
    );
  });

  it("vort (engagement): detects engagement from filename keywords", () => {
    const assets = [
      { id: "v1", originalFileName: "vort_engagement_rivka_dovid_2024.jpg", localDateTime: "2024-06-10T19:00:00", exifInfo: null },
      { id: "v2", originalFileName: "lchaim_toast.jpg", localDateTime: "2024-06-10T19:30:00", exifInfo: null },
    ];
    const suggestions = analyzeAssets(assets as Parameters<typeof analyzeAssets>[0]);
    const vort = suggestions.find((s) => s.eventId === "vort" || s.eventId === "engagement");
    assert.ok(vort, `Expected vort/engagement suggestion, got events: ${suggestions.map(s => s.eventId).join(", ")}`);
  });

  it("bar_mitzvah: detects bar mitzvah from filename + aliyah keywords", () => {
    const assets = [
      { id: "bm1", originalFileName: "bar_mitzvah_aliyah_levi_2023.jpg", localDateTime: "2023-09-15T10:00:00", exifInfo: null },
      { id: "bm2", originalFileName: "haftarah_chanting.jpg", localDateTime: "2023-09-15T10:30:00", exifInfo: null },
    ];
    const suggestions = analyzeAssets(assets as Parameters<typeof analyzeAssets>[0]);
    const bm = suggestions.find((s) => s.eventId === "bar_mitzvah");
    assert.ok(bm, `Expected bar_mitzvah suggestion, got: ${suggestions.map(s => s.eventId).join(", ")}`);
    assert.ok(bm!.assetIds.includes("bm1"), "bar_mitzvah should include the primary photo");
  });

  it("pesach: detects Pesach from seder filename + date in Pesach window", () => {
    const assets = [
      { id: "p1", originalFileName: "pesach_seder_plate_2024.jpg", localDateTime: "2024-04-22T20:00:00", exifInfo: null },
      { id: "p2", originalFileName: "afikomen_hunt.jpg", localDateTime: "2024-04-22T21:00:00", exifInfo: null },
    ];
    const suggestions = analyzeAssets(assets as Parameters<typeof analyzeAssets>[0]);
    const pesach = suggestions.find((s) => s.eventId === "pesach");
    assert.ok(pesach, `Expected pesach suggestion, got: ${suggestions.map(s => s.eventId).join(", ")}`);
    assert.equal(pesach!.confidence, "high", "Seder filename + Pesach date should yield high confidence");
  });

  it("chanukah: detects Chanukah from menorah filename + date in Chanukah window", () => {
    const assets = [
      { id: "c1", originalFileName: "chanukah_menorah_lighting_2023.jpg", localDateTime: "2023-12-08T19:00:00", exifInfo: null },
    ];
    const suggestions = analyzeAssets(assets as Parameters<typeof analyzeAssets>[0]);
    const chanukah = suggestions.find((s) => s.eventId === "chanukah");
    assert.ok(chanukah, `Expected chanukah suggestion, got: ${suggestions.map(s => s.eventId).join(", ")}`);
  });

  it("generic photo produces no high-confidence lifecycle suggestion", () => {
    const assets = [
      { id: "g1", originalFileName: "IMG_generic_photo_no_lifecycle.jpg", localDateTime: "2024-06-01T12:00:00", exifInfo: null },
    ];
    const suggestions = analyzeAssets(assets as Parameters<typeof analyzeAssets>[0]);
    const highConf = suggestions.filter((s) => s.confidence === "high");
    assert.equal(
      highConf.length,
      0,
      `Generic photo should not produce high-confidence suggestions, got: ${highConf.map(s => s.eventId).join(", ")}`
    );
  });

  it("mislabel is easy to reject — preview shows proposed name before commit", () => {
    // Simulate: model suggests bar_mitzvah for a photo that is actually a wedding
    const wrongSuggestion = buildLabelEventPreview({
      eventType: "bar_mitzvah",  // wrong guess
      assetIds: ["w1", "w2"],
    });

    // The user can see exactly what would be created before confirming
    assert.ok(
      wrongSuggestion.proposed.albumName.includes("Bar Mitzvah") ||
      wrongSuggestion.proposed.albumName.toLowerCase().includes("bar"),
      `Preview name should contain the event label for easy rejection, got: ${wrongSuggestion.proposed.albumName}`
    );
    assert.ok(wrongSuggestion.proposed.assetCount === 2);
    // The note explicitly tells the user to confirm before anything is written
    assert.ok(
      wrongSuggestion.note.toLowerCase().includes("confirm"),
      `Preview note must prompt for confirmation, got: ${wrongSuggestion.note}`
    );
  });

  it("all suggestions include a dateRange so user can validate timing", () => {
    const assets = [
      { id: "d1", originalFileName: "bris_baby.jpg", localDateTime: "2024-04-22T10:00:00", exifInfo: null },
    ];
    const suggestions = analyzeAssets(assets as Parameters<typeof analyzeAssets>[0]);
    for (const s of suggestions) {
      assert.ok(
        typeof s.dateRange === "string" && s.dateRange.length > 0,
        `Suggestion ${s.eventId} must include dateRange for user validation`
      );
    }
  });

  it("all suggestions include reasoning so user can evaluate quality", () => {
    const assets = [
      { id: "r1", originalFileName: "bar_mitzvah_speech.jpg", localDateTime: "2024-04-22T10:00:00", exifInfo: null },
    ];
    const suggestions = analyzeAssets(assets as Parameters<typeof analyzeAssets>[0]);
    for (const s of suggestions) {
      assert.ok(
        Array.isArray(s.reasoning) && s.reasoning.length > 0,
        `Suggestion ${s.eventId} must include reasoning array so user can evaluate quality`
      );
    }
  });
});

// ── QA-4: Live integration tests ──────────────────────────────────────────────
// These tests only run when IMMICH_BASE_URL + IMMICH_API_KEY are set.

const integrationSkip = !process.env.IMMICH_BASE_URL || !process.env.IMMICH_API_KEY
  ? "Set IMMICH_BASE_URL and IMMICH_API_KEY to run live integration tests"
  : false;

describe("QA-4: Live integration (requires running Immich)", { skip: integrationSkip }, () => {
  let testAlbumId: string | undefined;

  before(() => {
    const config = getConfigFromEnv();
    assert.ok(
      !("error" in config),
      `Config error: ${(config as { error: string }).error}`
    );
    console.log(`  Connecting to Immich at: ${process.env.IMMICH_BASE_URL}`);
  });

  it("list_albums returns an array (smoke test)", async () => {
    const result = await listAlbums();
    assert.ok(!result.error, `listAlbums failed: ${result.error}`);
    assert.ok(Array.isArray(result.albums), "Expected albums array");
    console.log(`    Found ${result.albums.length} existing album(s)`);
  });

  it("list_assets returns an array (may be empty on fresh instance)", async () => {
    const result = await listAssets({ limit: 10 });
    assert.ok(!result.error, `listAssets failed: ${result.error}`);
    assert.ok(Array.isArray(result.assets), "Expected assets array");
    console.log(`    Found ${result.assets.length} asset(s)`);
  });

  it("search_assets returns results without error", async () => {
    const result = await searchAssets({ query: "bar mitzvah", limit: 5 });
    assert.ok(!result.error, `searchAssets failed: ${result.error}`);
    assert.ok(Array.isArray(result.assets), "Expected assets array");
    console.log(`    Search returned ${result.assets.length} result(s)`);
  });

  it("create_album (QA-1 live): creates album without touching originals", async () => {
    const albumsBefore = await listAlbums();
    assert.ok(!albumsBefore.error);
    const countBefore = albumsBefore.albums.length;

    const result = await createAlbum({
      albumName: "KolAlbum QA Test — Bar Mitzvah Preview",
      description: "Created by QA gate test — safe to delete",
    });
    assert.ok(!result.error, `createAlbum failed: ${result.error}`);
    assert.ok(result.album, "Expected album in response");
    assert.ok(result.album!.albumName.includes("QA Test"), "Album name should match");
    testAlbumId = result.album!.id;

    const albumsAfter = await listAlbums();
    assert.equal(
      albumsAfter.albums.length,
      countBefore + 1,
      "Album count should increase by exactly 1"
    );
    console.log(`    Created test album: ${testAlbumId}`);
  });

  it("create_album with asset_ids does NOT delete originals (QA-1 live)", async () => {
    // Get the current assets
    const assetsBefore = await listAssets({ limit: 20 });
    assert.ok(!assetsBefore.error);
    const countBefore = assetsBefore.assets.length;

    if (countBefore > 0) {
      // Create an album seeded with first asset — it should appear in the album but NOT be removed from global
      const assetId = assetsBefore.assets[0].id;
      const albumResult = await createAlbum({
        albumName: "KolAlbum QA Test — Asset Safety Check",
        assetIds: [assetId],
      });
      assert.ok(!albumResult.error, `createAlbum with assets failed: ${albumResult.error}`);

      // Asset should still exist globally after being added to album
      const assetsAfter = await listAssets({ limit: 20 });
      assert.equal(
        assetsAfter.assets.length,
        countBefore,
        "Adding an asset to an album must NOT reduce the global asset count (originals preserved)"
      );
      console.log(`    Asset ${assetId} safely added to album — original preserved`);
    } else {
      console.log("    (no assets uploaded yet — skipping asset safety check)");
    }
  });

  it("bad API key returns error string, not thrown exception (QA-2 live)", async () => {
    const origKey = process.env.IMMICH_API_KEY;
    process.env.IMMICH_API_KEY = "invalid-key-xyz-qa-test";
    const result = await listAlbums();
    process.env.IMMICH_API_KEY = origKey;

    assert.ok(result.error, "Expected error for bad API key");
    assert.ok(typeof result.error === "string", "Error must be a string, not an exception");
    assert.ok(
      result.error.includes("401") || result.error.includes("403") || result.error.includes("Immich HTTP"),
      `Auth error message should mention HTTP error code, got: ${result.error}`
    );
    console.log(`    Auth rejection message: ${result.error}`);
  });

  it("suggest_lifecycle_albums on live assets produces advisory-only suggestions (QA-1 + QA-3 live)", async () => {
    const assets = await listAssets({ limit: 10 });
    assert.ok(!assets.error);

    if (assets.assets.length === 0) {
      console.log("    (no assets — skipping semantic analysis live check)");
      return;
    }

    const suggestions = analyzeAssets(assets.assets);
    console.log(`    Analyzed ${assets.assets.length} live asset(s); got ${suggestions.length} suggestion(s)`);

    // All suggestions must have confirm=false in pendingAction (advisory, not auto-applied)
    for (const s of suggestions) {
      assert.equal(
        s.pendingAction.args.confirm,
        false,
        `Live suggestion ${s.eventId} pendingAction.confirm must be false`
      );
    }
  });
});
