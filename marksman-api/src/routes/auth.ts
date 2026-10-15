import type { User } from "@marksman/contracts";
import { randomBytes } from "node:crypto";
import { Router } from "express";
import { config } from "../config";
import { z } from "zod";

import { exchangeCodeForToken } from "../integrations/osu/auth";
import { fetchOwnOsuProfile } from "../integrations/osu/users";
import { upsertUserFromOsuProfile } from "../db/users";
import { requireTrustedOrigin } from "../middleware/requireTrustedOrigin";
import { requireAuth } from "../middleware/requireAuth";
import {
  destroySession,
  regenerateSession,
  saveSession,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_PATH,
} from "../auth/session";
import { registerOrUpdateUserFromOsuProfile } from "../services/users";

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

const stateSchema = z.string().regex(/^[0-9a-f]{64}$/);

// Both authorization and denial must include state; code and error are mutually exclusive.
const callbackQuerySchema = z.union([
  z.object({
    code: z.string().min(1),
    state: stateSchema,
    error: z.never().optional(),
  }),
  z.object({
    error: z.string().min(1),
    state: stateSchema,
    code: z.never().optional(),
  }),
]);

export const authRouter = Router();

// Every auth response depends on a browser session and must not be cached.
authRouter.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

authRouter.get("/osu", async (req, res) => {
  const state = randomBytes(32).toString("hex");

  // Tie the callback to this browser's login attempt, with a limited lifetime.
  req.session.oauthState = state;
  req.session.oauthStateExpiresAt = Date.now() + OAUTH_STATE_TTL_MS;

  const url = new URL("https://osu.ppy.sh/oauth/authorize");
  url.search = new URLSearchParams({
    client_id: config.OSU_CLIENT_ID,
    redirect_uri: config.OSU_REDIRECT_URI,
    response_type: "code",
    scope: "identify",
    state,
  }).toString();

  // Persist state before redirecting so it is available when osu! calls back.
  await saveSession(req);
  res.redirect(url.toString());
});

authRouter.get("/osu/callback", async (req, res) => {
  const result = callbackQuerySchema.safeParse(req.query);

  if (!result.success) {
    return res.status(400).json({
      code: "MALFORMED_OAUTH_CALLBACK",
      error: "Malformed OAuth callback parameters",
    });
  }

  const callback = result.data;

  // Only continue if this callback matches an unexpired login attempt.
  if (
    callback.state !== req.session.oauthState ||
    req.session.oauthStateExpiresAt === undefined ||
    req.session.oauthStateExpiresAt <= Date.now()
  ) {
    return res.status(400).json({
      code: "INVALID_OR_EXPIRED_OAUTH",
      error: "Invalid or expired OAuth state",
    });
  }

  // Clear the pending login attempt before handling the authorization result.
  delete req.session.oauthState;
  delete req.session.oauthStateExpiresAt;

  // Persist removal before proceeding. This is not an atomic claim against concurrent callbacks.
  await saveSession(req);

  if (callback.error !== undefined) {
    const url = new URL(config.FRONTEND_URL);
    url.searchParams.set(
      "login",
      callback.error === "access_denied" ? "cancelled" : "failed",
    );
    return res.redirect(url.toString());
  }

  let profile;

  // Only upstream verification failures map to 502; local failures reach Express.
  try {
    const accessToken = await exchangeCodeForToken(callback.code);
    profile = await fetchOwnOsuProfile(accessToken);
  } catch {
    return res.status(502).json({
      code: "UPSTREAM_IDENTITY_VERIFICATION_FAILURE",
      error: "Unable to complete osu! identity verification",
    });
  }

  const user = await registerOrUpdateUserFromOsuProfile({
    osuUserId: profile.id,
    username: profile.username,
  });

  // Replace the pre-login session ID to prevent session fixation.
  await regenerateSession(req);
  // Regeneration replaces req.session, so assign the local account ID afterward.
  req.session.userId = user.identity.id;

  // Persist the login before the redirected frontend requests /auth/me.
  await saveSession(req);
  res.redirect(config.FRONTEND_URL);
});

authRouter.get("/me", requireAuth, (_req, res) => {
  return res.json(res.locals.user satisfies User);
});

authRouter.post("/logout", requireTrustedOrigin, async (req, res) => {
  // Clear the browser cookie only after the server-side session is destroyed.
  await destroySession(req);
  res.clearCookie(SESSION_COOKIE_NAME, { path: SESSION_COOKIE_PATH });
  res.status(204).end();
});
