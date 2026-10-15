import type { User } from "@marksman/contracts";
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
    balance = 700;
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
    preview.getByText("Balance after creation: 700 BP"),
  ).toBeVisible();
  await expect(preview.getByRole("link")).toHaveAttribute(
    "href",
    "https://osu.ppy.sh/beatmaps/123456",
  );
  await page
    .getByRole("button", { name: "Create bounty · 300 BP", exact: true })
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
    page.getByText("Signed-in as creator · Available balance: 700 BP"),
  ).toBeVisible();
  expect(bodies).toEqual([
    {
      rewardBp: 300,
      goal: {
        type: "minimum_grade",
        beatmapId: 123456,
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
    page.getByRole("button", { name: "Create bounty · 1001 BP" }),
  ).toBeDisabled();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Not enough BP",
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
  await page.getByRole("button", { name: "Create bounty · 300 BP" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "request may have succeeded",
  );
  await expect(page.getByLabel("Minimum combo (%)")).toHaveValue("99.5");
  await expect(page.getByLabel("Reward (BP)")).toHaveValue("300");
  await page.getByRole("button", { name: "Create bounty · 300 BP" }).click();
  await expect(page.getByText("Bounty created! It is now open.")).toBeVisible();
  expect(bodies).toEqual(
    Array(2).fill({
      rewardBp: 300,
      goal: {
        type: "full_combo",
        beatmapId: 123456,
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
  await page.getByRole("button", { name: "Create bounty · 300 BP" }).click();
  await expect(
    page.getByText("Signed-in as creator · Available balance: 100 BP"),
  ).toBeVisible();
  await expect(page.getByLabel("Reward (BP)")).toHaveValue("300");
  await expect(
    page.getByRole("button", { name: "Create bounty · 300 BP" }),
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
    page.getByRole("link", { name: "Log in with osu!" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create bounty", exact: true }),
  ).toBeDisabled();
  await page.unroute("**/auth/me");
  await mockAccount(page);
  await page.route("**/bounties", (route) =>
    route.fulfill({ status: 401, json: { error: "Not logged in" } }),
  );
  await page.reload();
  await fillBasic(page);
  await page.getByRole("button", { name: "Create bounty · 300 BP" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Your session expired",
  );
  await expect(
    page.getByRole("link", { name: "Log in with osu!" }),
  ).toBeVisible();
  await expect(page.getByLabel("Reward (BP)")).toHaveValue("300");
});
