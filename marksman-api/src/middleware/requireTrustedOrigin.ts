import type { Request, Response, NextFunction } from "express";
import { config } from "../config";

const trustedOrigin = new URL(config.FRONTEND_URL).origin;

export function requireTrustedOrigin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const origin = req.get("Origin");

  // Cookie-authenticated mutations require our browser origin; CORS alone is insufficient.
  // Missing and literal "null" origins are rejected by the same exact comparison.
  if (origin !== trustedOrigin) {
    return res
      .status(403)
      .json({ code: "UNTRUSTED_ORIGIN", error: "Untrusted request origin" });
  }

  next();
}
