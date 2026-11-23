import { expect, test } from "@playwright/test";

for (const width of [320, 640, 1280]) {
  test(`single-page creation sections fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.origin === "http://127.0.0.1:3100") return route.continue();
      if (url.pathname === "/auth/me") return route.fulfill({ json: {
        identity: { coverUrl: null, countryCode: null, countryName: null, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", osuUserId: 123, username: "fixture" },
        stats: { bpBalance: 1000 }, createdAt: "2026-01-01T00:00:00.000Z",
      } });
      if (url.pathname === "/auth/access") return route.fulfill({ status: 204 });
      if (url.pathname === "/beatmaps/123456") return route.fulfill({ json: {
        id: 123456, version: "Expert", difficulty_rating: 5, mode: "osu", status: "ranked",
        bpm: 180, url: "https://osu.ppy.sh/beatmaps/123456", max_combo: 1000,
        checksum: null, ar: 9, accuracy: 8, cs: 4, drain: 6,
        total_length: 120, hit_length: 110, playcount: 100, beatmapset: null,
      } });
      return route.abort();
    });
    await page.goto("/bounties/creation-tool");
    await expect(page.getByRole("textbox", { name: "beatmap input" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Back", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Continue", exact: true })).toHaveCount(0);
    const create = page.getByRole("button", { name: /^Create bounty/ });
    await expect(create).toBeDisabled();
    for (const name of ["Beatmap Selection", "Completion Goal", "Mod Requirements", "Reward Selection"]) {
      await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    }
    await page.getByRole("textbox", { name: "beatmap input" }).fill("123456");
    await expect(create).toBeEnabled();
    await page.getByRole("spinbutton").fill("0");
    await expect(create).toBeDisabled();
    await page.getByRole("spinbutton").fill("100");
    await expect(create).toBeEnabled();
    await page.getByRole("textbox", { name: "beatmap input" }).fill("invalid");
    await expect(create).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
