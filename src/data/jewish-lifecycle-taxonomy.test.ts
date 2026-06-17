import assert from "node:assert/strict";
import test from "node:test";

import { findLifecycleMatches, JEWISH_LIFECYCLE_TAXONOMY } from "./jewish-lifecycle-taxonomy.js";

test("taxonomy includes core lifecycle and holiday event types", () => {
  const ids = new Set(JEWISH_LIFECYCLE_TAXONOMY.map((event) => event.id));
  for (const id of ["bar_mitzvah", "vort", "bris", "upsherin", "pesach"]) {
    assert.ok(ids.has(id), `missing ${id}`);
  }
});

test("findLifecycleMatches recognizes aliases and keywords", () => {
  assert.deepEqual(findLifecycleMatches("family seder with matzah").map((event) => event.id), ["pesach"]);
  assert.ok(findLifecycleMatches("first haircut chalaka party").some((event) => event.id === "upsherin"));
  assert.ok(findLifecycleMatches("tefillin and haftarah photos").some((event) => event.id === "bar_mitzvah"));
});
