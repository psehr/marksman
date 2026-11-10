import assert from "node:assert/strict";
import Module from "node:module";
import { after, test } from "node:test";
import type { Request, Response } from "express";

// Load the real auth router and alpha gate, with no database or upstream access.
const originals = new Map<string, NodeModule | undefined>();
function stub(path: string, exports: unknown) {
  const resolved = require.resolve(path);
  originals.set(resolved, require.cache[resolved]);
  const module = new Module(resolved);
  module.exports = exports;
  module.loaded = true;
  require.cache[resolved] = module;
}
stub("../src/config", { config: { ALLOWED_OSU_USER_IDS: [123], FRONTEND_URL: "http://fixture.test" } });
stub("../src/db/users", {
  async findUserById(id: string) {
    if (id === "deleted") return undefined;
    return { identity: { id, osuUserId: id === "allowed" ? 123 : 456 } };
  },
});
stub("../src/integrations/osu/auth", {});
stub("../src/integrations/osu/users", {});
stub("../src/services/users", {});
const { authRouter } = require("../src/routes/auth") as typeof import("../src/routes/auth");
const route = authRouter.stack.find(layer => layer.route?.path === "/access")!.route!;
after(() => {
  for (const [path, original] of originals) {
    if (original) require.cache[path] = original;
    else delete require.cache[path];
  }
});
for (const [userId, expectedStatus, expectedCode] of [
  [undefined, 401, "NOT_LOGGED_IN"],
  ["deleted", 401, "NOT_LOGGED_IN"],
  ["denied", 403, "ALPHA_ACCESS_REQUIRED"],
  ["allowed", 204, undefined],
] as const) {
  test(`real GET /auth/access route: ${userId ?? "anonymous"}`, async () => {
    let status: number | undefined;
    let body: unknown;
    let ended = false;
    const req = { session: { userId } } as Request;
    const res = {
      status(value: number) { status = value; return this; },
      json(value: unknown) { body = value; ended = true; return this; },
      end() { ended = true; return this; },
    } as Response;
    let index = 0;
    async function run(): Promise<void> {
      const layer = route.stack[index++];
      assert(layer, "request fell through without a response");
      let next: Promise<void> | undefined;
      await layer.handle(req, res, (error?: unknown) => {
        if (error) throw error;
        next = run();
      });
      await next;
    }
    await run();
    assert.equal(status, expectedStatus);
    assert.equal(ended, true, "handler must finish the response");
    if (expectedCode) assert.equal((body as { code: string }).code, expectedCode);
    else assert.equal(body, undefined);
  });
}
