import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { checkAlphaAccess } from "../../src/lib/api/users";
import { ApiError } from "../../src/lib/api/client";

afterEach(() => mock.restoreAll());
test("access helper accepts empty 204 and sends credentials without caching", async () => {
  mock.method(globalThis, "fetch", async (url: Parameters<typeof fetch>[0], options?: RequestInit) => {
    assert.equal(url, `${process.env.NEXT_PUBLIC_API_URL}/auth/access`);
    assert.equal(options?.credentials, "include");
    assert.equal(options?.cache, "no-store");
    return new Response(null, { status: 204 });
  });
  assert.equal(await checkAlphaAccess(), undefined);
});
for (const [status, code] of [[401, "NOT_LOGGED_IN"], [403, "ALPHA_ACCESS_REQUIRED"], [500, "UNEXPECTED_ERROR"]] as const) {
  test(`access helper preserves ${status} and error code`, async () => {
    mock.method(globalThis, "fetch", async () => Response.json({ code, error: "fixture error" }, { status }));
    await assert.rejects(checkAlphaAccess(), (error: unknown) => {
      assert(error instanceof ApiError);
      assert.equal(error.status, status);
      assert.equal(error.code, code);
      return true;
    });
  });
}
