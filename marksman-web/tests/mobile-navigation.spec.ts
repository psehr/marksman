import { expect, test } from "@playwright/test";

test("mobile navigation opens, closes with Escape and follows links", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route("**/auth/me", route => route.fulfill({ status: 401, json: { error: "Signed out" } }));
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  const toggle = nav.getByRole("button");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(nav.getByRole("link", { name: "Rankings", exact: true })).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(nav.getByRole("link", { name: "Log in with osu!" })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(nav.getByRole("link", { name: "Bounties", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();
  await toggle.click();
  await nav.getByRole("link", { name: "Rankings", exact: true }).click();
  await expect(page).toHaveURL("/rankings");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(toggle).toBeHidden();
  await expect(nav.getByRole("link", { name: "Rankings", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 812 });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test("mobile profile link uses signed-in identity and closes the menu", async ({ page }) => {
  const id = "12345678-1234-4234-8234-123456789abc";
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/auth/me", route => route.fulfill({ json: {
    identity: { id, osuUserId: 12345, username: "fixture" },
    stats: { bpBalance: 1000 }, createdAt: "2025-01-01T00:00:00.000Z",
  } }));
  await page.route(`**/users/${id}`, route => route.fulfill({ status: 404, json: { error: "Fixture" } }));
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await nav.getByRole("button").click();
  const profile = nav.getByRole("link", { name: "Profile", exact: true });
  await expect(profile).toHaveAttribute("href", `/users/${id}`);
  await profile.click();
  await expect(page).toHaveURL(`/users/${id}`);
  await expect(nav.getByRole("button")).toHaveAttribute("aria-expanded", "false");
});
