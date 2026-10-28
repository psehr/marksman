import assert from "node:assert/strict";
import Module from "node:module";
import { after, afterEach, mock, test } from "node:test";
import type { Request, Response } from "express";

// Exercise the real helper and route without connecting to development data.
const dbPath = require.resolve("../src/db");
const originalDb = require.cache[dbPath];
const pool = { query: async (_query: { text: string; query_timeout: number }): Promise<unknown> => ({ rows: [{ value: 1 }] }) };
const stub = new Module(dbPath);
stub.exports = { pool };
stub.loaded = true;
require.cache[dbPath] = stub;

const { healthRouter } = require("../src/routes/health") as typeof import("../src/routes/health");
const route = healthRouter.stack.find(layer => layer.route?.path === "/")!.route!;
const handler = route.stack[0].handle;

afterEach(() => mock.restoreAll());
after(() => {
  if (originalDb) require.cache[dbPath] = originalDb;
  else delete require.cache[dbPath];
});

async function invoke() {
  let status: number | undefined;
  let body: unknown;
  const response = {
    status(code: number) { status = code; return this; },
    json(value: unknown) { body = value; return this; },
  };
  await handler({} as Request, response as Response, (error?: unknown) => { throw error; });
  return { status, body };
}

test("health returns 200 after a successful database query", async () => {
  const query = mock.method(pool, "query");
  assert.deepEqual(await invoke(), {
    status: 200, body: { status: "ok", database: "available" },
  });
  assert.deepEqual(query.mock.calls.map(call => call.arguments), [[{
    text: "SELECT 1", query_timeout: 2000,
  }]]);
});

test("health returns 503 without exposing database error details, then recovers", async () => {
  const failure = new Error("private database connection details");
  let failing = true;
  mock.method(pool, "query", async () => {
    if (failing) throw failure;
    return { rows: [] };
  });
  const log = mock.method(console, "error", () => {});
  assert.deepEqual(await invoke(), {
    status: 503, body: { status: "unhealthy", database: "unavailable" },
  });
  assert.equal(log.mock.calls[0].arguments[1], failure);
  failing = false;
  assert.equal((await invoke()).status, 200);
});

test("health waits for the database before returning success", async () => {
  let resolve!: (value: unknown) => void;
  mock.method(pool, "query", () => new Promise(done => { resolve = done; }));
  let finished = false;
  const pending = invoke().then(result => { finished = true; return result; });
  await new Promise<void>(done => setImmediate(done));
  assert.equal(finished, false);
  resolve({ rows: [] });
  assert.equal((await pending).status, 200);
});
