import { Router } from "express";
import { getDatabaseContainerStatus } from "../docker";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  try {
    const database = await getDatabaseContainerStatus();
    const isHealthy =
      database.state === "running" && database.health === "healthy";

    return res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? "ok" : "unhealthy",
      database,
    });
  } catch (error) {
    console.error("Unable to read the PostgreSQL container status:", error);
    return res.status(503).json({
      status: "unhealthy",
      database: { state: "unavailable", health: null },
    });
  }
});
