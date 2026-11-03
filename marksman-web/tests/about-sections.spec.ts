import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/auth/me", route => route.fulfill({ status: 401, json: { error: "Signed out" } }));
});

test("reward tiers fit narrow screens without overlapping labels or thresholds", async ({ page }) => {
  for (const width of [320, 375, 390, 768]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/about/bounties#reward-tiers");
    await page.evaluate(() => document.fonts.ready);
    const section = page.locator("#reward-tiers");
    const badges = section.locator('[title^="Reward tier:"]');
    await expect(badges).toHaveCount(6);
    const measurements = await badges.evaluateAll(elements => elements.map(badge => {
      const row = badge.parentElement!;
      const threshold = badge.nextElementSibling!;
      const table = row.parentElement!.getBoundingClientRect();
      const label = badge.lastElementChild!.getBoundingClientRect();
      const bounds = badge.getBoundingClientRect();
      const value = threshold.getBoundingClientRect();
      return {
        labelFits: label.left >= bounds.left && label.right <= bounds.right,
        separated: bounds.right <= value.left,
        contained: bounds.left >= table.left && value.right <= table.right,
      };
    }));
    for (const measurement of measurements) {
      expect(measurement, `tier layout at ${width}px`).toEqual({
        labelFits: true, separated: true, contained: true,
      });
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test("section links update the URL and highlight only the selected section through history and reload", async ({ page }) => {
  await page.goto("/about#core-concept");
  const core = page.locator("#core-concept");
  const how = page.locator("#how-to-play");
  await expect(core).toHaveAttribute("data-selected", "true");
  const border = await core.evaluate(el => getComputedStyle(el).borderColor);
  await expect(core).toHaveJSProperty("id", "core-concept");
  expect(await how.evaluate(el => getComputedStyle(el).borderColor)).not.toBe(border);
  await page.getByRole("link", { name: "# How to play?", exact: true }).click();
  await expect(page).toHaveURL(/\/about#how-to-play$/);
  await expect(how).toHaveAttribute("data-selected", "true");
  expect(await how.evaluate(el => getComputedStyle(el).borderColor)).toBe(border);
  expect(await core.evaluate(el => getComputedStyle(el).borderColor)).not.toBe(border);
  await page.reload();
  await expect(how).toHaveAttribute("data-selected", "true");
  expect(await how.evaluate(el => getComputedStyle(el).borderColor)).toBe(border);
  await page.goBack();
  await expect(page).toHaveURL(/\/about#core-concept$/);
  await expect(core).toHaveAttribute("data-selected", "true");
  expect(await core.evaluate(el => getComputedStyle(el).borderColor)).toBe(border);
});

test("nested bounty sections support direct links and keyboard selection", async ({ page }) => {
  await page.goto("/about/bounties#full-combo");
  const fc = page.locator("#full-combo");
  await expect(fc).toHaveAttribute("data-selected", "true");
  const selectedBorder = await fc.evaluate(el => getComputedStyle(el).borderColor);
  expect(await page.locator("#goal-types").evaluate(el => getComputedStyle(el).borderColor)).not.toBe(selectedBorder);
  const link = page.getByRole("link", { name: "Link to included mods", exact: true });
  await link.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#included-mods$/);
  await expect(page.locator("#included-mods")).toHaveAttribute("data-selected", "true");
  expect(await page.locator("#included-mods").evaluate(el => getComputedStyle(el).borderColor)).toBe(selectedBorder);
  expect(await fc.evaluate(el => getComputedStyle(el).borderColor)).not.toBe(selectedBorder);
});

test("client navigation to another page selects its fragment without a reload", async ({ page }) => {
  await page.goto("/about/bounties#full-combo");
  await page.evaluate(() => { (window as unknown as { navigationMarker: boolean }).navigationMarker = true; });
  await page.getByRole("link", { name: "valid score", exact: true }).first().click();
  await expect(page).toHaveURL(/\/about\/hunting#what-is-valid-score$/);
  const selected = page.locator("#what-is-valid-score");
  await expect(selected).toHaveAttribute("data-selected", "true");
  const accentBorder = await selected.evaluate(el => getComputedStyle(el).borderColor);
  expect(await page.locator("#what-is-hunting").evaluate(el => getComputedStyle(el).borderColor)).not.toBe(accentBorder);
  expect(await page.evaluate(() => (window as unknown as { navigationMarker: boolean }).navigationMarker)).toBe(true);
  await page.goBack();
  await expect(page.locator("#full-combo")).toHaveAttribute("data-selected", "true");
  await page.getByRole("link", { name: "hunting system", exact: true }).click();
  await expect(page).toHaveURL(/\/about\/hunting$/);
  await expect(page.locator("section[data-selected=true]")).toHaveCount(0);
});
