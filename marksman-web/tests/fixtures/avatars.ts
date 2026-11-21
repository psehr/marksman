import type { Page } from "@playwright/test";

/** Intercept Next's avatar image request so browser checks never fetch real users. */
export async function mockAvatars(page: Page) {
  await page.route(url => url.pathname === "/_next/image"
    && (url.searchParams.get("url")?.startsWith("https://a.ppy.sh/") ?? false),
  route => route.fulfill({
    contentType: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><rect width="36" height="36" fill="#8c8540"/><circle cx="18" cy="13" r="7" fill="#e8cd56"/><ellipse cx="18" cy="33" rx="14" ry="12" fill="#e8cd56"/></svg>',
  }));
}
