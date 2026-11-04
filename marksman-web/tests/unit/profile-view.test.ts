import assert from "node:assert/strict";
import { test } from "node:test";
import { getProfileViewUrl, parseProfileView } from "../../src/hooks/useProfileView";

test("missing and invalid views fall back to Hunting", () => {
  for (const value of [null, "", "hunting", "unknown", "Hunting"]) {
    assert.equal(parseProfileView(value), "hunting");
  }
});

test("recognizes Activity and Created views", () => {
  assert.equal(parseProfileView("activity"), "activity");
  assert.equal(parseProfileView("created"), "created");
});

test("switching views preserves the profile path, unrelated parameters and hash", () => {
  const url = getProfileViewUrl("https://marksman.test/users/abc?keep=1&keep=2&view=hunting#section", "created");
  assert.equal(url.pathname, "/users/abc");
  assert.deepEqual(url.searchParams.getAll("keep"), ["1", "2"]);
  assert.equal(url.searchParams.get("view"), "created");
  assert.equal(url.hash, "#section");
});

test("Hunting removes the view parameter and duplicate views collapse on selection", () => {
  const current = "https://marksman.test/users/abc?view=hunting&keep=1&view=created";
  assert.equal(getProfileViewUrl(current, "hunting").search, "?keep=1");
  assert.deepEqual(getProfileViewUrl(current, "activity").searchParams.getAll("view"), ["activity"]);
});
