import { app } from "./app";
import { config } from "./config";
import { startHuntVerificationWorker } from "./workers/hunt-verification";

import { pool } from "./db";
import { sessionStore } from "./db/session-store";

let stopWorker: (() => Promise<void>) | undefined;

const server = app.listen(config.PORT, () => {
  console.log("Listening on http://localhost:" + config.PORT);

  stopWorker = startHuntVerificationWorker();
});

function stopServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

let shuttingDown = false;

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  const results = await Promise.allSettled([stopServer(), stopWorker?.()]);

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("Shutdown operation failed:", result.reason);
      process.exitCode = 1;
    }
  }

  sessionStore.close();
  await pool.end();
}

function handleShutdown() {
  shutdown().catch((error) => {
    console.error("Shutdown failed:", error);
    process.exitCode = 1;
  });
}

process.on("SIGINT", handleShutdown);
process.on("SIGTERM", handleShutdown);
