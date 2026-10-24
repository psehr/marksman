import type { User, OsuBeatmapMetadata } from "@marksman/contracts";
import { expect, test, type Page } from "@playwright/test";

const user: User = {
  identity: {
    id: "12345678-1234-4234-8234-123456789abc",
    osuUserId: 12345,
    username: "creator",
  },
  stats: { bpBalance: 1000 },
  createdAt: "2025-01-01T00:00:00.000Z",
};

const metadata: OsuBeatmapMetadata = {
  id: 123456, version: "Expert", difficulty_rating: 5, mode: "osu",
  status: "ranked", bpm: 180, url: "https://osu.ppy.sh/beatmaps/123456",
  max_combo: 1000, checksum: null, ar: 9, accuracy: 8, cs: 4, drain: 6,
  total_length: 120, hit_length: 110, playcount: 100,
  beatmapset: { title: "Starlight", artist: "Aurora", creator: "mapper", user_id: 7,
    covers: { cover: "https://assets.ppy.sh/cover.jpg", card: "https://assets.ppy.sh/card.jpg" } },
};

test.beforeEach(async ({ page }) => {
  await page.route("**/beatmaps/*", route => route.fulfill({ json: metadata }));
});

async function mockAccount(page: Page, balance = () => 1000) {
  await page.route("**/auth/me", (route) =>
    route.fulfill({
      json: { ...user, stats: { bpBalance: balance() } },
    }),
  );
}

async function fillBasic(page: Page) {
  await page
    .getByLabel("Beatmap ID or difficulty URL")
    .fill("https://osu.ppy.sh/beatmapsets/42#osu/123456");
  await page.getByLabel("Reward (BP)").fill("300");
}

test("previews a grade bounty, submits once, and refreshes the balance", async ({
  page,
}) => {
  let balance = 1000;
  await mockAccount(page, () => balance);
  const bodies: unknown[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/bounties", async (route) => {
    if (route.request().method() !== "POST") return route.fulfill({ json: [] });
    bodies.push(route.request().postDataJSON());
    await gate;
    balance = 670;
    await route.fulfill({ status: 201, json: { message: "Bounty created" } });
  });
  await page.goto("/bounties?status=open");
  await page.getByRole("link", { name: "Create a bounty" }).click();
  await fillBasic(page);
  await page.getByLabel("Mod rule").selectOption("exact");
  await page.getByLabel("HD", { exact: true }).check();
  const preview = page.getByRole("region", { name: "Bounty preview" });
  await expect(preview.getByText("Only HD")).toBeVisible();
  await expect(
    preview.getByText("Balance after creation: 670 BP"),
  ).toBeVisible();
  await expect(preview.getByRole("link")).toHaveAttribute(
    "href",
    "https://osu.ppy.sh/beatmaps/123456",
  );
  await page
    .getByRole("button", { name: "Create bounty · 330 BP", exact: true })
    .click();
  try {
    await expect(
      page.getByRole("button", { name: "Creating…" }),
    ).toBeDisabled();
    await expect.poll(() => bodies.length).toBe(1);
  } finally {
    release();
  }
  await expect(page.getByText("Bounty created! It is now open.")).toBeVisible();
  await expect(
    page.getByText("Signed-in as creator · Available balance: 670 BP"),
  ).toBeVisible();
  expect(bodies).toEqual([
    {
      rewardBp: 300,
      goal: {
        type: "minimum_grade",
        beatmapId: 123456,
        beatmapChecksum: null,
        minimumGradeRequirement: "A",
        modRequirement: { rule: "exact", mods: ["HD"] },
      },
    },
  ]);
  await expect(
    page.getByRole("button", { name: "Bounty created", exact: true }),
  ).toBeDisabled();
});

test("rejects set-only links, conflicting mods, and rewards above the balance", async ({
  page,
}) => {
  await mockAccount(page);
  let posts = 0;
  await page.route("**/bounties", async (route) => {
    posts++;
    await route.fulfill({ status: 500 });
  });
  await page.goto("/bounties/new");
  await fillBasic(page);
  await page
    .getByLabel("Beatmap ID or difficulty URL")
    .fill("https://osu.ppy.sh/beatmapsets/42");
  await page
    .getByRole("button", { name: "Create bounty", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "specific difficulty",
  );
  await page.getByLabel("Beatmap ID or difficulty URL").fill("123456");
  await page.getByLabel("Mod rule").selectOption("exact");
  await page.getByLabel("DT", { exact: true }).check();
  await page.getByLabel("HT", { exact: true }).check();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "conflicting combinations",
  );
  await page.getByLabel("HT", { exact: true }).uncheck();
  await page.getByLabel("Reward (BP)").fill("1001");
  await expect(
    page.getByRole("button", { name: "Create bounty · 1102 BP" }),
  ).toBeDisabled();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Insufficient BP",
  );
  expect(posts).toBe(0);
});

