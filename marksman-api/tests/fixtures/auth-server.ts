// Child process used to prove sessions survive a fresh app/pool/store instance.
// All configuration is inherited from the isolated auth test suite.
import { app } from "../../src/app";
import { pool } from "../../src/db";
import { sessionStore } from "../../src/db/session-store";

if (!process.send || !process.env.DATABASE_URL?.includes("127.0.0.1:5433/marksman_test")) {
  throw new Error("This fixture must be launched by the isolated auth tests");
}

const server = app.listen(0, "127.0.0.1", () => {
  const address = server.address();
  if (address && typeof address !== "string") process.send!({ port: address.port });
});

process.once("message", () => {
  server.close(async () => {
    sessionStore.close();
    await pool.end();
    process.disconnect();
  });
  server.closeAllConnections();
});
