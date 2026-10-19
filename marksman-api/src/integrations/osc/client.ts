import { io } from "socket.io-client";
import { createWorkerLogger } from "../../utils/worker-logger";

const OSC_URL = "https://osc.kaysting.dev";

export function startOscClient(onScores: (payload: unknown) => Promise<void>) {
  const socket = io(OSC_URL, {
    path: "/ws",
    transports: ["websocket"],
    autoConnect: false,
  });

  const logger = createWorkerLogger("osc-scores-socket");

  let pending: Promise<void> = Promise.resolve();
  let stopped = false;

  socket.on("connect", () => {
    if (stopped) return;

    socket.emit("subscribe", "scores");

    logger.info("connection established and subscription sent");
  });

  socket.on("scores", (payload: unknown) => {
    if (stopped) return;

    pending = pending
      .then(() => onScores(payload))
      .catch((error) => {
        logger.error("score batch processing failed", { error });
      });
  });

  socket.on("connect_error", (error: Error) => {
    logger.error("connection attempt failed", { error });
  });

  socket.on("disconnect", (reason) => {
    if (!stopped) return logger.warn("connection lost", { reason });
    return logger.info("socket disconnected");
  });

  socket.connect();

  return async function stop() {
    stopped = true;
    socket.disconnect();
    await pending;
  };
}
