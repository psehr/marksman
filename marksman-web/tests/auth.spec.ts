import type { User } from "@marksman/contracts";
import { expect, test } from "@playwright/test";

for (const failure of ["http", "network"] as const) {
  test(`logout ${failure} failure keeps the account visible and allows retry`, async ({ page }) => {
    let logoutAttempts = 0;
    let loggedIn = true;
    // Exercise the real rendered component while keeping all auth traffic local
    // to the browser mock; no development API/session is touched.
    await page.route("**/auth/**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path === "/auth/me") {
        await route.fulfill({
          status: loggedIn ? 200 : 401,
          json: loggedIn
            ? {
                identity: {
                  id: "12345678-1234-4234-8234-123456789abc",
                  username: "test_player",
                  osuUserId: 12345,
                },
                stats: { bpBalance: 250 },
                createdAt: "2025-01-01T00:00:00.000Z",
              } satisfies User
            : { error: "Not logged in" },
        });
        return;
      }
      if (path === "/auth/logout") {
        expect(request.method()).toBe("POST");
        logoutAttempts++;
        if (logoutAttempts === 1) {
          if (failure === "network") await route.abort("failed");
          else await route.fulfill({ status: 500, json: { error: "Internal server error" } });
        } else {
          loggedIn = false;
          await route.fulfill({ status: 204 });
        }
        return;
      }
      await route.abort();
      throw new Error(`Unexpected auth request: ${path}`);
    });

    await page.goto("/");
    await expect(page.getByText("Signed-in as test_player")).toBeVisible();
    await page.getByText("Log out", { exact: true }).click();
    const logoutError = page.getByRole("alert").filter({ hasText: "Could not log out." });
    await expect(logoutError).toHaveText("Could not log out. Please try again.");
    await expect(page.getByText("Signed-in as test_player")).toBeVisible();
    await expect(page.getByText("BP Balance: 250")).toBeVisible();
    await expect(page.getByRole("link", { name: "Log in with osu!" })).toHaveCount(0);

    await page.getByText("Log out", { exact: true }).click();
    await expect(page.getByRole("link", { name: "Log in with osu!" })).toBeVisible();
    await expect(logoutError).toHaveCount(0);
    await expect(page.getByText("Signed-in as test_player")).toHaveCount(0);
    expect(logoutAttempts).toBe(2);
    await page.reload();
    await expect(page.getByRole("link", { name: "Log in with osu!" })).toBeVisible();
  });
}
