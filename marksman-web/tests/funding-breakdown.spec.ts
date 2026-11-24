import { expect, test } from '@playwright/test';
import type { ExtendedBounty, UserIdentity } from '@marksman/contracts';

const identity: UserIdentity = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', osuUserId: 42, username: 'WWWWWWWWWWWWWWWW', coverUrl: null, countryCode: null, countryName: null };
const bounty: ExtendedBounty = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', status: 'open', rewardBp: 1000000,
  creatorOsuUserId: 43, createdAt: '2026-01-01T00:00:00.000Z', completedAt: null, cancelledAt: null, completedByOsuUserId: null, completionScoreId: null,
  goal: { type: 'pass', beatmapId: 42, beatmapChecksum: null, modRequirement: { required: [], forbidden: [], allowOtherMods: true } },
  owner: null, winner: null, beatmap: null, engagement: { hunterCount: 0, bookmarkCount: 0, isBookmarkedByCurrentUser: false },
};
for (const width of [320, 390, 640, 768, 1280]) {
  test(`centered funding amount remains clear and clickable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/*', route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === '/_next/image') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#789"/></svg>' });
      if (url.pathname === '/auth/me') return route.fulfill({ json: { identity, stats: { bpBalance: 100 }, createdAt: '2026-01-01T00:00:00.000Z' } });
      if (url.pathname === '/auth/access') return route.fulfill({ status: 204 });
      if (url.pathname === '/users/me/hunts') return route.fulfill({ json: [] });
      if (url.pathname === `/bounties/${bounty.id}/contributions`) return route.fulfill({ json: [{ user: identity, amountBp: 1000000 }] });
      if (url.pathname === `/bounties/${bounty.id}` && request.resourceType() === 'fetch') return route.fulfill({ json: bounty });
      if (url.origin === 'http://127.0.0.1:3100') return route.continue();
      return route.abort();
    });
    await page.goto(`/bounties/${bounty.id}?view=funding`);
    const row = page.locator('li').filter({ has: page.getByRole('link', { name: `${identity.username}'s Marksman profile`, exact: true }) });
    await expect(row).toBeVisible();
    const amount = row.locator('span').filter({ hasText: '1,000,000' }).first();
    const name = row.locator('p');
    const image = row.locator('img').first();
    const amountBox = (await amount.boundingBox())!;
    for (const item of [name, image]) {
      const box = (await item.boundingBox())!;
      const overlap = Math.min(box.x + box.width, amountBox.x + amountBox.width) > Math.max(box.x, amountBox.x)
        && Math.min(box.y + box.height, amountBox.y + amountBox.height) > Math.max(box.y, amountBox.y);
      expect(overlap, 'amount must not overlap username or avatar').toBe(false);
    }
    const centerHitsLink = await amount.evaluate(el => {
      const box = el.getBoundingClientRect();
      return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest('a')?.getAttribute('href');
    });
    if (width >= 640) expect(centerHitsLink).toBe(`/users/${identity.id}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const link = row.getByRole('link');
    await expect(link).toHaveAttribute('href', `/users/${identity.id}`);
    expect(await link.getAttribute('target')).toBeNull();
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/users/${identity.id}$`));
    expect(page.context().pages()).toHaveLength(1);
  });
}

