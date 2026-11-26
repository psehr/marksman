import { mockAvatars } from "./fixtures/avatars";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await mockAvatars(page);
  await page.route("**/users/me/hunts", route => route.fulfill({ json: [] }));
});

test("mobile navigation opens, closes with Escape and follows links", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route("**/auth/me", route => route.fulfill({ status: 401, json: { error: "Signed out" } }));
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  const toggle = nav.getByRole("button", { includeHidden: true });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(nav.getByRole("link", { name: "Rankings", exact: true })).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(nav.getByRole("link", { name: "Log in with osu!" })).toBeVisible();
  await expect(nav.getByLabel("Your BP balance")).toHaveCount(0);
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
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(nav.getByRole("link", { name: "Rankings", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 812 });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test("mobile profile link uses signed-in identity and closes the menu", async ({ page }) => {
  const id = "12345678-1234-4234-8234-123456789abc";
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/auth/me", route => route.fulfill({ json: {
    identity: { coverUrl: null, countryCode: null, countryName: null, id, osuUserId: 12345, username: "fixture" },
    stats: { bpBalance: 1000 }, createdAt: "2025-01-01T00:00:00.000Z",
  } }));
  await page.route("**/auth/access", route => route.fulfill({ status: 204 }));
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

for (const width of [320, 390, 768, 1280]) {
  for (const balance of [0, 1_000_000]) {
    test(`navbar balance ${balance} appears below username at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.route("**/auth/me", route => route.fulfill({ json: {
        identity: { coverUrl: null, countryCode: null, countryName: null, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", osuUserId: 123, username: "fixture" },
        stats: { bpBalance: balance }, createdAt: "2026-01-01T00:00:00.000Z",
      } }));
      await page.route("**/auth/access", route => route.fulfill({ status: 204 }));
      await page.goto("/");
      const nav = page.getByRole("navigation", { name: "Main navigation" });
      if (width < 768) await nav.getByRole("button", { name: "Open navigation" }).click();
      const amount = nav.getByLabel("Your BP balance");
      await expect(amount).toHaveText(balance === 0 ? "0" : "1,000,000");
      await expect(amount.getByRole("img", { name: "Bounty Points" })).toBeVisible();
      const profile = nav.getByRole("link", { name: "Profile", exact: true });
      await expect(profile).toBeVisible();
      const avatar = profile.locator('img[alt=""]');
      await expect(avatar).toBeVisible();
      expect(new URL((await avatar.getAttribute("src"))!, "http://127.0.0.1:3100").searchParams.get("url")).toBe("https://a.ppy.sh/123");
      await expect.poll(() => avatar.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      const avatarBox = (await avatar.boundingBox())!;
      expect(avatarBox.width).toBe(36);
      expect(avatarBox.height).toBe(36);
      expect(await avatar.evaluate(el => parseFloat(getComputedStyle(el).borderRadius))).toBeGreaterThanOrEqual(18);
      const amountBox = (await amount.boundingBox())!;
      const profileBox = (await profile.boundingBox())!;
      const username = profile.getByText("fixture", { exact: true });
      const usernameBox = (await username.boundingBox())!;
      expect(avatarBox.x + avatarBox.width).toBeLessThan(usernameBox.x);
      expect(amountBox.y).toBeGreaterThanOrEqual(usernameBox.y + usernameBox.height);
      expect(amountBox.x).toBeGreaterThan(profileBox.x);
      expect(amountBox.x + amountBox.width).toBeLessThan(profileBox.x + profileBox.width);
      if (balance === 1_000_000 && (width === 320 || width === 1280)) {
        await page.screenshot({ path: `/tmp/marksman-navbar-card-${width}.png`, fullPage: true });
      }
      expect(await nav.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      if (width < 768) {
        const menuBox = (await page.locator("#mobile-navigation").boundingBox())!;
        const slotsBox = (await nav.getByRole("group", { name: "Hunting slots", exact: true }).boundingBox())!;
        expect(Math.abs(profileBox.x + profileBox.width - menuBox.x - menuBox.width)).toBeLessThan(2);
        expect(Math.abs(slotsBox.x - menuBox.x)).toBeLessThan(2);
        expect(slotsBox.x + slotsBox.width).toBeLessThan(profileBox.x);
        for (const name of ["Bounties", "Rankings", "Wiki"]) {
          const link = nav.getByRole("link", { name, exact: true });
          expect(await link.evaluate(el => getComputedStyle(el).textAlign)).toBe("center");
        }
      }
      if (width >= 768) {
        const wikiBox = (await nav.getByRole("link", { name: "Wiki", exact: true }).boundingBox())!;
        expect(wikiBox.x + wikiBox.width).toBeLessThan(profileBox.x);
      }
    });
  }
}
