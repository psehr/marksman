import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { resolve } from "node:path";

let script: string;
test.beforeAll(async () => {
  const result = await build({
    entryPoints: [resolve(__dirname, "fixtures/copy-text-harness.tsx")],
    bundle: true, write: false, platform: "browser", jsx: "automatic",
    tsconfig: resolve(__dirname, "../tsconfig.json"),
    plugins: [{
      name: "fixture-fonts",
      setup(builder) {
        builder.onResolve({ filter: /^@\/lib\/fonts$/ }, () => ({ path: "fonts", namespace: "fixture" }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: 'export const aes_font = { className: "" }; export const base_font = { className: "" };',
          loader: "js",
        }));
      },
    }],
    define: { "process.env.NODE_ENV": '"development"' },
  });
  script = result.outputFiles[0]!.text;
});
for (const failure of [false, true]) {
  test(`custom multiline text ${failure ? "offers manual copy and retries" : "copies exactly"}`, async ({ page }) => {
    await page.addInitScript(({ failure }) => {
      const state = window as unknown as { copiedText: string; calls: number };
      state.calls = 0;
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
        writeText: async (text: string) => {
          if (++state.calls === 1 && failure) throw new Error("Denied");
          state.copiedText = text;
        },
      } });
    }, { failure });
    await page.route("http://fixture.test/**", route => route.fulfill(
      new URL(route.request().url()).pathname === "/"
        ? { contentType: "text/html", body: '<div id="root"></div><script src="/harness.js"></script>' }
        : { contentType: "application/javascript", body: script },
    ));
    await page.goto("http://fixture.test/");
    const button = page.getByRole("button", { name: "Share achievement" });
    await button.click();
    if (failure) {
      const manual = page.getByRole("textbox", { name: "Text to copy" });
      await expect(manual).toHaveValue("I completed this bounty!\n100 BP earned.");
      await manual.focus();
      expect(await manual.evaluate(el => {
        const field = el as HTMLTextAreaElement;
        return field.selectionStart === 0 && field.selectionEnd === field.value.length;
      })).toBe(true);
      await button.click();
      await expect(manual).toHaveCount(0);
    }
    await expect(page.getByRole("status")).toHaveText("Text copied!");
    expect(await page.evaluate(() => (window as unknown as { copiedText: string }).copiedText))
      .toBe("I completed this bounty!\n100 BP earned.");
  });
}
