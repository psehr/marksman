import type { ExtendedBounty, User } from "@marksman/contracts";
import { expect, test, type Page } from "@playwright/test";

const user: User = {
  identity: {
    id: "12345678-1234-4234-8234-123456789abc",
    osuUserId: 12345,
    username: "hunter",
  },
  stats: { bpBalance: 100 },
  createdAt: "2025-01-01T00:00:00.000Z",
};
const bounty: ExtendedBounty = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  status: "open",
  rewardBp: 300,
  creatorOsuUserId: 67890,
  createdAt: "2025-01-02T00:00:00.000Z",
  completedAt: null,
  cancelledAt: null,
  completedByOsuUserId: null,
  completionScoreId: null,
  goal: {
    type: "minimum_grade",
    beatmapId: 42,
    beatmapChecksum: null,
    minimumGradeRequirement: "A",
    modRequirement: { rule: "any" },
  },
  owner: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    osuUserId: 67890,
    username: "mapmaker",
  },
  winner: null,
  engagement: {
    bookmarkCount: 0,
    isBookmarkedByCurrentUser: null,
  },
  beatmap: {
    url: "https://osu.ppy.sh/beatmaps/42",
    version: { id: 42, name: "Expert" },
    song: { title: "Starlight", artist: "Aurora" },
    specs: {
      sr: 5,
      ar: 9,
      od: 8,
      cs: 4,
      hp: 6,
      bpm: 180,
      length: { total: 120, drain: 110 },
      maxCombo: 1000,
    },
    covers: {
      cover: "https://assets.ppy.sh/beatmaps/42/covers/cover.jpg",
      card: "https://assets.ppy.sh/beatmaps/42/covers/card.jpg",
    },
    creator: { id: 7, username: "mapper" },
    stats: { status: "ranked", playcount: 1000 },
  },
};

async function setupDetail(page: Page, owner = false, signedIn = true, closed = false) {
  const state = { reads: 0, accounts: 0, bounty: { ...bounty, status: closed ? "cancelled" : "open", engagement: { bookmarkCount: 1, isBookmarkedByCurrentUser: closed } } };
  await page.route('**/auth/me', route => {
    state.accounts++;
    return route.fulfill({ status: signedIn ? 200 : 401, json: signedIn ? { ...user, identity: owner ? bounty.owner : user.identity } : {} });
  });
  await page.route(`**/bounties/${bounty.id}`, route => {
    if (route.request().isNavigationRequest() || route.request().headers()['rsc']) return route.fallback();
    state.reads++;
    return route.fulfill({ json: state.bounty });
  });
  await page.route('**/users/me/hunts', route => route.fulfill({ json: [] }));
  await page.route('**/_next/image?**', route => route.fulfill({ status: 204 }));
  return state;
}

for (const action of ['bookmark', 'cancel'] as const) {
  for (const failure of ['http', 'network'] as const) {
    test(`${action}: ${failure} retry, pending lock and refresh on success`, async ({ page }) => {
      const state = await setupDetail(page, action === 'cancel');
      let posts = 0;
      let release!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      await page.route(`**/bounties/${bounty.id}/${action}`, async route => {
        posts++;
        expect(route.request().method()).toBe('POST');
        if (posts === 1) return failure === 'network' ? route.abort('failed') : route.fulfill({ status: 409, json: { error: 'Rejected' } });
        await gate;
        if (action === 'bookmark') {
          state.bounty.engagement.isBookmarkedByCurrentUser = true;
          return route.fulfill({ status: 204 });
        }
        state.bounty.status = 'cancelled';
        return route.fulfill({ json: { bounty: state.bounty } });
      });
      await page.goto(`/bounties/${bounty.id}`);
      const button = page.getByRole('button', { name: action === 'cancel' ? 'Cancel bounty' : 'Bookmark', exact: true });
      await expect(button).toBeEnabled();
      const accounts = state.accounts;
      await button.click();
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(button).toBeEnabled();
      expect(state.accounts).toBe(accounts);
      await button.click();
      const pending = page.getByRole('button', { name: action === 'cancel' ? 'Cancelling...' : 'Saving...', exact: true });
      try {
        await expect(pending).toBeDisabled();
        await pending.evaluate((element: HTMLButtonElement) => element.click());
        expect(posts).toBe(2);
        if (action === 'bookmark') await expect(page.getByRole('button', { name: 'Start Hunt', exact: true })).toBeEnabled();
      } finally { release(); }
      if (action === 'bookmark') await expect(page.getByRole('button', { name: 'Unbookmark', exact: true })).toBeVisible();
      else await expect(page.getByText('There are currently no available actions')).toBeVisible();
      if (action === "cancel") await expect.poll(() => state.accounts).toBeGreaterThan(accounts);
      else expect(state.accounts).toBe(accounts);
    });
  }
}

