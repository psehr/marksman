import { expect, test } from "@playwright/test";

test("icon cycles, exact mode, HT defaults and Pass preserve valid requirements", async ({ page }) => {
  await page.route("**/auth/access", route => route.fulfill({ status: 204 }));
  await page.route("**/auth/me", route => route.fulfill({ json: {
    identity: { coverUrl: null, countryCode: null, countryName: null, id: "12345678-1234-4234-8234-123456789abc", osuUserId: 12345, username: "fixture" },
    stats: { bpBalance: 1000 }, createdAt: "2025-01-01T00:00:00.000Z",
  } }));
  await page.route("**/beatmaps/123456", route => route.fulfill({ json: {
    id: 123456, version: "Expert", difficulty_rating: 5, mode: "osu", status: "ranked",
    bpm: 180, url: "https://osu.ppy.sh/beatmaps/123456", max_combo: 1000,
    checksum: null, ar: 9, accuracy: 8, cs: 4, drain: 6,
    total_length: 120, hit_length: 110, playcount: 100, beatmapset: null,
  } }));
  await page.goto("/bounties/creation-tool");
  await page.getByRole("textbox", { name: "beatmap input" }).fill("123456");
  const exact = page.getByRole("checkbox", { name: "Exact mods", exact: true });
  const mod = (name: string, state: string) => page.getByRole("button", { name: new RegExp(`^${name}: ${state}[.]`) });
  const submit = page.getByRole("button", { name: /^Create bounty/ });
  await expect(exact).toBeChecked();
  await expect(submit).toBeEnabled();
  await expect(mod("SO", "not selected")).toHaveCount(0);
  await expect(mod("HD", "not selected")).toBeVisible();
  await mod("HD", "not selected").click();
  await expect(mod("HD", "required")).toBeVisible();
  await exact.uncheck();
  await expect(mod("HT", "forbidden")).toBeVisible();
  await expect(mod("HD", "required")).toBeVisible();
  await mod("HD", "required").click();
  await expect(mod("HD", "forbidden")).toBeVisible();
  await mod("HD", "forbidden").click();
  await expect(mod("HD", "optional")).toBeVisible();
  await mod("HD", "optional").click();
  await mod("DT", "optional").click();
  await mod("HT", "forbidden").click();
  await mod("HT", "optional").click();
  await expect(submit).toBeDisabled();
  await expect(page.getByRole("alert").filter({ hasText: "conflicting" })).toBeVisible();
  await mod("HT", "required").click();
  await expect(submit).toBeEnabled();
  await page.getByRole("radio", { name: "Minimum Grade", exact: true }).locator("..").click();
  await mod("NF", "optional").click();
  await expect(mod("NF", "required")).toBeVisible();
  await page.getByRole("radio", { name: "Pass", exact: true }).locator("..").click();
  await expect(mod("NF", "optional")).toBeVisible();
  await mod("NF", "optional").click();
  await expect(mod("NF", "forbidden")).toBeVisible();
  await expect(mod("HD", "required")).toBeVisible();
  await expect(mod("DT", "required")).toBeVisible();
  await exact.check();
  await expect(mod("NF", "not selected")).toBeDisabled();
  await expect(mod("HT", "not selected")).toBeVisible();
  await expect(submit).toBeEnabled();
});
