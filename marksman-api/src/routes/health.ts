import { Router } from "express";
import { checkDatabaseHealth } from "../db/health";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  try {
    await checkDatabaseHealth();

    return res.status(200).json({ status: "ok", database: "available" });
  } catch (error) {
    console.error("Database check failed:", error);
    return res.status(503).json({
      status: "unhealthy",
      database: "unavailable",
    });
  }
});
