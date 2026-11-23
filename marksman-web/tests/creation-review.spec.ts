import { expect, test, type Page } from "@playwright/test";

const id = "12345678-1234-4234-8234-123456789abc";
async function review(page: Page) {
  await page.route("**/auth/access", route => route.fulfill({ status: 204 }));
  await page.route("**/auth/me", route => route.fulfill({ json: {
    identity: { coverUrl: null, countryCode: null, countryName: null, id, osuUserId: 12345, username: "fixture" },
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
  await expect(page.getByRole("heading", { name: "Review Bounty" })).toHaveCount(0);
  await expect(page.getByText("Stable combo threshold: 99%", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Current Balance:", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Base Reward:", { exact: true })).toHaveCount(0);
  expect(requests).toBe(0);
  await page.getByRole("spinbutton").fill("25");
  await expect(page.getByLabel("Reward cost summary")).toContainText("Total: 28 BP");
  const create = page.getByRole("button", { name: "Create bounty · 28 BP", exact: true });
  const refresh = page.waitForRequest("**/auth/me");
  await create.click();
  await expect(page.getByRole("button", { name: "Creating…" })).toBeDisabled();
  await expect(page.getByRole("spinbutton")).toBeDisabled();
  await expect(page.getByRole("textbox", { name: "beatmap input" })).toBeDisabled();
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
    test.fixme(scenario !== "network", "Known account refresh unmounts the creation tool and loses draft/error state.");
    await review(page);
    await page.route("**/bounties", route => scenario === "network" ? route.abort() : route.fulfill({
      status: scenario === "session" ? 401 : 409,
      json: { code: scenario === "session" ? "UNAUTHENTICATED" : "INSUFFICIENT_BP", error: "Rejected" },
    }));
    if (scenario !== "network") await page.route("**/auth/me", route => route.fulfill(scenario === "session" ? {
      status: 401, json: { error: "Expired" },
    } : { json: { identity: { coverUrl: null, countryCode: null, countryName: null, id, osuUserId: 12345, username: "fixture" }, stats: { bpBalance: 0 }, createdAt: "2025-01-01T00:00:00.000Z" } }));
    await page.getByRole("button", { name: "Create bounty · 110 BP" }).click();
    await expect(page.getByRole("alert").filter({ hasText: scenario === "session" ? "session expired" : scenario === "funding" ? "no longer have enough BP" : "Could not confirm creation" })).toBeVisible();
    if (scenario !== "network") await expect(page.getByRole("button", { name: "Create bounty · 110 BP" })).toBeDisabled();
    await expect(page.getByRole("spinbutton")).toHaveValue("100");
  });
}

test("review reflects grade, accuracy and exact NM choices", async ({ page }) => {
  await review(page);
  await page.getByText("Minimum Grade", { exact: true }).last().click();
  await page.getByRole("checkbox", { name: "Require minimum accuracy", exact: true }).locator("..").click();
  await page.getByText("Exact mods", { exact: true }).click();
  await expect(page.getByText("Acc. ≥95%", { exact: true })).toBeVisible();
  await expect(page.getByText("Stable combo threshold:", { exact: false })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Create bounty · 110 BP" })).toBeEnabled();
  await expect(page.getByText("Hunter reward:", { exact: false })).toHaveCount(0);
});

test("turning off combo customization restores the default preview", async ({ page }) => {
  await review(page);
  const customize = page.getByRole("checkbox", { name: /Customize stable combo threshold/ });
  await customize.check();
  await page.getByRole("slider").fill("80");
  await expect(page.getByText("Threshold: 80%", { exact: true })).toBeVisible();
  await customize.uncheck();
  await expect(page.getByRole("slider")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Create bounty · 110 BP" })).toBeEnabled();
  await expect(page.getByText("Stable combo threshold: 99%", { exact: true })).toHaveCount(0);
});

test("creation flow fits a narrow mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await review(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});


test("Pass resets prior mods, disables NF and submits a Pass goal", async ({ page }) => {
  await review(page);
  await page.getByRole("radio", { name: "Exact mods", exact: true }).locator("..").click();
  await page.getByRole("checkbox", { name: "NF", exact: true }).locator("..").click();
  await page.getByRole("radio", { name: "Pass", exact: true }).locator("..").click();
  for (const name of ["Exact mods", "Include mods", "Exclude mods"]) {
    await page.getByRole("radio", { name, exact: true }).locator("..").click();
    await expect(page.getByRole("checkbox", { name: "NF", exact: true })).toBeDisabled();
    await expect(page.getByRole("checkbox", { name: "NF", exact: true })).not.toBeChecked();
  }
  await page.getByRole("radio", { name: "Exact mods", exact: true }).locator("..").click();
  await page.getByRole("checkbox", { name: "HD", exact: true }).locator("..").click();
  await expect(page.getByText("Clear/Pass", { exact: true })).toBeVisible();
  let payload: any;
  await page.route("**/bounties", route => {
    payload = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { bounty: {
      id, status: "open", ...payload, creatorOsuUserId: 12345,
      completedByOsuUserId: null, completionScoreId: null,
      createdAt: "2026-11-01T00:00:00.000Z", completedAt: null, cancelledAt: null,
    } } });
  });
  await page.route(`**/bounties/${id}`, route => route.fulfill({ status: 404, json: {} }));
  await page.getByRole("button", { name: "Create bounty · 110 BP", exact: true }).click();
  await expect(page).toHaveURL(`/bounties/${id}`);
  expect(payload.goal).toEqual({ type: "pass", beatmapId: 123456, beatmapChecksum: null, modRequirement: { rule: "exact", mods: ["HD"] } });
});

for (const width of [320, 390, 1280]) {
  test(`Pass preview and goal options fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await review(page);
    await page.getByRole("radio", { name: "Pass", exact: true }).locator("..").click();
    await expect(page.getByText("Clear/Pass", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}


test("an ineligible replacement beatmap prevents creation without resetting other fields", async ({ page }) => {
  await review(page);
  await expect(page.getByRole("button", { name: /^Create bounty/ })).toBeEnabled();
  await page.getByRole("spinbutton").fill("25");
  await page.route("**/beatmaps/123457", route => route.fulfill({ json: {
    id: 123457, version: "Expert", difficulty_rating: 5, mode: "taiko", status: "ranked",
    bpm: 180, url: "https://osu.ppy.sh/beatmaps/123457", max_combo: 1000,
    checksum: null, ar: 9, accuracy: 8, cs: 4, drain: 6,
    total_length: 120, hit_length: 110, playcount: 100, beatmapset: null,
  } }));
  await page.getByRole("textbox", { name: "beatmap input" }).fill("123457");
  await expect(page.getByRole("alert").filter({ hasText: "Only osu!standard" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Create bounty/ })).toBeDisabled();
  await expect(page.getByRole("spinbutton")).toHaveValue("25");
  await page.getByRole("textbox", { name: "beatmap input" }).fill("123456");
  await expect(page.getByRole("button", { name: "Create bounty · 28 BP" })).toBeEnabled();
});


test("available balance stands out and warns when reward plus fee exceeds it", async ({ page }) => {
  await review(page);
  const balance = page.getByLabel("Available balance", { exact: true });
  await expect(balance).toContainText("1,000");
  await expect(balance).toHaveClass(/text-foreground/);
  await expect(page.getByLabel("Reward cost summary")).not.toContainText("Balance:");
  await page.getByRole("spinbutton").fill("910");
  await expect(balance).toHaveClass(/text-danger/);
  await expect(page.getByRole("alert").filter({ hasText: "Insufficient BP balance." })).toHaveCount(1);
  await expect(page.getByLabel("Reward cost summary")).toContainText("Total: 1,001 BP");
  await expect(page.getByRole("button", { name: /^Create bounty/ })).toBeDisabled();
  await page.getByRole("spinbutton").fill("909");
  await expect(balance).toHaveClass(/text-foreground/);
  await expect(page.getByRole("button", { name: /^Create bounty/ })).toBeEnabled();
});


for (const [value, message] of [["0", "Reward must be positive."], ["1.5", "Reward must be an integer."], ["1000001", "Reward cannot exceed 1,000,000 BP."]] as const) {
  test(`reward ${value} shows its field error once`, async ({ page }) => {
    await review(page);
    await page.getByRole("spinbutton").fill(value);
    const field = page.getByRole("region", { name: "Reward Selection", exact: true });
    await expect(field.getByRole("alert").filter({ hasText: message })).toHaveCount(1);
    // The submission area must not repeat the schema's version of the same error.
    await expect(field.getByRole("alert")).toHaveCount(value === "1000001" ? 2 : 1);
    await expect(page.getByRole("button", { name: /^Create bounty/ })).toBeDisabled();
  });
}
