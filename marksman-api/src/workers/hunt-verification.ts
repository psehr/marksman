import { verifyDueHuntAttempts } from "../services/bounty-hunts-attempts";
import { createWorkerLogger } from "../utils/worker-logger";

export function startHuntVerificationWorker() {
  const logger = createWorkerLogger("hunt-verification");

  // 1 sec timeout between cycles
  const TIMEOUT = 1000;

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let activeBatch: Promise<void> | undefined;

  async function runBatch() {
    try {
      const failures = await verifyDueHuntAttempts(20);
      for (const failure of failures) {
        logger.warn("attempt_failed", failure);
      }
    } catch (error) {
      logger.error("batch_failed", { error });
    }
  }

  async function runCycle() {
    if (stopped) return;

    await runBatch();

    if (!stopped) {
      timer = setTimeout(launchCycle, TIMEOUT);
    }
  }

  function launchCycle() {
    activeBatch = runCycle();
  }

  launchCycle();

  return async function stop() {
    stopped = true;
    clearTimeout(timer);
    await activeBatch;
  };
}
