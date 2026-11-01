import { expect, test, type Page } from "@playwright/test";

const id = "12345678-1234-4234-8234-123456789abc";
async function review(page: Page) {
  await page.route("**/auth/me", route => route.fulfill({ json: {
    identity: { id, osuUserId: 12345, username: "fixture" },
    stats: { bpBalance: 1000 }, createdAt: "2025-01-01T00:00:00.000Z",
  } }));
  await page.route("**/beatmaps/123456", route => route.fulfill({ json: {
    id: 123456, version: "Expert", difficulty_rating: 5, mode: "osu", status: "ranked",
    bpm: 180, url: "https://osu.ppy.sh/beatmaps/123456", max_combo: 1000,
    checksum: null, ar: 9, accuracy: 8, cs: 4, drain: 6,
    total_length: 120, hit_length: 110, playcount: 100, beatmapset: null,
  } }));
  await page.goto("/bounties/creation-tool");
  const next = page.getByRole("button", { name: "Continue", exact: true });
  await next.click();
  await page.getByRole("textbox", { name: "beatmap input" }).fill("123456");
  await next.click();
  await next.click();
  await next.click();
  await next.click();
}

test("review preserves edits and submits once, refreshes account and navigates", async ({ page }) => {
  let requests = 0;
  let payload: Record<string, unknown> = {};
  await page.route("**/bounties", async route => {
    if (route.request().method() !== "POST") return route.continue();
    requests++;
    payload = route.request().postDataJSON();
    await new Promise(resolve => setTimeout(resolve, 200));
    await route.fulfill({ status: 201, json: { bounty: {
      id, status: "open", ...payload, creatorOsuUserId: 12345,
      completedByOsuUserId: null, completionScoreId: null,
      createdAt: "2026-11-01T00:00:00.000Z", completedAt: null, cancelledAt: null,
    } } });
  });
  await page.route(`**/bounties/${id}`, route => route.fulfill({ status: 404, json: { error: "Fixture destination" } }));
  await review(page);
  await expect(page.getByRole("heading", { name: "Review Bounty (6/6)" })).toBeVisible();
  await expect(page.getByText("Stable combo threshold: 99%", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Current Balance:", { exact: true })).toBeVisible();
  await expect(page.getByText("Base Reward:", { exact: true })).toBeVisible();
  expect(requests).toBe(0);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByText("Current Balance:", { exact: true })).toHaveCount(0);
  await page.getByRole("spinbutton").fill("25");
  await expect(page.getByLabel("Reward cost summary")).toContainText("Total: 28 BP");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const create = page.getByRole("button", { name: "Create bounty · 28 BP", exact: true });
  const refresh = page.waitForRequest("**/auth/me");
  await create.click();
  await expect(page.getByRole("button", { name: "Creating…" })).toBeDisabled();
  await refresh;
  await expect(page).toHaveURL(`/bounties/${id}`);
  expect(requests).toBe(1);
  expect(payload).toEqual({ rewardBp: 25, goal: {
    type: "full_combo", beatmapId: 123456, beatmapChecksum: null,
    modRequirement: { rule: "any" }, minimumComboRatio: 0.99,
  } });
});

for (const scenario of ["funding", "session", "network"] as const) {
  test(`review handles ${scenario} failure without losing the draft`, async ({ page }) => {
    await review(page);
    await page.route("**/bounties", route => scenario === "network" ? route.abort() : route.fulfill({
      status: scenario === "session" ? 401 : 409,
      json: { code: scenario === "session" ? "UNAUTHENTICATED" : "INSUFFICIENT_BP", error: "Rejected" },
    }));
    if (scenario !== "network") await page.route("**/auth/me", route => route.fulfill(scenario === "session" ? {
      status: 401, json: { error: "Expired" },
    } : { json: { identity: { id, osuUserId: 12345, username: "fixture" }, stats: { bpBalance: 0 }, createdAt: "2025-01-01T00:00:00.000Z" } }));
    await page.getByRole("button", { name: "Create bounty · 110 BP" }).click();
    await expect(page.getByRole("alert").filter({ hasText: scenario === "session" ? "session expired" : scenario === "funding" ? "no longer have enough BP" : "Could not confirm creation" })).toBeVisible();
    if (scenario !== "network") await expect(page.getByRole("button", { name: "Create bounty · 110 BP" })).toBeDisabled();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByRole("spinbutton")).toHaveValue("100");
  });
}

test("review reflects grade, accuracy and exact NM choices", async ({ page }) => {
  await review(page);
  const back = page.getByRole("button", { name: "Back", exact: true });
  const next = page.getByRole("button", { name: "Continue", exact: true });
  await back.click();
  await back.click();
  await back.click();
  await page.getByText("Minimum Grade", { exact: true }).last().click();
  await page.getByRole("checkbox", { name: "Require minimum accuracy", exact: true }).check();
  await next.click();
  await page.getByText("Exact mods", { exact: true }).click();
  await next.click();
  await next.click();
  await expect(page.getByText("Acc. ≥95%", { exact: true })).toBeVisible();
  await expect(page.getByText("Stable combo threshold:", { exact: false })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Create bounty · 110 BP" })).toBeEnabled();
  await expect(page.getByText("Hunter reward:", { exact: false })).toHaveCount(0);
});

test("turning off combo customization restores the default in Review", async ({ page }) => {
  await review(page);
  const back = page.getByRole("button", { name: "Back", exact: true });
  const next = page.getByRole("button", { name: "Continue", exact: true });
  await back.click();
  await back.click();
  await back.click();
  const customize = page.getByRole("checkbox", { name: /Customize stable combo threshold/ });
  await customize.check();
  await page.getByRole("slider").fill("80");
  await next.click();
  await next.click();
  await next.click();
  await expect(page.getByText("Stable combo threshold: 80%", { exact: true })).toBeVisible();
  await back.click();
  await back.click();
  await back.click();
  await customize.uncheck();
  await next.click();
  await next.click();
  await next.click();
  await expect(page.getByText("Stable combo threshold: 99%", { exact: true })).toHaveCount(0);
});

test("creation flow fits a narrow mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await review(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
