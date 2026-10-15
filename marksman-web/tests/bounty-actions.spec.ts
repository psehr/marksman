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

async function setup(page: Page, owner = false) {
  const state = {
    loggedIn: true,
    balance: 100,
    items: [bounty],
    accountReads: 0,
    listReads: 0,
  };
  await page.route("**/auth/me", (route) => {
    state.accountReads++;
    if (!state.loggedIn) {
      return route.fulfill({ status: 401, json: { error: "Not logged in" } });
    }
    return route.fulfill({
      json: {
        ...user,
        identity: owner ? bounty.owner : user.identity,
        stats: { bpBalance: state.balance },
      },
    });
  });
  await page.route("**/bounties", (route) => {
    // /bounties is also a frontend page; only mock API requests.
    if (route.request().isNavigationRequest()) return route.fallback();
    state.listReads++;
    return route.fulfill({ json: state.items });
  });
  // Do not fetch remote cover artwork while exercising the card.
  await page.route("**/_next/image?**", (route) =>
    route.fulfill({ status: 204 }),
  );
  return state;
}

function dialogs(
  page: Page,
  input: string | null = "https://osu.ppy.sh/scores/9876543210",
) {
  const alerts: string[] = [];
  page.on("dialog", async (dialog) => {
    if (dialog.type() === "prompt") {
      if (input === null) await dialog.dismiss();
      else await dialog.accept(input);
    } else {
      alerts.push(dialog.message());
      await dialog.accept();
    }
  });
  return alerts;
}

for (const input of [
  "not-a-score",
  "0",
  "9007199254740992",
  "https://example.com/scores/123",
  "",
  null,
]) {
  test(`claim input ${JSON.stringify(input)} sends no request and permits retry`, async ({
    page,
  }) => {
    const state = await setup(page);
    let posts = 0;
    await page.route("**/bounties/*/complete", (route) => {
      posts++;
      return route.fulfill({ status: 422, json: { error: "Rejected" } });
    });
    const alerts = dialogs(page, input);
    await page.goto("/bounties?status=open");
    const button = page.getByRole("button", { name: "Claim", exact: true });
    await expect(button).toBeEnabled();
    const reads = [state.accountReads, state.listReads];
    await button.click();
    await expect(button).toBeEnabled();
    expect(alerts).toEqual(
      input === null || input === "" ? [] : ["Invalid URL/ID input"],
    );
    expect(posts).toBe(0);
    expect([state.accountReads, state.listReads]).toEqual(reads);
    page.removeAllListeners("dialog");
    const retryAlerts = dialogs(page, "123");
    await button.click();
    await expect.poll(() => retryAlerts).toEqual(["Rejected"]);
    await expect(button).toBeEnabled();
    expect(posts).toBe(1);
  });
}

