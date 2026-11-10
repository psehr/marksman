import type { Request, Response, NextFunction } from "express";
import { config } from "../config";
import { findUserById } from "../db/users";

const allowedOsuUserIds = new Set(config.ALLOWED_OSU_USER_IDS);

export async function requireAlphaAccess(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const userId = req.session.userId;
  if (!userId) {
    return res
      .status(401)
      .json({ code: "NOT_LOGGED_IN", error: "Not logged in" });
  }

  try {
    const user = await findUserById(userId);
    if (!user) {
      return res
        .status(401)
        .json({ code: "NOT_LOGGED_IN", error: "Not logged in" });
    }

    if (!allowedOsuUserIds.has(user.identity.osuUserId)) {
      return res.status(403).json({
        code: "ALPHA_ACCESS_REQUIRED",
        error: "Alpha-access is required to view this content.",
      });
    }

    next();
  } catch (error) {
    next(error);
  }
}
