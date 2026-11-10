import { expect, test } from "@playwright/test";

for (const width of [320, 640, 1280]) {
  test(`wizard Back/Continue icons preserve navigation and fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.origin === "http://127.0.0.1:3100") return route.continue();
      if (url.pathname === "/auth/me") return route.fulfill({ json: {
        identity: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", osuUserId: 123, username: "fixture" },
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
    const next = page.getByRole("button", { name: "Continue", exact: true });
    const back = page.getByRole("button", { name: "Back", exact: true });
    async function checkIcon(control: typeof next, side: "left" | "right") {
      await expect(control.locator("svg")).toHaveAttribute("aria-hidden", "true");
      await expect(control.locator("svg")).toHaveAttribute("focusable", "false");
      expect(await control.evaluate((element, side) => {
        const icon = element.querySelector("svg")!;
        const label = [...element.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent!.trim());
        if (!label) return false;
        const range = document.createRange();
        range.selectNode(label);
        const textBounds = range.getBoundingClientRect();
        const iconBounds = icon.getBoundingClientRect();
        return element.scrollWidth <= element.clientWidth && (side === "left" ? iconBounds.right <= textBounds.left : iconBounds.left >= textBounds.right);
      }, side)).toBe(true);
    }
    for (let step = 1; step <= 5; step++) {
      await expect(next).toBeVisible();
      if (step === 2) {
        await page.getByRole("textbox", { name: "beatmap input" }).fill("123456");
      }
      await expect(next).toBeEnabled();
      await checkIcon(next, "right");
      if (step > 1) await checkIcon(back, "left");
      await next.focus();
      await page.keyboard.press("Enter");
    }
    await expect(page.getByRole("heading", { name: "Review Bounty (6/6)" })).toBeVisible();
    await checkIcon(back, "left");
    for (let step = 6; step > 1; step--) {
      await back.click();
    }
    await expect(page.getByText("Logged in as fixture", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