test('closed bounty allows unbookmark only and accepts an empty success response', async ({ page }) => {
  const state = await setupDetail(page, false, true, true);
  await page.route(`**/bounties/${bounty.id}/unbookmark`, route => {
    state.bounty.engagement.isBookmarkedByCurrentUser = false;
    return route.fulfill({ status: 204 });
  });
  await page.goto(`/bounties/${bounty.id}`);
  await page.getByRole('button', { name: 'Unbookmark', exact: true }).click();
  await expect(page.getByText('There are currently no available actions')).toBeVisible();
  await expect(page.getByRole('button', { name: /Start Hunt|Cancel bounty|Bookmark/ })).toHaveCount(0);
});

test('signed-out detail uses a working OAuth link', async ({ page }) => {
  await setupDetail(page, false, false);
  await page.goto(`/bounties/${bounty.id}`);
  await expect(page.getByRole('link', { name: 'Log in with osu! to interact' })).toHaveAttribute('href', /\/auth\/osu$/);
  await expect(page.getByRole('button', { name: /Bookmark|Cancel bounty|Start Hunt/ })).toHaveCount(0);
});

test('hunt restores ongoing state and stops and starts using shared controls', async ({ page }) => {
  await setupDetail(page);
  const hunt = { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', userId: user.identity.id, bountyId: bounty.id, status: 'ongoing', startedAt: '2026-01-01T00:00:00.000Z', endedAt: null };
  await page.route('**/users/me/hunts', route => route.fulfill({ json: [hunt] }));
  await page.route(`**/hunts/${hunt.id}/stop`, route => route.fulfill({ json: { ...hunt, status: 'stopped', endedAt: '2026-01-02T00:00:00.000Z' } }));
  await page.route(`**/bounties/${bounty.id}/hunt`, route => route.fulfill({ json: hunt }));
  await page.goto(`/bounties/${bounty.id}`);
  await expect(page.getByRole('button', { name: 'Stop Hunt', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Stop Hunt', exact: true }).click();
  await page.getByRole('button', { name: 'Start Hunt', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop Hunt', exact: true })).toBeEnabled();
});

test('failed hunt mutation requires reload before retry and leaves bookmark usable', async ({ page }) => {
  await setupDetail(page);
  let posts = 0;
  await page.route(`**/bounties/${bounty.id}/hunt`, route => {
    posts++;
    return route.abort('failed');
  });
  await page.goto(`/bounties/${bounty.id}`);
  await page.getByRole('button', { name: 'Start Hunt', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Hunt', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Bookmark', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Reload hunts', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start Hunt', exact: true })).toBeEnabled();
  expect(posts).toBe(1);
});

for (const width of [375, 1280]) {
  test(`top hunt and bookmark buttons align at ${width}px without a hunting panel`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setupDetail(page);
    await page.goto(`/bounties/${bounty.id}`);
    const hunt = page.getByRole('button', { name: 'Start Hunt', exact: true });
    const bookmark = page.getByRole('button', { name: 'Bookmark', exact: true });
    await expect(hunt).toBeEnabled();
    const huntBox = (await hunt.boundingBox())!;
    const bookmarkBox = (await bookmark.boundingBox())!;
    expect(huntBox.y).toBe(bookmarkBox.y);
    expect(huntBox.height).toBe(bookmarkBox.height);
    expect(Math.abs(huntBox.width - bookmarkBox.width)).toBeLessThan(1);
    expect(bookmarkBox.x).toBeGreaterThan(huntBox.x + huntBox.width);
    expect(bookmarkBox.x + bookmarkBox.width).toBeLessThanOrEqual(width);
    await expect(page.getByText(/active hunt\(s\)|Scores finished while hunting/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Reload hunts' })).toHaveCount(0);
  });
}

for (const failRefresh of [false, true]) {
  test(`bookmark engagement refresh keeps content mounted (failure: ${failRefresh})`, async ({ page }) => {
    const state = await setupDetail(page);
    let posts = 0;
    let refreshReads = 0;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route(`**/bounties/${bounty.id}/bookmark`, route => {
      posts++;
      state.bounty.engagement.isBookmarkedByCurrentUser = true;
      return route.fulfill({ status: 204 });
    });
    await page.route(`**/bounties/${bounty.id}`, async route => {
      if (route.request().isNavigationRequest() || route.request().headers()['rsc']) return route.fallback();
      if (posts > 0 && ++refreshReads === 1) {
        await gate;
        if (failRefresh) return route.fulfill({ status: 503, json: { error: 'Unavailable' } });
      }
      return route.fulfill({ json: state.bounty });
    });
    await page.goto(`/bounties/${bounty.id}`);
    const hunt = page.getByRole('button', { name: 'Start Hunt', exact: true });
    await expect(hunt).toBeEnabled();
    const handle = await hunt.elementHandle();
    const accounts = state.accounts;
    await page.getByRole('button', { name: 'Bookmark', exact: true }).click();
    try {
      await expect.poll(() => refreshReads).toBe(1);
      await expect(page.getByRole('button', { name: 'Saving...', exact: true })).toBeDisabled();
      await expect(page.getByText('Loading bounty...', { exact: true })).toHaveCount(0);
      expect(await handle!.evaluate(element => element.isConnected)).toBe(true);
      await expect(hunt).toBeEnabled();
    } finally { release(); }
    if (failRefresh) {
      await expect(page.getByRole('alert').filter({ hasText: 'Bookmark change saved' })).toBeVisible();
      await page.getByRole('button', { name: 'Retry refresh', exact: true }).click();
    }
    await expect(page.getByRole('button', { name: 'Unbookmark', exact: true })).toBeEnabled();
    expect(posts).toBe(1);
    expect(state.accounts).toBe(accounts);
    expect(await handle!.evaluate(element => element.isConnected)).toBe(true);
  });
}

for (const width of [320, 375, 390]) {
  test(`mobile beatmap requirement wraps stats and shows focus at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    const state = await setupDetail(page);
    state.bounty.beatmap = { ...bounty.beatmap!, song: { title: 'A very long beatmap title to exercise truncation', artist: 'A very long artist name' }, specs: { ...bounty.beatmap!.specs, length: { total: 3665, drain: 3665 }, sr: 10.25 } };
    await page.goto(`/bounties/${bounty.id}`);
    const link = page.locator('a[href="https://osu.ppy.sh/beatmaps/42"]');
    await expect(link).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start Hunt', exact: true })).toBeEnabled();
    await link.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `/tmp/marksman-detail-mobile-${width}.png`, fullPage: true });
    const metrics = await link.evaluate(element => {
      const box = element.getBoundingClientRect();
      const star = [...element.querySelectorAll('p')].find(p => p.textContent?.includes('★'))!;
      const starBox = star.getBoundingClientRect();
      const stats = star.previousElementSibling!;
      const statsBox = stats.getBoundingClientRect();
      return { left: box.left, right: box.right, width: element.clientWidth, scrollWidth: element.scrollWidth,
        documentWidth: document.documentElement.scrollWidth,
        statsRight: statsBox.right, starLeft: starBox.left, bottomDifference: Math.abs(statsBox.bottom - starBox.bottom),
        clipped: [...stats.querySelectorAll('p')].some(p => { const r = p.getBoundingClientRect(); return r.left < box.left || r.right > starBox.left || r.bottom > box.bottom; }) };
    });
    console.log(width, metrics);
    expect.soft(metrics.documentWidth).toBeLessThanOrEqual(width);
    expect.soft(metrics.right).toBeLessThanOrEqual(width);
    expect.soft(metrics.scrollWidth).toBeLessThanOrEqual(metrics.width);
    expect.soft(metrics.clipped).toBe(false);
    expect.soft(metrics.statsRight).toBeLessThanOrEqual(metrics.starLeft);
    expect.soft(metrics.bottomDifference).toBeLessThanOrEqual(1);
    await page.keyboard.press('Tab');
    await link.focus();
    const focused = await link.evaluate(element => ({ visible: element.matches(':focus-visible'), border: getComputedStyle(element).borderTopColor }));
    expect(focused.visible).toBe(true);
    const accent = await page.evaluate(() => { const span = document.createElement('span'); span.style.color = 'var(--color-accent)'; document.body.append(span); const color = getComputedStyle(span).color; span.remove(); return color; });
    await expect(link).toHaveCSS("border-top-color", accent);
  });
}
