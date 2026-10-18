import assert from "node:assert/strict";
import Module from "node:module";
import { afterEach, beforeEach, mock, test } from "node:test";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
async function flush() {
  await new Promise<void>((resolve) => setImmediate(resolve));
}
const entryPath = require.resolve("../src/index");
const savedModules = new Map<string, NodeModule | undefined>();
const signals = ["SIGINT", "SIGTERM"] as const;
let originalListeners: Map<string, Function[]>;
let originalExitCode: typeof process.exitCode;

function stub(path: string, exports: unknown) {
  const resolved = require.resolve(path);
  savedModules.set(resolved, require.cache[resolved]);
  const replacement = new Module(resolved);
  replacement.exports = exports;
  replacement.loaded = true;
  require.cache[resolved] = replacement;
}
beforeEach(() => {
  originalExitCode = process.exitCode;
  process.exitCode = undefined;
  originalListeners = new Map(signals.map(signal => [signal, process.listeners(signal)]));
  savedModules.set(entryPath, require.cache[entryPath]);
  delete require.cache[entryPath];
  mock.method(console, "log", () => {});
});
afterEach(() => {
  for (const signal of signals) {
    for (const listener of process.listeners(signal)) {
      if (!originalListeners.get(signal)!.includes(listener)) process.removeListener(signal, listener);
    }
  }
  process.exitCode = originalExitCode;
  for (const [path, original] of savedModules) {
    if (original) require.cache[path] = original;
    else delete require.cache[path];
  }
  savedModules.clear();
  mock.restoreAll();
});

function loadStartup() {
  const events: string[] = [];
  const worker = deferred();
  let onListening!: () => void;
  let onClosed!: (error?: Error) => void;
  const server = {
    close: mock.fn((callback: (error?: Error) => void) => {
      events.push("http-stop");
      onClosed = callback;
    }),
  };
  const listen = mock.fn((_port: number, callback: () => void) => {
    onListening = callback;
    return server;
  });
  const stopWorker = mock.fn(() => { events.push("worker-stop"); return worker.promise; });
  const startWorker = mock.fn(() => stopWorker);
  const sessionClose = mock.fn(() => { events.push("sessions-close"); });
  const poolEnd = mock.fn(async () => { events.push("pool-end"); });
  const errors = mock.method(console, "error", (..._args: unknown[]) => {});
  // Isolate entrypoint wiring: no real server, database, worker, or config secrets.
  stub("../src/app", { app: { listen } });
  stub("../src/config", { config: { PORT: 3001 } });
  stub("../src/workers/hunt-verification", { startHuntVerificationWorker: startWorker });
  stub("../src/db", { pool: { end: poolEnd } });
  stub("../src/db/session-store", { sessionStore: { close: sessionClose } });
  require(entryPath);
  function signal(name: typeof signals[number]) {
    const handlers = process.listeners(name).filter(listener => !originalListeners.get(name)!.includes(listener));
    assert.equal(handlers.length, 1);
    // Invoke only the application's handler; do not signal the test process.
    handlers[0](name);
  }
  return {
    events, worker, listen, startWorker, stopWorker, server, sessionClose, poolEnd, errors, signal,
    listening: () => onListening(),
    closed: (error?: Error) => onClosed(error),
  };
}

test("starts one worker only after the HTTP listening callback", () => {
  const app = loadStartup();
  assert.equal(app.listen.mock.callCount(), 1);
  assert.equal(app.listen.mock.calls[0].arguments[0], 3001);
  assert.equal(app.startWorker.mock.callCount(), 0);
  app.listening();
  assert.equal(app.startWorker.mock.callCount(), 1);
});

for (const first of ["http", "worker"] as const) {
  test(`shutdown waits for both operations when ${first} finishes first`, async () => {
    const app = loadStartup();
    app.listening();
    app.signal(first === "http" ? "SIGINT" : "SIGTERM");
    assert.deepEqual(app.events, ["http-stop", "worker-stop"]);
    if (first === "http") app.closed();
    else app.worker.resolve();
    await flush();
    assert.equal(app.sessionClose.mock.callCount(), 0);
    assert.equal(app.poolEnd.mock.callCount(), 0);
    if (first === "http") app.worker.resolve();
    else app.closed();
    await flush();
    assert.deepEqual(app.events, ["http-stop", "worker-stop", "sessions-close", "pool-end"]);
    assert.equal(process.exitCode, undefined);
    assert.equal(app.errors.mock.callCount(), 0);
  });
}

test("repeated signals do not repeat shutdown or resource cleanup", async () => {
  const app = loadStartup();
  app.listening();
  app.signal("SIGINT");
  app.signal("SIGTERM");
  app.signal("SIGINT");
  app.closed();
  app.worker.resolve();
  await flush();
  app.signal("SIGTERM");
  await flush();
  assert.equal(app.server.close.mock.callCount(), 1);
  assert.equal(app.stopWorker.mock.callCount(), 1);
  assert.equal(app.sessionClose.mock.callCount(), 1);
  assert.equal(app.poolEnd.mock.callCount(), 1);
});

for (const failing of ["http", "worker"] as const) {
  test(`${failing} shutdown failure still waits for the other operation and cleans up`, async () => {
    const app = loadStartup();
    const error = new Error(`${failing} stop failed`);
    app.listening();
    app.signal("SIGTERM");
    if (failing === "http") app.closed(error);
    else app.worker.reject(error);
    await flush();
    assert.equal(app.poolEnd.mock.callCount(), 0);
    assert.equal(app.sessionClose.mock.callCount(), 0);
    if (failing === "http") app.worker.resolve();
    else app.closed();
    await flush();
    assert.deepEqual(app.errors.mock.calls[0].arguments, ["Shutdown operation failed:", error]);
    assert.equal(process.exitCode, 1);
    assert.equal(app.sessionClose.mock.callCount(), 1);
    assert.equal(app.poolEnd.mock.callCount(), 1);
  });
}

test("pool cleanup failure is reported by the signal handler", async () => {
  const app = loadStartup();
  const error = new Error("pool cleanup failed");
  app.poolEnd.mock.mockImplementation(async () => { throw error; });
  app.listening();
  app.signal("SIGINT");
  app.closed();
  app.worker.resolve();
  await flush();
  assert.equal(app.sessionClose.mock.callCount(), 1);
  assert.deepEqual(app.errors.mock.calls[0].arguments, ["Shutdown failed:", error]);
  assert.equal(process.exitCode, 1);
});