test("preserves a combo bounty after a network failure and allows an explicit retry", async ({
  page,
}) => {
  await mockAccount(page);
  const bodies: unknown[] = [];
  await page.route("**/bounties", async (route) => {
    bodies.push(route.request().postDataJSON());
    if (bodies.length === 1) return route.abort("failed");
    await route.fulfill({ status: 201, json: { message: "Bounty created" } });
  });
  await page.goto("/bounties/new");
  await fillBasic(page);
  await page
    .getByRole("combobox", { name: "Goal", exact: true })
    .selectOption("full_combo");
  await page.getByLabel("Minimum combo (%)").fill("99.5");
  await page.getByLabel("Minimum accuracy (%) — optional").fill("98");
  await page.getByLabel("Mod rule").selectOption("exact");
  await page.getByRole("button", { name: "Create bounty · 330 BP" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "request may have succeeded",
  );
  await expect(page.getByLabel("Minimum combo (%)")).toHaveValue("99.5");
  await expect(page.getByLabel("Reward (BP)")).toHaveValue("300");
  await page.getByRole("button", { name: "Create bounty · 330 BP" }).click();
  await expect(page.getByText("Bounty created! It is now open.")).toBeVisible();
  expect(bodies).toEqual(
    Array(2).fill({
      rewardBp: 300,
      goal: {
        type: "full_combo",
        beatmapId: 123456,
        beatmapChecksum: null,
        minimumComboRatio: 0.995,
        minimumAccuracy: 98,
        modRequirement: { rule: "exact", mods: [] },
      },
    }),
  );
});

test("refreshes a stale balance when funding is rejected", async ({ page }) => {
  let balance = 1000;
  await mockAccount(page, () => balance);
  await page.route("**/bounties", async (route) => {
    balance = 100;
    await route.fulfill({ status: 409, json: { code: "INSUFFICIENT_BP" } });
  });
  await page.goto("/bounties/new");
  await fillBasic(page);
  await page.getByRole("button", { name: "Create bounty · 330 BP" }).click();
  await expect(
    page.getByText("Signed-in as creator · Available balance: 100 BP"),
  ).toBeVisible();
  await expect(page.getByLabel("Reward (BP)")).toHaveValue("300");
  await expect(
    page.getByRole("button", { name: "Create bounty · 330 BP" }),
  ).toBeDisabled();
});

test("requires login and handles a session expiring before submission", async ({
  page,
}) => {
  await page.route("**/auth/me", (route) =>
    route.fulfill({ status: 401, json: { error: "Not logged in" } }),
  );
  await page.goto("/bounties/new");
  await expect(
    page.getByRole("main").getByRole("link", { name: "Log in with osu!" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create bounty", exact: true }),
  ).toBeDisabled();
  await page.unroute("**/auth/me");
  await mockAccount(page);
  await page.route("**/bounties", async (route) => {
    await page.route("**/auth/me", authRoute =>
      authRoute.fulfill({ status: 401, json: { error: "Not logged in" } }),
    );
    await route.fulfill({ status: 401, json: { error: "Not logged in" } });
  });
  await page.reload();
  await fillBasic(page);
  await page.getByRole("button", { name: "Create bounty · 330 BP" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Your session expired",
  );
  await expect(
    page.getByRole("main").getByRole("link", { name: "Log in with osu!" }),
  ).toBeVisible();
  await expect(page.getByLabel("Reward (BP)")).toHaveValue("300");
});

for (const failure of ["404", "network", "malformed"] as const) {
  test(`metadata ${failure} shows an error and same-ID retry recovers without submitting`, async ({ page }) => {
    await mockAccount(page);
    const uncaught: string[] = [];
    page.on("pageerror", error => uncaught.push(error.message));
    let reads = 0;
    let posts = 0;
    await page.route("**/bounties", route => {
      posts++;
      return route.fulfill({ status: 500 });
    });
    await page.route("**/beatmaps/123456", route => {
      if (++reads === 1) {
        if (failure === "network") return route.abort("failed");
        if (failure === "malformed") return route.fulfill({ json: { id: 123456 } });
        return route.fulfill({ status: 404, json: { error: "Missing" } });
      }
      return route.fulfill({ json: metadata });
    });
    await page.goto("/bounties/new");
    await fillBasic(page);
    const preview = page.getByRole("region", { name: "Bounty preview" });
    await expect(preview.getByText(failure === "404"
      ? "Beatmap not found. Check the difficulty ID."
      : "Unable to retrieve beatmap metadata. Please try again.")).toBeVisible();
    await preview.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(preview.getByRole("link")).toContainText("Aurora - Starlight [Expert]");
    expect(reads).toBe(2);
    expect(posts).toBe(0);
    expect(uncaught).toEqual([]);
  });
}

test("metadata ignores a late response for the previous ID and clears on invalid input", async ({ page }) => {
  await mockAccount(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let finish!: () => void;
  const finished = new Promise<void>(resolve => { finish = resolve; });
  let oldReads = 0;
  await page.route("**/beatmaps/123456", async route => {
    oldReads++;
    await gate;
    await route.fulfill({ json: metadata });
    finish();
  });
  await page.route("**/beatmaps/654321", route => route.fulfill({
    json: { ...metadata, id: 654321, beatmapset: null },
  }));
  await page.goto("/bounties/new");
  const input = page.getByLabel("Beatmap ID or difficulty URL");
  const preview = page.getByRole("region", { name: "Bounty preview" });
  await input.fill("123456");
  await expect.poll(() => oldReads).toBe(1);
  await input.fill("654321");
  await expect(preview.getByRole("link")).toHaveText("654321");
  release();
  await finished;
  await expect(preview.getByRole("link")).toHaveAttribute("href", "https://osu.ppy.sh/beatmaps/654321");
  await expect(preview.getByText(/Starlight/)).toHaveCount(0);
  await input.fill("invalid");
  await expect(preview.getByText("Choose a beatmap")).toBeVisible();
  await expect(preview.getByRole("link")).toHaveCount(0);
});

for (const failure of ["http", "network"] as const) {
  test(`failed ${failure} account refresh clears stale identity and balance, retry restores them`, async ({ page }) => {
    let failRefresh = false;
    await page.route("**/auth/me", route => {
      if (failRefresh) {
        return failure === "network" ? route.abort("failed")
          : route.fulfill({ status: 503, json: { error: "Unavailable" } });
      }
      return route.fulfill({ json: user });
    });
    let posts = 0;
    await page.route("**/bounties", route => {
      posts++;
      failRefresh = true;
      return route.fulfill({ status: 409, json: { code: "INSUFFICIENT_BP" } });
    });
    await page.goto("/bounties/new");
    await fillBasic(page);
    await expect(page.getByRole("link", { name: "Profile", exact: true })).toBeVisible();
    const submit = page.getByRole("button", { name: "Create bounty · 330 BP" });
    await submit.click();
    await expect(page.getByRole("button", { name: "Retry account lookup" })).toBeVisible();
    await expect(page.getByText(/Signed-in as creator/)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Profile", exact: true })).toHaveCount(0);
    await expect(submit).toBeDisabled();
    // Exercise the handler guard independently of the disabled button.
    await page.locator("form").evaluate(form => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(posts).toBe(1);
    failRefresh = false;
    await page.getByRole("button", { name: "Retry account lookup" }).click();
    await expect(page.getByText(/Signed-in as creator/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Profile", exact: true })).toBeVisible();
    await expect(submit).toBeEnabled();
  });
}

test("signed-out account is not an error and cannot submit even with valid inputs", async ({ page }) => {
  await page.route("**/auth/me", route => route.fulfill({ status: 401, json: {} }));
  let posts = 0;
  await page.route("**/bounties", route => {
    posts++;
    return route.fulfill({ status: 401, json: {} });
  });
  await page.goto("/bounties/new");
  await fillBasic(page);
  await expect(page.getByRole("main").getByRole("link", { name: "Log in with osu!" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry account lookup" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Create bounty · 330 BP" })).toBeDisabled();
  await page.locator("form").evaluate(form => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(posts).toBe(0);
});
