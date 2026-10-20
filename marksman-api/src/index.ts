import { app } from "./app";
import { config } from "./config";
import { startHuntVerificationWorker } from "./workers/hunt-verification";

import { pool } from "./db";
import { sessionStore } from "./db/session-store";
import { discoverScores } from "./services/hunt-discovery";
import { startScoreDiscoveryWorker } from "./workers/score-discovery";
import { Server } from "http";

let stopHuntVerificationWorker: (() => Promise<void>) | undefined;
let stopScoreDiscoveryWorker: (() => Promise<void>) | undefined;

void startupSequence().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;

  sessionStore.close();
  await pool.end().catch((error) => console.error(error));
});

async function startupSequence() {
  let shuttingDown = false;

  process.on("SIGINT", handleShutdown);
  process.on("SIGTERM", handleShutdown);

  let server: Server | undefined;

  const initialDiscovery = discoverScores();
  await initialDiscovery;

  if (shuttingDown) return;

  server = app.listen(config.PORT, () => {
    if (shuttingDown) return;
    console.log("Listening on http://localhost:" + config.PORT);

    stopHuntVerificationWorker = startHuntVerificationWorker();
    stopScoreDiscoveryWorker = startScoreDiscoveryWorker();
  });

  function stopServer(): Promise<void> {
    if (!server) return Promise.resolve();

    const activeServer = server;

    return new Promise((resolve, reject) => {
      activeServer.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;

    await initialDiscovery;

    const results = await Promise.allSettled([
      stopServer(),
      stopHuntVerificationWorker?.(),
      stopScoreDiscoveryWorker?.(),
    ]);

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
}
