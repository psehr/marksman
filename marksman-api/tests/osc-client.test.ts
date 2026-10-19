import assert from "node:assert/strict";
import Module from "node:module";
import { after, afterEach, beforeEach, mock, test } from "node:test";

class FakeSocket {
  handlers = new Map<string, ((payload?: unknown) => void)[]>();
  emitted: unknown[][] = [];
  connectedWithHandlers: string[][] = [];
  disconnects = 0;
  on(event: string, handler: (payload?: unknown) => void) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
    return this;
  }
  emit(...args: unknown[]) { this.emitted.push(args); return this; }
  connect() { this.connectedWithHandlers.push([...this.handlers.keys()]); return this; }
  disconnect() { this.disconnects++; return this; }
  receive(event: string, payload?: unknown) {
    for (const handler of this.handlers.get(event) ?? []) handler(payload);
  }
}

// Replace the transport before importing the adapter: no real sockets are created.
const clientPath = require.resolve("socket.io-client");
const originalModule = require.cache[clientPath];
let socket: FakeSocket;
let ioCalls: unknown[][] = [];
const stubModule = new Module(clientPath);
stubModule.exports = { io: (...args: unknown[]) => { ioCalls.push(args); return socket; } };
stubModule.loaded = true;
require.cache[clientPath] = stubModule;
const { startOscClient } = require("../src/integrations/osc/client") as typeof import("../src/integrations/osc/client");
const callsAtImport = ioCalls.length;
let stop: (() => Promise<void>) | undefined;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
const flush = () => new Promise<void>(done => setImmediate(done));

beforeEach(() => { socket = new FakeSocket(); ioCalls = []; });
afterEach(async () => { await stop?.(); stop = undefined; mock.restoreAll(); });
after(() => {
  if (originalModule) require.cache[clientPath] = originalModule;
  else delete require.cache[clientPath];
});

test("import is inert and startup registers handlers before connecting with oSC options", () => {
  assert.equal(callsAtImport, 0);
  stop = startOscClient(async () => {});
  assert.deepEqual(ioCalls, [["https://osc.kaysting.dev", {
    path: "/ws", transports: ["websocket"], autoConnect: false,
  }]]);
  assert.deepEqual(socket.connectedWithHandlers, [["connect", "scores"]]);
  assert.deepEqual(socket.emitted, []);
});

test("each connection subscribes without duplicating the scores listener", async () => {
  const received: unknown[] = [];
  stop = startOscClient(async payload => { received.push(payload); });
  socket.receive("connect");
  socket.receive("connect");
  assert.deepEqual(socket.emitted, [["subscribe", "scores"], ["subscribe", "scores"]]);
  socket.receive("scores", [1]);
  await flush();
  assert.deepEqual(received, [[1]]);
});

test("batches wait for preceding work and preserve payload order", async () => {
  const gate = deferred();
  const received: unknown[] = [];
  stop = startOscClient(async payload => {
    received.push(payload);
    if (payload === "first") await gate.promise;
  });
  try {
    socket.receive("scores", "first");
    socket.receive("scores", "second");
    await flush();
    assert.deepEqual(received, ["first"]);
    gate.resolve();
    await flush();
    assert.deepEqual(received, ["first", "second"]);
  } finally { gate.resolve(); }
});

for (const synchronous of [false, true]) {
  test(`${synchronous ? "synchronous throw" : "rejected callback"} is logged and later batches continue`, async () => {
    const error = new Error("Discovery failed");
    const log = mock.method(console, "error", () => {});
    const received: unknown[] = [];
    stop = startOscClient(payload => {
      received.push(payload);
      if (payload === "bad") {
        if (synchronous) throw error;
        return Promise.reject(error);
      }
      return Promise.resolve();
    });
    socket.receive("scores", "bad");
    socket.receive("scores", "good");
    await flush();
    assert.deepEqual(received, ["bad", "good"]);
    assert.deepEqual(log.mock.calls.map(call => call.arguments), [[error]]);
  });
}

test("stop disconnects immediately, rejects new events and drains all accepted work", async () => {
  const first = deferred();
  const second = deferred();
  const received: unknown[] = [];
  stop = startOscClient(async payload => {
    received.push(payload);
    await (payload === "first" ? first.promise : second.promise);
  });
  socket.receive("scores", "first");
  socket.receive("scores", "second");
  let finished = false;
  const stopping = stop().then(() => { finished = true; });
  try {
    assert.equal(socket.disconnects, 1);
    socket.receive("connect");
    socket.receive("scores", "late");
    await flush();
    assert.deepEqual(received, ["first"]);
    assert.equal(finished, false);
    first.resolve();
    await flush();
    assert.deepEqual(received, ["first", "second"]);
    assert.equal(finished, false);
    second.resolve();
    await stopping;
    assert.equal(finished, true);
    assert.deepEqual(socket.emitted, []);
    socket.receive("scores", "after-stop");
    await stop();
    assert.deepEqual(received, ["first", "second"]);
  } finally { first.resolve(); second.resolve(); await stopping; }
});
