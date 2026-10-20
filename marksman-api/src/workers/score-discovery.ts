import { discoverScores } from "../services/hunt-discovery";
import { createWorkerLogger } from "../utils/worker-logger";

export function startScoreDiscoveryWorker() {
  const logger = createWorkerLogger("osu-scores-discovery");

  // 10s timeout between cycles
  const TIMEOUT = 10_000;

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let activeBatch: Promise<void> | undefined;

  async function runDiscover() {
    try {
      await discoverScores();
    } catch (error) {
      logger.error("Batch discovery failed", { error });
    }
  }

  async function runCycle() {
    if (stopped) return;

    await runDiscover();

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