for (const action of ["Claim", "Cancel"] as const) {
  for (const failure of ["http", "network"] as const) {
    test(`${action}: ${failure} failure permits retry, success refreshes list and balance`, async ({
      page,
    }) => {
      const state = await setup(page, action === "Cancel");
      const alerts = dialogs(page);
      const requests: { method: string; body: unknown }[] = [];
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route(
        `**/bounties/${bounty.id}/${action === "Claim" ? "complete" : "cancel"}`,
        async (route) => {
          requests.push({
            method: route.request().method(),
            body: route.request().postDataJSON(),
          });
          if (requests.length === 1) {
            if (failure === "network") return route.abort("failed");
            return route.fulfill({
              status: action === "Claim" ? 422 : 409,
              json: { error: "Action rejected by server" },
            });
          }
          await gate;
          state.balance += bounty.rewardBp;
          const updated: ExtendedBounty = {
            ...bounty,
            status: action === "Claim" ? "completed" : "cancelled",
          };
          state.items = [updated];
          await route.fulfill({
            json: { message: "Success", bounty: updated },
          });
        },
      );
      await page.goto("/bounties?status=open");
      const button = page.getByRole("button", { name: action, exact: true });
      await expect(button).toBeEnabled();
      await expect(
        page.getByRole("button", {
          name: action === "Claim" ? "Cancel" : "Claim",
          exact: true,
        }),
      ).toHaveCount(0);
      const reads = [state.accountReads, state.listReads];
      await button.click();
      await expect.poll(() => alerts.length).toBe(1);
      expect(alerts[0]).toBe(
        failure === "http"
          ? "Action rejected by server"
          : action === "Claim"
            ? "Could not complete the request. See the browser console for details."
            : "Could not cancel the bounty. See the browser console for details.",
      );
      await expect(button).toBeEnabled();
      await expect(
        page.getByText("BP Balance: 100", { exact: true }),
      ).toBeVisible();
      expect([state.accountReads, state.listReads]).toEqual(reads);
      await button.click();
      try {
        await expect.poll(() => requests.length).toBe(2);
        await expect(button).toBeDisabled();
        // A second DOM click during the pending request must not submit again.
        await button.evaluate((element: HTMLButtonElement) => element.click());
        expect(requests).toHaveLength(2);
      } finally {
        release();
      }
      await expect(
        page.getByText("No bounties available", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("BP Balance: 400", { exact: true }),
      ).toBeVisible();
      expect(alerts[1]).toBe(
        action === "Claim"
          ? "Successfully completed bounty"
          : "Successfully cancelled bounty",
      );
      expect(requests).toEqual(
        Array(2).fill({
          method: "POST",
          body: action === "Claim" ? { scoreId: 9876543210 } : null,
        }),
      );
      expect(state.accountReads).toBeGreaterThan(reads[0]);
      expect(state.listReads).toBeGreaterThan(reads[1]);
    });
  }
}

test("search matches title, artist, difficulty and creator, supports typos and clears without refetching", async ({
  page,
}) => {
  const state = await setup(page);
  state.items.push({
    ...bounty,
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    beatmap: null,
    owner: null,
  });
  await page.goto("/bounties?status=open");
  const search = page.getByPlaceholder("Search bounties..");
  const cards = page.getByRole("button", { name: "Claim", exact: true });
  await expect(cards).toHaveCount(2);
  const reads = state.listReads;
  for (const query of [
    "Starlight",
    "Aurora",
    "Expert",
    "mapmaker",
    "Starligt",
  ]) {
    await search.fill(query);
    await expect(cards).toHaveCount(1);
    await expect(
      page.getByText("Aurora - Starlight [Expert]", { exact: true }),
    ).toBeVisible();
  }
  await search.fill("zzzzzzzzzzzzzz");
  await expect(
    page.getByText("No matching bounties", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("No bounties available", { exact: true }),
  ).toHaveCount(0);
  await expect(cards).toHaveCount(0);
  await search.fill("   ");
  await expect(cards).toHaveCount(2);
  await expect(
    page.getByText("No matching bounties", { exact: true }),
  ).toHaveCount(0);
  expect(state.listReads).toBe(reads);
});

for (const outcome of ["empty", "error"] as const) {
  test(`list ${outcome}: loading and error states do not also show empty messages`, async ({
    page,
  }) => {
    await setup(page);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/bounties", async (route) => {
      await gate;
      await route.fulfill({
        status: outcome === "error" ? 500 : 200,
        json: [],
      });
    });
    await page.goto("/bounties?status=open");
    try {
      await expect(
        page.getByText("Loading bounties", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(/^No (matching bounties|bounties available)$/),
      ).toHaveCount(0);
    } finally {
      release();
    }
    await expect(
      page.getByText(
        outcome === "error"
          ? "Failed to load bounties"
          : "No bounties available",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByText("Loading bounties", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("No matching bounties", { exact: true }),
    ).toHaveCount(0);
    if (outcome === "error")
      await expect(
        page.getByText("No bounties available", { exact: true }),
      ).toHaveCount(0);
  });
}

// Dates and rewards deliberately have different orderings, and the API returns
// neither ordering. Completion dates also differ from creation-date ordering.
function browsingFixtures(): ExtendedBounty[] {
  const rows = [
    { title: "Orbit Alpha", day: "2025-12-31", reward: 300 },
    { title: "Orbit Beta", day: "2026-01-02", reward: 100 },
    { title: "Meadow", day: "2026-01-01", reward: 200 },
  ];
  return (["open", "completed", "draft", "cancelled"] as const).flatMap(
    (status, group) =>
      rows.map(
        (row, index): ExtendedBounty => ({
          ...bounty,
          id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(group * 3 + index + 1).padStart(12, "0")}`,
          status,
          createdAt: `${row.day}T00:00:00.000Z`,
          rewardBp: row.reward,
          completedAt:
            status === "completed"
              ? `2026-02-0${index + 1}T00:00:00.000Z`
              : null,
          completedByOsuUserId:
            status === "completed" ? user.identity.osuUserId : null,
          completionScoreId: status === "completed" ? 9876543210 + index : null,
          winner: status === "completed" ? user.identity : null,
          beatmap: {
            ...bounty.beatmap!,
            song: {
              ...bounty.beatmap!.song!,
              title: `${status} ${row.title}`,
            },
          },
        }),
      ),
  );
}

async function expectBountyOrder(
  page: Page,
  status: "open" | "completed",
  titles: string[],
) {
  // Assert DOM order using visible card text, without depending on layout classes.
  await expect(page.getByText(/^Aurora - .* \[Expert\]$/)).toHaveText(
    titles.map((title) => `Aurora - ${status} ${title} [Expert]`),
  );
}

async function expectStatus(page: Page, status: "open" | "completed") {
  await expect(
    page.getByRole("button", { name: "Open", exact: true }),
  ).toHaveAttribute("aria-pressed", String(status === "open"));
  await expect(
    page.getByRole("button", { name: "Completed", exact: true }),
  ).toHaveAttribute("aria-pressed", String(status === "completed"));
}

for (const status of ["open", "completed"] as const) {
  test(`${status} bounties sort by creation date and reward in both directions after searching`, async ({
    page,
  }) => {
    const state = await setup(page);
    state.items = browsingFixtures();
    await page.goto(`/bounties?status=${status}`);
    await expectBountyOrder(page, status, [
      "Orbit Beta",
      "Meadow",
      "Orbit Alpha",
    ]);
    const reads = state.listReads;
    const date = page.getByRole("button", { name: "Date", exact: true });
    const reward = page.getByRole("button", { name: "Reward", exact: true });
    const asc = page.getByRole("button", { name: "Asc ↑", exact: true });
    const desc = page.getByRole("button", { name: "Desc ↓", exact: true });
    await expect(date).toHaveAttribute("aria-pressed", "true");
    await expect(desc).toHaveAttribute("aria-pressed", "true");

    await asc.click();
    await expectBountyOrder(page, status, [
      "Orbit Alpha",
      "Meadow",
      "Orbit Beta",
    ]);
    await expect(asc).toHaveAttribute("aria-pressed", "true");
    await expect(desc).toHaveAttribute("aria-pressed", "false");
    await reward.click();
    await expectBountyOrder(page, status, [
      "Orbit Beta",
      "Meadow",
      "Orbit Alpha",
    ]);
    await expect(reward).toHaveAttribute("aria-pressed", "true");
    await expect(date).toHaveAttribute("aria-pressed", "false");
    await desc.click();
    await expectBountyOrder(page, status, [
      "Orbit Alpha",
      "Meadow",
      "Orbit Beta",
    ]);
    await expect(desc).toHaveAttribute("aria-pressed", "true");
    await expect(asc).toHaveAttribute("aria-pressed", "false");
    await date.click();
    await expectBountyOrder(page, status, [
      "Orbit Beta",
      "Meadow",
      "Orbit Alpha",
    ]);

    const search = page.getByPlaceholder("Search bounties..");
    await search.fill("Orbit");
    await expectBountyOrder(page, status, ["Orbit Beta", "Orbit Alpha"]);
    await reward.click();
    await expectBountyOrder(page, status, ["Orbit Alpha", "Orbit Beta"]);
    await asc.click();
    await expectBountyOrder(page, status, ["Orbit Beta", "Orbit Alpha"]);
    await search.clear();
    await expectBountyOrder(page, status, [
      "Orbit Beta",
      "Meadow",
      "Orbit Alpha",
    ]);
    expect(state.listReads).toBe(reads);
  });
}

for (const [url, status] of [
  ["/bounties?status=open", "open"],
  ["/bounties?status=completed", "completed"],
  ["/bounties", "open"],
  ["/bounties?status=unknown", "open"],
] as const) {
  test(`direct URL ${url} selects ${status} and excludes other statuses`, async ({
    page,
  }) => {
    const state = await setup(page);
    state.items = browsingFixtures();
    await page.goto(url);
    await expectStatus(page, status);
    await expectBountyOrder(page, status, [
      "Orbit Beta",
      "Meadow",
      "Orbit Alpha",
    ]);
    await expect(
      page.getByRole("button", { name: "Claim", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Score link", exact: true }),
    ).toHaveCount(status === "completed" ? 3 : 0);
  });
}

test("status switching and back/forward preserve search and sorting while changing the displayed bounties", async ({
  page,
}) => {
  const state = await setup(page);
  state.items = browsingFixtures();
  await page.goto("/bounties?status=open");
  await expectBountyOrder(page, "open", [
    "Orbit Beta",
    "Meadow",
    "Orbit Alpha",
  ]);
  const search = page.getByPlaceholder("Search bounties..");
  await search.fill("Orbit");
  await page.getByRole("button", { name: "Reward", exact: true }).click();
  await page.getByRole("button", { name: "Asc ↑", exact: true }).click();

  async function expectView(status: "open" | "completed") {
    await expect(page).toHaveURL(`/bounties?status=${status}`);
    await expectStatus(page, status);
    await expect(search).toHaveValue("Orbit");
    await expect(
      page.getByRole("button", { name: "Reward", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", { name: "Asc ↑", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expectBountyOrder(page, status, ["Orbit Beta", "Orbit Alpha"]);
  }

  await expectView("open");
  await page.getByRole("button", { name: "Completed", exact: true }).click();
  await expectView("completed");
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expectView("open");
  await page.goBack();
  await expectView("completed");
  await page.goBack();
  await expectView("open");
  await page.goForward();
  await expectView("completed");
  await page.goForward();
  await expectView("open");
});

function ownershipFixtures(): ExtendedBounty[] {
  return browsingFixtures().map((item) => {
    if (item.beatmap!.song!.title.endsWith("Orbit Beta")) return item;
    return {
      ...item,
      creatorOsuUserId: user.identity.osuUserId,
      // Ownership must work even when owner enrichment is unavailable.
      owner: null,
      completedByOsuUserId:
        item.status === "completed" ? bounty.creatorOsuUserId : null,
      winner: item.status === "completed" ? bounty.owner : null,
    };
  });
}

for (const status of ["open", "completed"] as const) {
  test(`My bounties filters ${status} by creator and combines with search, sorting and counts`, async ({
    page,
  }) => {
    const state = await setup(page);
    state.items = ownershipFixtures();
    await page.goto(`/bounties?status=${status}`);
    await expectBountyOrder(page, status, [
      "Orbit Beta",
      "Meadow",
      "Orbit Alpha",
    ]);
    const all = page.getByRole("button", { name: "All bounties", exact: true });
    const mine = page.getByRole("button", { name: "My bounties", exact: true });
    await expect(all).toHaveAttribute("aria-pressed", "true");
    await expect(mine).toHaveAttribute("aria-pressed", "false");
    const reads = state.listReads;
    await mine.click();
    await expectBountyOrder(page, status, ["Meadow", "Orbit Alpha"]);
    await expect(
      page.getByText("Found 2 bounties", { exact: true }),
    ).toBeVisible();
    await expect(mine).toHaveAttribute("aria-pressed", "true");
    await expect(all).toHaveAttribute("aria-pressed", "false");

    await page.getByRole("button", { name: "Reward", exact: true }).click();
    await expectBountyOrder(page, status, ["Orbit Alpha", "Meadow"]);
    const search = page.getByPlaceholder("Search bounties..");
    await search.fill("Orbit");
    await expectBountyOrder(page, status, ["Orbit Alpha"]);
    await expect(
      page.getByText("Found 1 bounties", { exact: true }),
    ).toBeVisible();
    await all.click();
    await expectBountyOrder(page, status, ["Orbit Alpha", "Orbit Beta"]);
    await expect(search).toHaveValue("Orbit");
    await expect(
      page.getByRole("button", { name: "Reward", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(mine).toHaveAttribute("aria-pressed", "false");
    await expect(all).toHaveAttribute("aria-pressed", "true");
    await mine.click();
    await search.clear();
    await expectBountyOrder(page, status, ["Orbit Alpha", "Meadow"]);
    await all.click();
    await expectBountyOrder(page, status, [
      "Orbit Alpha",
      "Meadow",
      "Orbit Beta",
    ]);
    await expect(
      page.getByText("Found 3 bounties", { exact: true }),
    ).toBeVisible();
    expect(state.listReads).toBe(reads);
  });
}

test("My bounties selection survives switching between open and completed", async ({
  page,
}) => {
  const state = await setup(page);
  state.items = ownershipFixtures();
  await page.goto("/bounties?status=open");
  const mine = page.getByRole("button", { name: "My bounties", exact: true });
  await mine.click();
  await expectBountyOrder(page, "open", ["Meadow", "Orbit Alpha"]);
  await page.getByRole("button", { name: "Completed", exact: true }).click();
  await expectStatus(page, "completed");
  await expectBountyOrder(page, "completed", ["Meadow", "Orbit Alpha"]);
  await expect(mine).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expectBountyOrder(page, "open", ["Meadow", "Orbit Alpha"]);
  await expect(mine).toHaveAttribute("aria-pressed", "true");
});

test("My bounties with no owned results shows a filter empty state and All restores results", async ({
  page,
}) => {
  const state = await setup(page);
  state.items = browsingFixtures();
  await page.goto("/bounties?status=open");
  await expectBountyOrder(page, "open", [
    "Orbit Beta",
    "Meadow",
    "Orbit Alpha",
  ]);
  await page.getByRole("button", { name: "My bounties", exact: true }).click();
  await expectBountyOrder(page, "open", []);
  await expect(
    page.getByText("Found 0 bounties", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("No matching bounties", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("No bounties available", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "All bounties", exact: true }).click();
  await expectBountyOrder(page, "open", [
    "Orbit Beta",
    "Meadow",
    "Orbit Alpha",
  ]);
  await expect(
    page.getByText("No matching bounties", { exact: true }),
  ).toHaveCount(0);
});

test("signed-out visitors see public bounties without ownership controls", async ({
  page,
}) => {
  const state = await setup(page);
  state.loggedIn = false;
  state.items = ownershipFixtures();
  await page.goto("/bounties?status=open");
  await expect(
    page.getByRole("link", { name: "Log in with osu!" }),
  ).toBeVisible();
  await expectBountyOrder(page, "open", [
    "Orbit Beta",
    "Meadow",
    "Orbit Alpha",
  ]);
  await expect(
    page.getByRole("button", { name: "My bounties", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "All bounties", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Found 3 bounties", { exact: true }),
  ).toBeVisible();
});

test("logging out with My bounties selected restores public results while preserving search and sorting", async ({
  page,
}) => {
  const state = await setup(page);
  state.items = ownershipFixtures();
  let logouts = 0;
  await page.route("**/auth/logout", (route) => {
    expect(route.request().method()).toBe("POST");
    logouts++;
    state.loggedIn = false;
    return route.fulfill({ status: 204 });
  });
  await page.goto("/bounties?status=open");
  await page.getByRole("button", { name: "My bounties", exact: true }).click();
  const search = page.getByPlaceholder("Search bounties..");
  await search.fill("Orbit");
  await page.getByRole("button", { name: "Reward", exact: true }).click();
  await expectBountyOrder(page, "open", ["Orbit Alpha"]);
  await page.getByText("Log out", { exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Log in with osu!" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "My bounties", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "All bounties", exact: true }),
  ).toHaveCount(0);
  await expect(search).toHaveValue("Orbit");
  await expect(
    page.getByRole("button", { name: "Reward", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expectBountyOrder(page, "open", ["Orbit Alpha", "Orbit Beta"]);
  await expect(
    page.getByText("Found 2 bounties", { exact: true }),
  ).toBeVisible();
  expect(logouts).toBe(1);
});
