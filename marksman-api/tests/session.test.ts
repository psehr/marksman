import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request } from "express";
import { destroySession, regenerateSession, saveSession } from "../src/auth/session";

for (const [method, operation] of [
  ["save", saveSession],
  ["regenerate", regenerateSession],
  ["destroy", destroySession],
] as const) {
  test(`${method} waits for persistence and preserves callback errors`, async () => {
    let complete!: (error?: Error) => void;
    const session = {
      [method](callback: (error?: Error) => void) {
        assert.equal(this, session);
        complete = callback;
      },
    };
    const req = { session } as unknown as Request;
    let settled = false;
    const pending = operation(req).then(() => { settled = true; });
    await Promise.resolve();
    assert.equal(settled, false);
    complete();
    await pending;
    assert.equal(settled, true);

    const failure = new Error("Session store unavailable");
    const rejected = operation(req);
    const assertion = assert.rejects(rejected, (error) => error === failure);
    complete(failure);
    await assertion;
  });
}

test("login saves the replacement session after regeneration", async () => {
  const saved: string[] = [];
  const replacement = {
    userId: undefined as string | undefined,
    save(callback: () => void) {
      saved.push(this.userId!);
      callback();
    },
  };
  const req = {
    session: {
      regenerate(callback: () => void) {
        req.session = replacement as unknown as typeof req.session;
        callback();
      },
    },
  } as unknown as Request;

  await regenerateSession(req);
  req.session.userId = "local-user-id";
  await saveSession(req);
  assert.deepEqual(saved, ["local-user-id"]);
});
