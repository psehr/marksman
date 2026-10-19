import { io } from "socket.io-client";

const OSC_URL = "https://osc.kaysting.dev";

export function startOscClient(onScores: (payload: unknown) => Promise<void>) {
  const socket = io(OSC_URL, {
    path: "/ws",
    transports: ["websocket"],
    autoConnect: false,
  });

  let pending: Promise<void> = Promise.resolve();
  let stopped = false;

  socket.on("connect", () => {
    if (stopped) return;

    socket.emit("subscribe", "scores");
  });

  socket.on("scores", (payload: unknown) => {
    if (stopped) return;

    pending = pending
      .then(() => onScores(payload))
      .catch((error) => {
        console.error(error);
      });
  });

  socket.connect();

  return async function stop() {
    stopped = true;
    socket.disconnect();
    await pending;
  };
}
