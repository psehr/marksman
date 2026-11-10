import assert from "node:assert/strict";
import { test } from "node:test";
import { getBountyViewUrl, parseBountyView } from "../../src/hooks/useBountyView";

test("missing and unsupported bounty views default to Overview", () => {
  for (const value of [null, "", "overview", "unknown", "Engagement"]) {
    assert.equal(parseBountyView(value), "overview");
  }
  assert.equal(parseBountyView("engagement"), "engagement");
  assert.equal(parseBountyView("comments"), "comments");
  assert.equal(parseBountyView("activity"), "activity");
  assert.equal(parseBountyView("funding"), "funding");
});
test("bounty view URLs retain route, unrelated repeated params and hash", () => {
  const initial = "https://marksman.test/bounties/fixture?keep=1&keep=2&view=invalid&view=overview#rules";
  const url = getBountyViewUrl(initial, "engagement");
  assert.equal(url.pathname, "/bounties/fixture");
  assert.deepEqual(url.searchParams.getAll("keep"), ["1", "2"]);
  assert.deepEqual(url.searchParams.getAll("view"), ["engagement"]);
  assert.equal(url.hash, "#rules");
  assert.equal(getBountyViewUrl(url.href, "comments").searchParams.get("view"), "comments");
  assert.equal(getBountyViewUrl(url.href, "overview").href, "https://marksman.test/bounties/fixture?keep=1&keep=2#rules");
});

test("WIP view URLs preserve params and hash", () => {
  for (const view of ["activity", "funding"] as const) {
    const url = getBountyViewUrl("https://marksman.test/bounties/fixture?keep=1#rules", view);
    assert.equal(url.searchParams.get("view"), view);
    assert.equal(url.searchParams.get("keep"), "1");
    assert.equal(url.hash, "#rules");
  }
});
