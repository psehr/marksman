import { expect, test } from "@playwright/test";
import type { User } from "@marksman/contracts";
import { detailedUserFixture } from "./fixtures/users";

for (const width of [320, 390, 1024, 1280]) {
  for (const populated of [true, false]) {
    for (const isOwner of [true, false]) {
      test(`player card at ${width}px with ${populated ? 'cover and country' : 'missing profile data'} as ${isOwner ? 'owner' : 'visitor'}`, async ({ page }) => {
        const user: User = {
          identity: {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", osuUserId: 42,
            username: "WWWWWWWWWWWWWWWW",
            coverUrl: populated ? "https://assets.ppy.sh/user-profile-covers/42/fixture.jpeg" : null,
            countryCode: populated ? "FR" : null, countryName: populated ? "France" : null,
          },
          stats: { bpBalance: 100 }, createdAt: "2026-01-01T00:00:00.000Z",
        };
        await page.setViewportSize({ width, height: 1000 });
        const errors: string[] = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', async route => {
          const request = route.request();
          const url = new URL(request.url());
          if (url.pathname === '/_next/image') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60"><rect width="80" height="60" fill="#789"/></svg>' });
          if (url.pathname === '/auth/me') return route.fulfill({ json: isOwner ? user : { ...user, identity: { ...user.identity, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', osuUserId: 43, username: 'visitor' } } });
          if (url.pathname === '/auth/access') return route.fulfill({ status: 204 });
          if (url.pathname === `/users/${user.identity.id}` && request.resourceType() === 'fetch') return route.fulfill({ json: detailedUserFixture(user) });
          if (url.pathname.endsWith('/hunts') || url.pathname.endsWith('/bounty-events')) return route.fulfill({ json: [] });
          if (url.pathname === '/users/me/daily-claim') return route.fulfill({ json: { claimed: true } });
          if (url.pathname === '/bounties' && request.resourceType() === 'fetch') return route.fulfill({ json: { items: [], total: 0, page: 1, pageSize: 20 } });
          if (url.origin === 'http://127.0.0.1:3100') return route.continue();
          return route.abort();
        });
        await page.goto(`/users/${user.identity.id}`);
        const name = page.locator('p').filter({ hasText: user.identity.username });
        await expect(name).toBeVisible();
        const card = page.getByRole('link', { name: `${user.identity.username}'s osu! profile (opens in a new tab)`, exact: true });
        await expect(card).toHaveAttribute('href', 'https://osu.ppy.sh/users/42');
        await expect(card).toHaveAttribute('target', '_blank');
        await expect(card).toHaveAttribute('rel', 'noopener noreferrer');
        const header = card.locator('..');
        const statsGroup = header.locator(':scope > div');
        const statsCards = statsGroup.locator(':scope > div');
        await expect(statsCards).toHaveCount(isOwner ? 3 : 2);
        await expect(statsGroup.getByText('Balance', { exact: true })).toHaveCount(isOwner ? 1 : 0);
        const bounds = (await card.boundingBox())!;
        const groupBounds = (await statsGroup.boundingBox())!;
        for (const stat of await statsCards.all()) {
          expect(await stat.evaluate(el => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight)).toBe(true);
        }
        if (width >= 1024) {
          expect(groupBounds.x).toBeGreaterThanOrEqual(bounds.x + bounds.width);
          expect(Math.abs(groupBounds.y - bounds.y)).toBeLessThan(2);
          expect(groupBounds.width).toBeGreaterThan(bounds.width);
        } else {
          expect(groupBounds.y).toBeGreaterThanOrEqual(bounds.y + bounds.height);
          expect(Math.abs(groupBounds.width - bounds.width)).toBeLessThan(2);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
        for (const element of [name, card]) expect(await element.evaluate(el => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight)).toBe(true);
        const images = card.locator('img');
        await expect(images).toHaveCount(populated ? 3 : 1);
        for (const img of await images.all()) await expect.poll(() => img.evaluate(el => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0)).toBe(true);
        if (populated) {
          const flag = card.getByRole('img', { name: 'France', exact: true });
          await expect(flag).toHaveAttribute('title', 'France');
          const flagBounds = (await flag.boundingBox())!;
          expect(flagBounds.y + flagBounds.height).toBeLessThanOrEqual(bounds.y + bounds.height);
          await expect(flag).toHaveCSS('object-fit', 'contain');
        }
        await page.context().route('https://osu.ppy.sh/users/42', route => route.fulfill({ contentType: 'text/html', body: '<title>Mock osu profile</title>' }));
        for (const activation of ['mouse', 'keyboard']) {
          const popupPromise = page.waitForEvent('popup');
          if (activation === 'mouse') await card.click();
          else {
            await card.focus();
            await expect(card).toBeFocused();
            await card.press('Enter');
          }
          const popup = await popupPromise;
          await expect(popup).toHaveURL('https://osu.ppy.sh/users/42');
          expect(await popup.evaluate(() => window.opener === null)).toBe(true);
          await expect(page).toHaveURL(new RegExp(`/users/${user.identity.id}$`));
          await popup.close();
        }
        expect(errors).toEqual([]);
      });
    }
  }
}
