import { expect, test } from "@playwright/test";

test("wizard mod rules validate selections and preserve them across navigation", async ({ page }) => {
  await page.route("**/auth/me", route => route.fulfill({ json: {
    identity: { id: "12345678-1234-4234-8234-123456789abc", osuUserId: 12345, username: "fixture" },
    stats: { bpBalance: 1000 }, createdAt: "2025-01-01T00:00:00.000Z",
  } }));
  await page.route("**/beatmaps/123456", route => route.fulfill({ json: {
    id: 123456, version: "Expert", difficulty_rating: 5, mode: "osu", status: "ranked",
    bpm: 180, url: "https://osu.ppy.sh/beatmaps/123456", max_combo: 1000,
    checksum: null, ar: 9, accuracy: 8, cs: 4, drain: 6,
    total_length: 120, hit_length: 110, playcount: 100, beatmapset: null,
  } }));
  await page.goto("/bounties/creation-tool");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("textbox", { name: "beatmap input" }).fill("123456");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const next = page.getByRole("button", { name: "Continue", exact: true });
  await expect(page.getByRole("radio", { name: "Any mods", exact: true })).toBeChecked();
  await expect(next).toBeEnabled();
  await page.getByRole("radio", { name: "Exactly these mods" }).check();
  await expect(next).toBeEnabled();
  await expect(page.getByText("Leave all unchecked to require no mods (NM).")).toBeVisible();
  await page.getByRole("radio", { name: "Include these mods" }).check();
  await expect(next).toBeDisabled();
  await page.getByRole("checkbox", { name: "HD", exact: true }).check();
  await expect(next).toBeEnabled();
  await page.getByRole("checkbox", { name: "DT", exact: true }).check();
  await page.getByRole("checkbox", { name: "HT", exact: true }).check();
  await expect(next).toBeDisabled();
  await expect(page.getByRole("alert").filter({ hasText: "conflicting" })).toBeVisible();
  await page.getByRole("checkbox", { name: "HT", exact: true }).uncheck();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await next.click();
  await expect(page.getByRole("radio", { name: "Include these mods" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "HD", exact: true })).toBeChecked();
  await page.getByRole("radio", { name: "Any mods", exact: true }).check();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page.getByRole("radio", { name: "Exclude these mods" }).check();
  await expect(page.getByRole("checkbox", { name: "HD", exact: true })).toBeChecked();
  await expect(next).toBeEnabled();
});
