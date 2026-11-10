import { expect, test } from "@playwright/test";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const pages = [
  ["/bounties", "Bounty Board"],
  ["/bounties/creation-tool", "Bounty Creation Tool"],
  [`/bounties/${id}`, "Bounty Details"],
  ["/about", "About - Marksman"],
  ["/about/bounties", "About - Bounties"],
  ["/about/bounty-creation", "About - Bounty Creation"],
  ["/about/hunting", "About - Hunting"],
  ["/about/economy", "About - Economy"],
];
for (const width of [320, 640, 1280]) {
  test(`page header icons preserve heading names and fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.origin === "http://127.0.0.1:3100") return route.continue();
      if (url.pathname === "/auth/me") return route.fulfill({ json: {
        identity: { id, osuUserId: 42, username: "fixture" }, stats: { bpBalance: 1000 }, createdAt: "2026-01-01T00:00:00.000Z",
      } });
      if (url.pathname === "/auth/access") return route.fulfill({ status: 204 });
      if (url.pathname === "/bounties") return route.fulfill({ json: { items: [], total: 0, page: 1, pageSize: 20 } });
      if (url.pathname === `/bounties/${id}`) return route.fulfill({ json: {
        id, status: "open", rewardBp: 100, creatorOsuUserId: 42,
        createdAt: "2026-01-01T00:00:00.000Z", completedAt: null, cancelledAt: null,
        completedByOsuUserId: null, completionScoreId: null,
        goal: { type: "pass", beatmapId: 42, beatmapChecksum: null, modRequirement: { rule: "any" } },
        beatmap: null, owner: null, winner: null,
        engagement: { bookmarkCount: 0, isBookmarkedByCurrentUser: false },
      } });
      return route.abort();
    });
    for (const [path, title] of pages) {
      await page.goto(path);
      const heading = page.getByRole("heading", { level: 1, name: title, exact: true });
      await expect(heading).toBeVisible();
      await expect(heading.locator("svg")).toHaveCount(1);
      await expect(heading.locator("svg")).toHaveAttribute("aria-hidden", "true");
      await expect(heading.locator("svg")).toHaveAttribute("focusable", "false");
      expect(await heading.evaluate(element => {
        const parent = element.getBoundingClientRect();
        const icon = element.querySelector("svg")!.getBoundingClientRect();
        const text = element.querySelector("span")!.getBoundingClientRect();
        return icon.right <= text.left && icon.left >= parent.left && text.right <= parent.right && element.scrollWidth <= element.clientWidth;
      })).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
}
