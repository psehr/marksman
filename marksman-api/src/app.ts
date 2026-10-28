import express, { type ErrorRequestHandler } from "express";
import session from "express-session";
import cors from "cors";

import { sessionStore } from "./db/session-store";

import { bountiesRouter } from "./routes/bounties";
import { usersRouter } from "./routes/users";
import { config } from "./config";
import { authRouter } from "./routes/auth";
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_PATH,
  SESSION_MAX_AGE_MS,
} from "./auth/session";
import { healthRouter } from "./routes/health";
import { beatmapsRouter } from "./routes/beatmaps";
import { economyRouter } from "./routes/economy";
import { huntsRouter } from "./routes/hunt";

export const app = express();

app.set("trust proxy", config.TRUST_PROXY_HOPS);

app.use(
  cors({
    origin: new URL(config.FRONTEND_URL).origin,
    credentials: true,
  }),
);

app.use(express.json());

app.use(
  session({
    store: sessionStore,
    secret: config.SESSION_SECRET,
    name: SESSION_COOKIE_NAME,
    resave: false,
    saveUninitialized: false,
    cookie: {
      path: SESSION_COOKIE_PATH,
      httpOnly: true,
      sameSite: "lax",
      secure: app.get("env") === "production",
      maxAge: SESSION_MAX_AGE_MS,
    },
  }),
);

app.use("/health", healthRouter);
app.use("/bounties", bountiesRouter);
app.use("/users", usersRouter);
app.use("/beatmaps", beatmapsRouter);
app.use("/auth", authRouter);
app.use("/economy", economyRouter);
app.use("/hunts", huntsRouter);

const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  console.error("Unhandled request error:", error);

  return res.status(500).json({
    code: "UNEXPECTED_ERROR",
    error: "Internal server error",
  });
};

// Current error handling ordering:
// JSON body parsing → routers/routes → 404 fallback → central error handler (listener lives in index.ts)

// 404 Not Found JSON fallback (for inexistant routes)
app.use((_req, res) => {
  return res
    .status(404)
    .json({ code: "ROUTE_NOT_FOUND", error: "Route not found" });
});

// 500 Internal Server Error JSON fallback (for unusual errors)
app.use(errorHandler);