async function setupFlow(page: import('@playwright/test').Page) {
  const state = { reward: 100, amount: 100, reads: 0, posts: 0, balance: 1000 };
  await page.route('**/*', route => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname === '/_next/image') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"/>' });
    if (url.pathname === '/auth/me') return route.fulfill({ json: { identity, stats: { bpBalance: state.balance }, createdAt: '2026-01-01T00:00:00.000Z' } });
    if (url.pathname === '/auth/access') return route.fulfill({ status: 204 });
    if (url.pathname === '/users/me/hunts') return route.fulfill({ json: [] });
    if (url.pathname === `/bounties/${bounty.id}/contributions`) {
      if (req.method() === 'POST') {
        state.posts++;
        const input = req.postDataJSON();
        state.reward += input.amountBp;
        state.amount += input.amountBp;
        state.balance -= input.amountBp + Math.ceil(input.amountBp / 10);
        return route.fulfill({ json: { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', bountyId: bounty.id, userId: identity.id, amountBp: input.amountBp, feeBp: Math.ceil(input.amountBp / 10), createdAt: '2026-01-01T00:00:00.000Z' } });
      }
      state.reads++;
      return route.fulfill({ json: [{ user: identity, amountBp: state.amount }] });
    }
    if (url.pathname === `/bounties/${bounty.id}` && req.resourceType() === 'fetch') return route.fulfill({ json: { ...bounty, rewardBp: state.reward } });
    if (url.origin === 'http://127.0.0.1:3100') return route.continue();
    return route.abort();
  });
  return state;
}
const fundingUrl = `**/bounties/${bounty.id}/contributions`;
const fundingLink = (page: import('@playwright/test').Page) => page.getByRole('link', { name: `${identity.username}'s Marksman profile`, exact: true });

test('funding reads lazily and shows loading then an empty state', async ({ page }) => {
  const state = await setupFlow(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(fundingUrl, async route => { state.reads++; await gate; await route.fulfill({ json: [] }); });
  await page.goto(`/bounties/${bounty.id}`);
  await expect(page.getByRole('button', { name: 'Funding', exact: true })).toBeVisible();
  expect(state.reads).toBe(0);
  await page.getByRole('button', { name: 'Funding', exact: true }).click();
  await expect(page.getByText('Loading funding...', { exact: true })).toBeVisible();
  release();
  await expect(page.getByText('No funding recorded.', { exact: true })).toBeVisible();
});

for (const failure of ['http', 'network', 'schema']) {
  test(`funding recovers from ${failure} failure through Retry`, async ({ page }) => {
    await setupFlow(page);
    let fail = true;
    await page.route(fundingUrl, route => {
      if (!fail) return route.fulfill({ json: [{ user: identity, amountBp: 100 }] });
      if (failure === 'network') return route.abort('failed');
      return failure === 'http' ? route.fulfill({ status: 503, json: { error: 'Unavailable' } }) : route.fulfill({ json: [{}] });
    });
    await page.goto(`/bounties/${bounty.id}?view=funding`);
    await expect(page.getByRole('alert').filter({ hasText: 'Could not load funding.' })).toBeVisible();
    fail = false;
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(fundingLink(page)).toBeVisible();
    await expect(page.getByText('Could not load funding.', { exact: true })).toHaveCount(0);
  });
}

test('successful funding refreshes the mounted breakdown and account balance', async ({ page }) => {
  const state = await setupFlow(page);
  await page.goto(`/bounties/${bounty.id}?view=funding`);
  await expect(fundingLink(page)).toBeVisible();
  const row = page.locator('li').filter({ has: fundingLink(page) });
  await expect(row).toContainText('100');
  await page.getByRole('button', { name: 'Fund bounty', exact: true }).click();
  await page.getByLabel('Contribution (BP)').fill('11');
  await page.getByRole('button', { name: 'Confirm contribution', exact: true }).click();
  await expect(row).toContainText('111');
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByLabel('Your BP balance')).toHaveText('987');
  expect(state.posts).toBe(1);
  expect(state.reads).toBeGreaterThanOrEqual(2);
});

test('leaving Funding discards the old response and reopening reads fresh data', async ({ page }) => {
  const state = await setupFlow(page);
  let release!: () => void;
  let finished!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const oldFinished = new Promise<void>(resolve => { finished = resolve; });
  let reads = 0;
  await page.route(fundingUrl, async route => {
    if (++reads === 1) { await gate; await route.fulfill({ json: [{ user: identity, amountBp: 1 }] }); finished(); }
    else await route.fulfill({ json: [{ user: identity, amountBp: 100 }] });
  });
  await page.goto(`/bounties/${bounty.id}?view=funding`);
  await expect(page.getByText('Loading funding...', { exact: true })).toBeVisible();
  await expect.poll(() => reads).toBe(1);
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.getByRole('button', { name: 'Funding', exact: true }).click();
  const row = page.locator('li').filter({ has: fundingLink(page) });
  await expect(row).toContainText('100');
  release();
  await oldFinished;
  await expect(row).toContainText('100');
});
