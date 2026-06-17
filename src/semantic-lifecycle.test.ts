/**
 * Tests for the semantic lifecycle layer.
 * Uses Node.js built-in test runner (node --test).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import the compiled JS (this test file is compiled before running)
import { analyzeAssets, buildLabelEventPreview } from "./semantic-lifecycle.js";
import { getHolidaysForDate } from "./jewish-calendar.js";

// ---------------------------------------------------------------------------
// jewish-calendar tests
// ---------------------------------------------------------------------------

describe("getHolidaysForDate", () => {
  it("identifies Chanukah 2024 on Dec 25", () => {
    const result = getHolidaysForDate("2024-12-25");
    assert.ok(result.includes("chanukah"), `Expected chanukah in ${result}`);
  });

  it("identifies Pesach 2024 on April 22", () => {
    const result = getHolidaysForDate("2024-04-22");
    assert.ok(result.includes("pesach"), `Expected pesach in ${result}`);
  });

  it("identifies Rosh Hashanah 2025 on Sept 22", () => {
    const result = getHolidaysForDate("2025-09-22");
    assert.ok(result.includes("rosh_hashanah"), `Expected rosh_hashanah in ${result}`);
  });

  it("identifies Sukkot 2025 on Oct 6", () => {
    const result = getHolidaysForDate("2025-10-06");
    assert.ok(result.includes("sukkot"), `Expected sukkot in ${result}`);
  });

  it("identifies Purim 2026 on Mar 3", () => {
    const result = getHolidaysForDate("2026-03-03");
    assert.ok(result.includes("purim"), `Expected purim in ${result}`);
  });

  it("returns empty for mid-June non-holiday date", () => {
    const result = getHolidaysForDate("2024-06-15");
    assert.deepEqual(result, [], `Expected no holidays, got ${result}`);
  });

  it("uses lookahead window — day before Chanukah matches", () => {
    // Chanukah 2024 starts Dec 25; day before should match with default lookbackDays=1
    const result = getHolidaysForDate("2024-12-24");
    assert.ok(result.includes("chanukah"), `Expected chanukah for Dec 24 (lookback), got ${result}`);
  });

  it("returns empty for invalid date", () => {
    const result = getHolidaysForDate("not-a-date");
    assert.deepEqual(result, []);
  });
});

// ---------------------------------------------------------------------------
// analyzeAssets tests
// ---------------------------------------------------------------------------

describe("analyzeAssets", () => {
  it("returns empty for empty asset list", () => {
    const result = analyzeAssets([]);
    assert.deepEqual(result, []);
  });

  it("detects Chanukah from filename keywords + date", () => {
    const assets = [
      { id: "c1", originalFileName: "menorah_lighting.jpg", localDateTime: "2024-12-25T19:00:00", exifInfo: null },
      { id: "c2", originalFileName: "family_chanukah.jpg", localDateTime: "2024-12-26T18:00:00", exifInfo: null },
    ];
    const suggestions = analyzeAssets(assets as Parameters<typeof analyzeAssets>[0]);
    const chanukah = suggestions.find((s) => s.eventId === "chanukah");
    assert.ok(chanukah, "Expected chanukah suggestion");
    assert.equal(chanukah?.confidence, "high");
    assert.ok(chanukah?.assetIds.includes("c1"));
    assert.ok(chanukah?.assetIds.includes("c2"));
  });

  it("detects bar mitzvah from filename keywords", () => {
    const assets = [
      { id: "bm1", originalFileName: "bar_mitzvah_aliyah.jpg", localDateTime: "2023-09-15T10:00:00", exifInfo: null },
      { id: "bm2", originalFileName: "haftarah_chanting.jpg", localDateTime: "2023-09-15T11:00:00", exifInfo: null },
    ];
    const suggestions = analyzeAssets(assets as Parameters<typeof analyzeAssets>[0]);
    const bm = suggestions.find((s) => s.eventId === "bar_mitzvah");
    assert.ok(bm, "Expected bar_mitzvah suggestion");
  });

  it("includes date range in suggestion", () => {
    const assets = [
      { id: "d1", originalFileName: "chanukah_night1.jpg", localDateTime: "2024-12-25T19:00:00", exifInfo: null },
      { id: "d2", originalFileName: "chanukah_night3.jpg", localDateTime: "2024-12-27T19:00:00", exifInfo: null },
    ];
    const suggestions = analyzeAssets(assets as Parameters<typeof analyzeAssets>[0]);
    const chanukah = suggestions.find((s) => s.eventId === "chanukah");
    assert.ok(chanukah?.dateRange.includes("2024-12-25"), `Expected date range start, got ${chanukah?.dateRange}`);
  });

  it("includes pendingAction with confirm=false", () => {
    const assets = [
      { id: "e1", originalFileName: "seder_plate.jpg", localDateTime: "2024-04-22T20:00:00", exifInfo: null },
    ];
    const suggestions = analyzeAssets(assets as Parameters<typeof analyzeAssets>[0]);
    const pesach = suggestions.find((s) => s.eventId === "pesach");
    assert.ok(pesach, "Expected pesach");
    assert.equal(pesach?.pendingAction.tool, "label_event");
    assert.equal(pesach?.pendingAction.args.confirm, false);
  });

  it("sorts high-confidence suggestions first", () => {
    const assets = [
      { id: "f1", originalFileName: "chanukah_menorah.jpg", localDateTime: "2024-12-25T19:00:00", exifInfo: null },
    ];
    const suggestions = analyzeAssets(assets as Parameters<typeof analyzeAssets>[0]);
    if (suggestions.length > 1) {
      assert.equal(suggestions[0].confidence, "high");
    }
  });

  it("uses album name hint for matching", () => {
    const assets = [
      { id: "g1", originalFileName: "IMG_0001.jpg", localDateTime: "2022-04-15T10:00:00", exifInfo: null },
    ];
    const suggestions = analyzeAssets(
      assets as Parameters<typeof analyzeAssets>[0],
      { albumName: "Pesach Seder 2022" }
    );
    const pesach = suggestions.find((s) => s.eventId === "pesach");
    assert.ok(pesach, "Expected pesach from album name hint");
  });
});

// ---------------------------------------------------------------------------
// buildLabelEventPreview tests
// ---------------------------------------------------------------------------

describe("buildLabelEventPreview", () => {
  it("generates album name from event type", () => {
    const preview = buildLabelEventPreview({ eventType: "chanukah", assetIds: ["x1", "x2"] });
    assert.ok(preview.proposed.albumName.toLowerCase().includes("chanukah"), preview.proposed.albumName);
    assert.equal(preview.proposed.assetCount, 2);
  });

  it("includes person name in album title when provided", () => {
    const preview = buildLabelEventPreview({
      eventType: "bar_mitzvah",
      personName: "Levi",
      year: "2025",
      assetIds: ["a1"]
    });
    assert.ok(preview.proposed.albumName.includes("Levi"), preview.proposed.albumName);
    assert.ok(preview.proposed.albumName.includes("2025"), preview.proposed.albumName);
  });

  it("uses custom album name when provided", () => {
    const preview = buildLabelEventPreview({
      eventType: "wedding",
      customAlbumName: "Sarah & Dovid Wedding 5784",
      assetIds: ["w1", "w2", "w3"]
    });
    assert.equal(preview.proposed.albumName, "Sarah & Dovid Wedding 5784");
    assert.equal(preview.proposed.assetCount, 3);
  });

  it("includes advisory note in all previews", () => {
    const preview = buildLabelEventPreview({ eventType: "bris", assetIds: ["b1"] });
    assert.ok(preview.note.toLowerCase().includes("preview") || preview.note.toLowerCase().includes("confirm"));
  });

  it("includes taxonomy description in output", () => {
    const preview = buildLabelEventPreview({ eventType: "pesach", assetIds: ["p1"] });
    assert.ok(preview.proposed.description.length > 0, "Expected description");
  });

  it("handles unknown event type gracefully", () => {
    const preview = buildLabelEventPreview({ eventType: "unknown_event_xyz", assetIds: ["u1"] });
    assert.ok(preview.proposed.albumName.includes("unknown_event_xyz"));
    assert.equal(preview.proposed.assetCount, 1);
  });
});
