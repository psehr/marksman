import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { fetchOwnOsuProfile } from "../src/integrations/osu/users";

const profile = {
  id: 12345,
  username: "fixture_player",
  country_code: "FR",
  country: { name: "France" },
  cover: { url: "https://assets.ppy.sh/user-profile-covers/12345/fixture.jpeg" },
};

afterEach(() => mock.restoreAll());

test("osu profile retains cover and country fields", async () => {
  mock.method(globalThis, "fetch", async () => Response.json(profile));
  assert.deepEqual(await fetchOwnOsuProfile("fixture-token"), profile);
});

test("osu profile rejects malformed cover and country data", async () => {
  for (const patch of [
    { country_code: "France" },
    { country: { name: "" } },
    { cover: { url: "not-a-url" } },
  ]) {
    mock.method(globalThis, "fetch", async () => Response.json({ ...profile, ...patch }));
    await assert.rejects(fetchOwnOsuProfile("fixture-token"), /Unable to fetch osu! profile/);
    mock.restoreAll();
  }
});
